// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/core';
import type { IDataEngine, IUserPreferencesService, IUserFavoritesService } from '@objectstack/spec/contracts';
import { ObjectQLUserPreferencesService } from './adapters/objectql-preferences-adapter.js';
import { UserFavoritesService } from './adapters/favorites-adapter.js';
import { UserPreferenceObject } from './objects/index.js';
import { buildUserPreferencesRoutes } from './routes/index.js';

/**
 * Configuration options for the UserPreferencesServicePlugin.
 */
export interface UserPreferencesServicePluginOptions {
  /** Enable debug logging. */
  debug?: boolean;
}

/**
 * UserPreferencesServicePlugin — Kernel plugin for User Preferences Service.
 *
 * Lifecycle:
 * 1. **init** — Creates {@link ObjectQLUserPreferencesService} and {@link UserFavoritesService},
 *    registers them as `'user-preferences'` and `'user-favorites'` services.
 * 2. **start** — Registers REST routes for preferences and favorites APIs.
 * 3. **destroy** — Cleans up references.
 *
 * @example
 * ```ts
 * import { LiteKernel } from '@objectstack/core';
 * import { UserPreferencesServicePlugin } from '@objectstack/service-user-preferences';
 *
 * const kernel = new LiteKernel();
 * kernel.use(new UserPreferencesServicePlugin());
 * await kernel.bootstrap();
 *
 * const prefs = kernel.getService<IUserPreferencesService>('user-preferences');
 * await prefs.set('user123', 'theme', 'dark');
 * const theme = await prefs.get('user123', 'theme');
 * ```
 */
export class UserPreferencesServicePlugin implements Plugin {
  name = 'com.objectstack.service-user-preferences';
  version = '1.0.0';
  type = 'standard' as const;
  dependencies: string[] = ['com.objectstack.engine.objectql'];

  private preferencesService?: IUserPreferencesService;
  private favoritesService?: IUserFavoritesService;
  private readonly options: UserPreferencesServicePluginOptions;

  constructor(options: UserPreferencesServicePluginOptions = {}) {
    this.options = options;
  }

  async init(ctx: PluginContext): Promise<void> {
    // Get the data engine from ObjectQL plugin
    const dataEngine = ctx.getService<IDataEngine>('data');
    if (!dataEngine) {
      throw new Error('[UserPreferences] IDataEngine not found. Ensure ObjectQLPlugin is loaded first.');
    }

    // Create service instances
    this.preferencesService = new ObjectQLUserPreferencesService(dataEngine);
    this.favoritesService = new UserFavoritesService(this.preferencesService);

    // Register services
    ctx.registerService('user-preferences', this.preferencesService);
    ctx.registerService('user-favorites', this.favoritesService);

    // Register user_preferences object via manifest service
    ctx.getService<{ register(m: any): void }>('manifest').register({
      id: 'com.objectstack.service-user-preferences',
      name: 'User Preferences Service',
      version: '1.0.0',
      type: 'plugin',
      namespace: 'identity',
      objects: [UserPreferenceObject],
    });

    // Contribute navigation items to the Setup App (if SetupPlugin is loaded).
    try {
      const setupNav = ctx.getService<{ contribute(c: any): void }>('setupNav');
      if (setupNav) {
        setupNav.contribute({
          areaId: 'area_identity',
          items: [
            {
              id: 'nav_user_preferences',
              type: 'object',
              label: { key: 'setup.nav.user_preferences', defaultValue: 'User Preferences' },
              objectName: 'user_preferences',
              icon: 'settings',
              order: 30,
            },
          ],
        });
        ctx.logger.info('[UserPreferences] Navigation items contributed to Setup App');
      }
    } catch {
      // SetupPlugin not loaded — skip silently
    }

    ctx.logger.info('[UserPreferences] Service initialized');
  }

  async start(ctx: PluginContext): Promise<void> {
    if (!this.preferencesService || !this.favoritesService) return;

    // Build and expose route definitions
    const routes = buildUserPreferencesRoutes(
      this.preferencesService,
      this.favoritesService,
      ctx.logger
    );

    // Trigger hook so HTTP server plugins can mount these routes
    await ctx.trigger('user-preferences:routes', routes);

    // Cache routes on the kernel so HttpDispatcher can find them
    const kernel = ctx.getKernel();
    if (kernel) {
      (kernel as any).__userPreferencesRoutes = routes;
    }

    ctx.logger.info(`[UserPreferences] Service started — routes=${routes.length}`);
  }

  async destroy(): Promise<void> {
    this.preferencesService = undefined;
    this.favoritesService = undefined;
  }
}
