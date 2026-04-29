// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Reserved fixed-name project identifier for the platform / control plane.
 *
 * The platform surface (system-level metadata, runtime-global packages,
 * built-in objects) is exposed through the regular `/projects/:projectId/*`
 * route tree by reserving the id `platform`. This avoids a parallel
 * `/platform/*` route family that would have to mirror every project route
 * by hand and instead lets the existing layout, sidebar, top-bar, and
 * project switcher handle a single code path.
 *
 * Backend semantics: when this id flows into the client, the X-Project-Id
 * header is intentionally cleared so requests use the unscoped/control-plane
 * meta endpoints. The id is reserved and must never be used for a real
 * project record in the projects table.
 */
export const PLATFORM_PROJECT_ID = 'platform';

export function isPlatformProject(id: string | undefined | null): boolean {
  return id === PLATFORM_PROJECT_ID;
}

/**
 * Synthetic display label for the platform project. Used by breadcrumbs,
 * the project switcher, and any UI that would otherwise look up the
 * display_name from a real project record.
 */
export const PLATFORM_PROJECT_DISPLAY_NAME = 'Platform';
