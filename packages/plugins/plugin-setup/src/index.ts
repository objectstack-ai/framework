// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @objectstack/plugin-setup
 *
 * Setup Plugin for ObjectStack — owns and composes the platform Setup App.
 * Other plugins contribute navigation items via the `setupNav` service.
 */

export { SetupPlugin, type SetupNavService } from './setup-plugin.js';
export { SETUP_APP_DEFAULTS, type SetupNavContribution } from './setup-app.js';
export { SETUP_AREAS, SETUP_AREA_IDS, type SetupAreaId } from './setup-areas.js';
