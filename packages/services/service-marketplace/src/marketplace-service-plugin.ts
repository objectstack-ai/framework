// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Plugin, PluginContext } from '@objectstack/core';
import { RemotePluginLoader } from './remote-plugin-loader.js';
import type { MarketplaceConfig } from './types.js';

/**
 * Marketplace Service Plugin
 *
 * Enables runtime plugin loading from cloud marketplace.
 * Integrates with https://github.com/objectstack-ai/cloud marketplace.
 */
export class MarketplaceServicePlugin implements Plugin {
  name = 'service.marketplace';
  type = 'service';
  version = '1.0.0';

  private loader?: RemotePluginLoader;

  constructor(private config: Partial<MarketplaceConfig> = {}) {}

  init = async (ctx: PluginContext) => {
    const defaultConfig: MarketplaceConfig = {
      marketplaceUrl: process.env.OBJECTSTACK_MARKETPLACE_URL
        || 'https://cloud.objectstack.ai',
      authToken: process.env.OBJECTSTACK_AUTH_TOKEN,
      enableCache: true,
      cacheTTL: 3600,
      persistState: true,
      requestTimeout: 30000,
      ...this.config
    };

    this.loader = new RemotePluginLoader(defaultConfig, ctx);

    // Register service
    ctx.registerService('marketplace', this.loader);

    ctx.logger.info('Marketplace service initialized', {
      marketplaceUrl: defaultConfig.marketplaceUrl,
      persistState: defaultConfig.persistState
    });
  }

  start = async (ctx: PluginContext) => {
    if (!this.loader) {
      return;
    }

    ctx.logger.info('Marketplace service starting');

    // Auto-load plugins marked for autoload
    try {
      await this.loader.autoloadPlugins();
      ctx.logger.info('Marketplace service started');
    } catch (err: any) {
      ctx.logger.error('Failed to autoload plugins', {
        error: err.message
      });
    }
  }

  stop = async (ctx: PluginContext) => {
    ctx.logger.info('Marketplace service stopped');
  }
}
