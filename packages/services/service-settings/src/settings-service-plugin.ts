// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/core';
import type { IHttpServer, IDataEngine } from '@objectstack/spec/contracts';
import type { SettingsManifest } from '@objectstack/spec/system';
import { SettingsService } from './settings-service.js';
import type { SettingsAuditSink, SettingsEngine } from './settings-service.types.js';
import type { CryptoAdapter } from './crypto-adapter.js';
import { registerSettingsRoutes } from './settings-routes.js';
import {
  settingsObjects,
  settingsPluginManifestHeader,
  SETTINGS_PLUGIN_ID,
  SETTINGS_PLUGIN_VERSION,
} from './manifest.js';
import {
  builtinSettingsManifests,
  mailTestActionHandler,
} from './manifests/index.js';
import { settingsBuiltinTranslations } from './translations/index.js';

/** Configuration options for the SettingsServicePlugin. */
export interface SettingsServicePluginOptions {
  /**
   * Pre-register these manifests at boot. When omitted, the bundled
   * builtin manifests (mail / branding / feature_flags) are loaded so
   * a host gets a working Settings hub out of the box. Pass an empty
   * array to opt out entirely.
   */
  manifests?: SettingsManifest[];
  /** Override the default crypto adapter. */
  crypto?: CryptoAdapter;
  /** Override the default base path (`/api/settings`). */
  basePath?: string;
  /** Disable REST route registration. */
  registerRoutes?: boolean;
  /** Override the env source. Defaults to `process.env`. */
  env?: Record<string, string | undefined>;
  /**
   * Action handlers to register at boot, keyed by namespace and action
   * id. The bundled `mail.test` handler is registered automatically
   * unless this object is provided.
   */
  actionHandlers?: Record<string, Record<string, import('./settings-service.types.js').SettingsActionHandler>>;
}

/**
 * SettingsServicePlugin — wires the SettingsService into the kernel.
 *
 *  1. `init`: instantiate the service, register it under `'settings'`,
 *     and ship `sys_setting` to the manifest service so the engine
 *     auto-provisions the table.
 *  2. `start` → `kernel:ready`: bind the data engine (when present),
 *     wire the audit sink (when present), mount REST routes.
 */
export class SettingsServicePlugin implements Plugin {
  name = SETTINGS_PLUGIN_ID;
  version = SETTINGS_PLUGIN_VERSION;
  type = 'standard' as const;

  private readonly opts: SettingsServicePluginOptions;
  private service: SettingsService | null = null;

  constructor(opts: SettingsServicePluginOptions = {}) {
    this.opts = {
      ...opts,
      manifests: opts.manifests ?? builtinSettingsManifests,
      actionHandlers: opts.actionHandlers ?? {
        mail: { test: mailTestActionHandler },
      },
    };
  }

  async init(ctx: PluginContext): Promise<void> {
    this.service = new SettingsService({
      crypto: this.opts.crypto,
      env: this.opts.env,
    });
    for (const m of this.opts.manifests ?? []) this.service.registerManifest(m);
    for (const [ns, handlers] of Object.entries(this.opts.actionHandlers ?? {})) {
      for (const [id, fn] of Object.entries(handlers)) {
        this.service.registerAction(ns, id, fn);
      }
    }

    ctx.registerService('settings', this.service);
    ctx.logger?.info?.(
      `SettingsServicePlugin: registered (manifests=${this.opts.manifests?.length ?? 0})`,
    );

    // Register the K/V object so the engine creates the table.
    try {
      ctx.getService<{ register(m: any): void }>('manifest').register({
        ...settingsPluginManifestHeader,
        objects: settingsObjects,
      });
    } catch {
      // manifest service is optional — skip in lean test kernels.
    }
  }

  async start(ctx: PluginContext): Promise<void> {
    if (!this.service) return;

    ctx.hook('kernel:ready', async () => {
      // Contribute built-in settings translations into the i18n service.
      // Done in `kernel:ready` (not `init`) because the i18n service plugin
      // is typically registered AFTER capability-loaded service plugins.
      try {
        const i18n = ctx.getService<{
          loadTranslations: (locale: string, data: Record<string, unknown>) => void;
        }>('i18n');
        let loaded = 0;
        for (const [locale, data] of Object.entries(settingsBuiltinTranslations)) {
          if (data && typeof data === 'object') {
            try {
              i18n.loadTranslations(locale, data as Record<string, unknown>);
              loaded++;
            } catch (err: any) {
              ctx.logger?.warn?.(
                `SettingsServicePlugin: failed to load translations for '${locale}': ${err?.message ?? err}`,
              );
            }
          }
        }
        if (loaded > 0) {
          ctx.logger?.info?.(
            `SettingsServicePlugin: contributed built-in translations (${loaded} locale${loaded > 1 ? 's' : ''})`,
          );
        }
      } catch {
        // i18n service not registered — manifest literals remain authoritative.
      }

      // Late-bind the data engine.
      let engine: IDataEngine | null = null;
      try {
        engine = ctx.getService<IDataEngine>('objectql');
      } catch {
        // ok — fall back to in-memory.
      }
      if (engine) {
        // Late-bind the engine + audit sink on the existing service
        // instance. We avoid re-registering the service because the
        // kernel disallows `registerService` for an already-registered
        // name.
        this.service!.bindEngine(
          engine as unknown as SettingsEngine,
          this.buildAuditSink(ctx, engine),
        );
      }

      if (this.opts.registerRoutes === false) return;

      let http: IHttpServer | null = null;
      try {
        http = ctx.getService<IHttpServer>('http-server');
      } catch {
        // ok — no HTTP server in this deployment.
      }
      if (!http) {
        ctx.logger?.warn?.(
          'SettingsServicePlugin: no HTTP server available — REST routes not registered. ' +
            'SettingsService is still reachable via kernel.getService("settings").',
        );
        return;
      }
      registerSettingsRoutes(http, this.service!, { basePath: this.opts.basePath });
      ctx.logger?.info?.(
        'SettingsServicePlugin: REST routes registered at ' + (this.opts.basePath ?? '/api/settings'),
      );
    });
  }

  /** Glue an `engine.insert('sys_audit_log', …)` audit sink. */
  private buildAuditSink(ctx: PluginContext, engine: IDataEngine): SettingsAuditSink {
    return {
      record: async (entry) => {
        try {
          await (engine as any).insert?.('sys_audit_log', {
            actor_id: entry.userId ?? null,
            entity_type: 'sys_setting',
            entity_id: `${entry.namespace}.${entry.key}`,
            action: entry.action,
            payload: {
              namespace: entry.namespace,
              key: entry.key,
              scope: entry.scope,
              encrypted: entry.encrypted,
              digest: entry.valueDigest,
            },
            request_id: entry.requestId ?? null,
            occurred_at: new Date().toISOString(),
          });
        } catch (err: any) {
          ctx.logger?.warn?.('SettingsServicePlugin: audit record failed: ' + (err?.message ?? err));
        }
      },
    };
  }
}
