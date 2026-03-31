// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/core';
import type { App, NavigationArea } from '@objectstack/spec/ui';
import { SETUP_AREAS } from './setup-areas.js';
import { SETUP_APP_DEFAULTS, type SetupNavContribution } from './setup-app.js';

/**
 * SetupPlugin
 *
 * Owns and finalizes the platform **Setup App**.
 *
 * ### Lifecycle
 *
 * 1. **init** — Registers the `setupNav` service (a contribution collector)
 *    so that other plugins can call `ctx.getService('setupNav').contribute(…)`
 *    to add navigation items to the Setup App.
 *
 * 2. **start** — Collects all contributions, merges them into the four
 *    built-in Setup Areas, filters out empty areas, and registers the
 *    finalized Setup App as an internal platform app via the
 *    `app.com.objectstack.setup` service convention.
 *
 * ### Extension Model
 *
 * Any plugin that wants to appear in the Setup sidebar should:
 * ```ts
 * async init(ctx: PluginContext) {
 *   const setupNav = ctx.getService<SetupNavService>('setupNav');
 *   setupNav.contribute({
 *     areaId: 'area_administration',
 *     items: [
 *       { id: 'nav_users', type: 'object', label: 'Users', objectName: 'sys_user' },
 *     ],
 *   });
 * }
 * ```
 */
export class SetupPlugin implements Plugin {
  name = 'com.objectstack.setup';
  type = 'standard';
  version = '1.0.0';

  /** Accumulated contributions from other plugins. */
  private contributions: SetupNavContribution[] = [];

  // ─── Plugin Lifecycle ────────────────────────────────────────────

  async init(ctx: PluginContext): Promise<void> {
    ctx.logger.info('Initializing Setup Plugin...');

    // Expose the contribution API as a service so other plugins
    // can add navigation items during their own init phase.
    ctx.registerService('setupNav', {
      /**
       * Register navigation items for a Setup area.
       */
      contribute: (contribution: SetupNavContribution): void => {
        this.contributions.push(contribution);
      },
    });

    ctx.logger.info('Setup Plugin initialized — setupNav service registered');
  }

  async start(ctx: PluginContext): Promise<void> {
    ctx.logger.info('Starting Setup Plugin — finalizing Setup App...');

    // Merge contributions into area skeletons.
    const areas = this.mergeAreas(this.contributions);

    // Build the final Setup App.
    const setupApp: App = {
      ...SETUP_APP_DEFAULTS,
      areas: areas.length > 0 ? areas : undefined,
    };

    // Register the finalized Setup App as an internal platform app
    // following the `app.<id>` service convention used by ObjectQLPlugin.
    ctx.registerService('app.com.objectstack.setup', {
      id: 'com.objectstack.setup',
      name: 'Setup',
      version: '1.0.0',
      type: 'plugin',
      namespace: 'sys',
      objects: [],
      apps: [setupApp],
    });

    ctx.logger.info(
      `Setup App registered with ${areas.length} area(s) and ` +
      `${this.contributions.length} contribution(s)`,
    );
  }

  async destroy(): Promise<void> {
    this.contributions = [];
  }

  // ─── Internal Helpers ────────────────────────────────────────────

  /**
   * Merge all navigation contributions into the built-in Setup Area skeletons.
   *
   * - Contributions targeting a known area are appended to that area's
   *   navigation array.
   * - Contributions targeting an unknown area ID create a new custom area.
   * - Areas that remain empty after merging are filtered out.
   * - The resulting array is sorted by `order` (ascending).
   */
  mergeAreas(contributions: SetupNavContribution[]): NavigationArea[] {
    // Clone area skeletons so we never mutate the constant.
    const areaMap = new Map<string, NavigationArea>(
      SETUP_AREAS.map((a) => [a.id, { ...a, navigation: [...a.navigation] }]),
    );

    for (const c of contributions) {
      const existing = areaMap.get(c.areaId);
      if (existing) {
        existing.navigation.push(...c.items);
      } else {
        // Custom area contributed by a third-party plugin.
        areaMap.set(c.areaId, {
          id: c.areaId,
          label: c.areaId,
          order: 100,
          navigation: [...c.items],
        });
      }
    }

    // Filter out empty areas and sort by order.
    return Array.from(areaMap.values())
      .filter((a) => a.navigation.length > 0)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
}

/**
 * Public type for the `setupNav` service exposed by SetupPlugin.
 */
export interface SetupNavService {
  contribute(contribution: SetupNavContribution): void;
}
