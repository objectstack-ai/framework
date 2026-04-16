// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { PluginContext } from '@objectstack/core';
import type {
  RemotePluginManifest,
  MarketplaceConfig,
  PluginInstallResult,
  PluginUninstallResult,
  InstalledPluginInfo
} from './types';

/**
 * Remote plugin loader - handles dynamic loading from cloud marketplace
 */
export class RemotePluginLoader {
  private cache = new Map<string, any>();
  private manifests = new Map<string, RemotePluginManifest>();

  constructor(
    private config: MarketplaceConfig,
    private ctx: PluginContext
  ) {}

  /**
   * Fetch available plugins from marketplace
   */
  async fetchAvailablePlugins(): Promise<RemotePluginManifest[]> {
    this.ctx.logger.info('Fetching plugins from marketplace', {
      url: `${this.config.marketplaceUrl}/api/marketplace/plugins`
    });

    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.config.requestTimeout || 30000
      );

      const response = await fetch(
        `${this.config.marketplaceUrl}/api/marketplace/plugins`,
        {
          headers: this.config.authToken
            ? { 'Authorization': `Bearer ${this.config.authToken}` }
            : {},
          signal: controller.signal
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Marketplace API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const plugins = Array.isArray(data) ? data : data.plugins || [];

      this.ctx.logger.info('Fetched plugins from marketplace', {
        count: plugins.length
      });

      return plugins;
    } catch (err: any) {
      this.ctx.logger.error('Failed to fetch plugins from marketplace', {
        error: err.message
      });
      throw err;
    }
  }

  /**
   * Load a remote plugin module dynamically
   */
  async loadPlugin(manifest: RemotePluginManifest): Promise<any> {
    const cacheKey = `${manifest.id}@${manifest.version}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      this.ctx.logger.debug('Plugin loaded from cache', { id: manifest.id });
      return this.cache.get(cacheKey);
    }

    this.ctx.logger.info('Loading remote plugin', {
      id: manifest.id,
      version: manifest.version,
      url: manifest.moduleUrl
    });

    try {
      // Dynamic import ESM module
      const module = await import(/* @vite-ignore */ manifest.moduleUrl);
      const plugin = module.default || module;

      // Cache the loaded module
      if (this.config.enableCache) {
        this.cache.set(cacheKey, plugin);
      }
      this.manifests.set(manifest.id, manifest);

      this.ctx.logger.info('Remote plugin loaded successfully', {
        id: manifest.id
      });

      return plugin;
    } catch (err: any) {
      this.ctx.logger.error('Failed to load remote plugin', {
        id: manifest.id,
        error: err.message,
        stack: err.stack
      });
      throw new Error(`Failed to load plugin ${manifest.id}: ${err.message}`);
    }
  }

  /**
   * Install and enable a plugin
   */
  async installPlugin(pluginId: string): Promise<PluginInstallResult> {
    try {
      this.ctx.logger.info('Installing plugin', { pluginId });

      // 1. Get plugin manifest
      const manifest = await this.getManifest(pluginId);

      // 2. Check dependencies
      if (manifest.dependencies?.length) {
        for (const depId of manifest.dependencies) {
          const installed = await this.isPluginInstalled(depId);
          if (!installed) {
            throw new Error(`Missing dependency: ${depId}`);
          }
        }
      }

      // 3. Load the plugin module
      const pluginConfig = await this.loadPlugin(manifest);

      // 4. Register with kernel
      const kernel = this.ctx.getService('kernel') as any;
      const { AppPlugin } = await import('@objectstack/runtime');
      await kernel.use(new AppPlugin(pluginConfig));

      // 5. Persist state if enabled
      if (this.config.persistState) {
        await this.savePluginState(manifest, { enabled: true });
      }

      this.ctx.logger.info('Plugin installed successfully', { pluginId });

      return { success: true, pluginId };
    } catch (err: any) {
      this.ctx.logger.error('Failed to install plugin', {
        pluginId,
        error: err.message
      });
      return { success: false, pluginId, error: err.message };
    }
  }

  /**
   * Uninstall and disable a plugin
   */
  async uninstallPlugin(pluginId: string): Promise<PluginUninstallResult> {
    try {
      this.ctx.logger.info('Uninstalling plugin', { pluginId });

      const kernel = this.ctx.getService('kernel') as any;

      // Unload the plugin from kernel
      await kernel.unload(`plugin.app.${pluginId}`);

      // Update persistence
      if (this.config.persistState) {
        await this.deletePluginState(pluginId);
      }

      // Clear cache
      const manifest = this.manifests.get(pluginId);
      if (manifest) {
        const cacheKey = `${manifest.id}@${manifest.version}`;
        this.cache.delete(cacheKey);
        this.manifests.delete(pluginId);
      }

      this.ctx.logger.info('Plugin uninstalled successfully', { pluginId });

      return { success: true, pluginId };
    } catch (err: any) {
      this.ctx.logger.error('Failed to uninstall plugin', {
        pluginId,
        error: err.message
      });
      return { success: false, pluginId, error: err.message };
    }
  }

  /**
   * Get list of installed plugins
   */
  async getInstalledPlugins(): Promise<InstalledPluginInfo[]> {
    if (!this.config.persistState) {
      // Return from memory cache
      return Array.from(this.manifests.values()).map(m => ({
        id: m.id,
        name: m.name,
        version: m.version,
        enabled: true,
        autoload: m.autoload || false,
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
    }

    try {
      const ql = this.ctx.getService('objectql') as any;
      const records = await ql.find('sys__plugin_manifest', {
        filter: { enabled: { eq: true } }
      });

      return records.map((r: any) => ({
        id: r.id,
        name: r.name,
        version: r.version,
        enabled: r.enabled,
        autoload: r.autoload || false,
        installedAt: r.created_at,
        updatedAt: r.updated_at
      }));
    } catch (err: any) {
      this.ctx.logger.error('Failed to get installed plugins', {
        error: err.message
      });
      return [];
    }
  }

  /**
   * Auto-load plugins marked for autoload
   */
  async autoloadPlugins(): Promise<void> {
    if (!this.config.persistState) {
      return;
    }

    try {
      const ql = this.ctx.getService('objectql') as any;
      const autoloadPlugins = await ql.find('sys__plugin_manifest', {
        filter: {
          enabled: { eq: true },
          autoload: { eq: true }
        }
      });

      this.ctx.logger.info('Auto-loading plugins', {
        count: autoloadPlugins.length
      });

      for (const record of autoloadPlugins) {
        try {
          await this.installPlugin(record.id);
        } catch (err: any) {
          this.ctx.logger.error('Failed to autoload plugin', {
            id: record.id,
            error: err.message
          });
        }
      }
    } catch (err: any) {
      this.ctx.logger.warn('Failed to query autoload plugins', {
        error: err.message
      });
    }
  }

  /**
   * Get plugin manifest
   */
  private async getManifest(pluginId: string): Promise<RemotePluginManifest> {
    // Check memory cache
    if (this.manifests.has(pluginId)) {
      return this.manifests.get(pluginId)!;
    }

    // Check database
    if (this.config.persistState) {
      try {
        const ql = this.ctx.getService('objectql') as any;
        const records = await ql.find('sys__plugin_manifest', {
          filter: { id: { eq: pluginId } },
          top: 1
        });

        if (records.length > 0) {
          const manifest = records[0] as RemotePluginManifest;
          this.manifests.set(pluginId, manifest);
          return manifest;
        }
      } catch (err: any) {
        this.ctx.logger.debug('Plugin not found in database', { pluginId });
      }
    }

    // Fetch from marketplace API
    try {
      const response = await fetch(
        `${this.config.marketplaceUrl}/api/marketplace/plugins/${pluginId}`,
        {
          headers: this.config.authToken
            ? { 'Authorization': `Bearer ${this.config.authToken}` }
            : {}
        }
      );

      if (!response.ok) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }

      const manifest = await response.json();
      this.manifests.set(pluginId, manifest);
      return manifest;
    } catch (err: any) {
      throw new Error(`Failed to fetch plugin manifest: ${err.message}`);
    }
  }

  /**
   * Check if a plugin is installed
   */
  private async isPluginInstalled(pluginId: string): Promise<boolean> {
    if (this.manifests.has(pluginId)) {
      return true;
    }

    if (!this.config.persistState) {
      return false;
    }

    try {
      const ql = this.ctx.getService('objectql') as any;
      const records = await ql.find('sys__plugin_manifest', {
        filter: { id: { eq: pluginId }, enabled: { eq: true } },
        top: 1
      });

      return records.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Save plugin state to database
   */
  private async savePluginState(
    manifest: RemotePluginManifest,
    state: { enabled: boolean }
  ): Promise<void> {
    try {
      const ql = this.ctx.getService('objectql') as any;

      await ql.upsert('sys__plugin_manifest', {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        namespace: manifest.namespace,
        type: manifest.type,
        module_url: manifest.moduleUrl,
        integrity: manifest.integrity,
        enabled: state.enabled,
        autoload: manifest.autoload || false,
        description: manifest.description,
        author: manifest.author,
        updated_at: new Date().toISOString()
      });
    } catch (err: any) {
      this.ctx.logger.error('Failed to save plugin state', {
        pluginId: manifest.id,
        error: err.message
      });
    }
  }

  /**
   * Delete plugin state from database
   */
  private async deletePluginState(pluginId: string): Promise<void> {
    try {
      const ql = this.ctx.getService('objectql') as any;
      await ql.delete('sys__plugin_manifest', { id: { eq: pluginId } });
    } catch (err: any) {
      this.ctx.logger.error('Failed to delete plugin state', {
        pluginId,
        error: err.message
      });
    }
  }
}
