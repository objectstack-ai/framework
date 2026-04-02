// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { App, NavigationArea, NavigationItem } from '@objectstack/spec/ui';

/**
 * Default Setup App definition.
 *
 * This is the base identity of the platform Setup application.
 * At runtime the `SetupPlugin` clones this definition, injects
 * the merged navigation areas contributed by other plugins,
 * and registers the final app.
 */
export const SETUP_APP_DEFAULTS: Omit<App, 'areas'> & { areas: NavigationArea[] } = {
  name: 'setup',
  label: 'Setup',
  description: 'Platform settings and administration',
  icon: 'settings',
  active: true,
  isDefault: false,
  branding: {
    primaryColor: '#475569', // Slate-600 — neutral admin palette
  },
  requiredPermissions: ['setup.access'],
  areas: [],
};

/**
 * Navigation contribution that a plugin registers via the
 * `setupNav` service convention during kernel init.
 *
 * Each contribution targets a specific area by its ID and provides
 * one or more navigation items (or groups) to merge into that area.
 */
export interface SetupNavContribution {
  /** Target area ID (e.g. `area_administration`). */
  areaId: string;

  /** Navigation items to contribute to the target area. */
  items: NavigationItem[];
}
