// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineStack } from '@objectstack/spec';

/**
 * ObjectStack Configuration for plugin-setup
 *
 * This configuration defines the manifest for the platform Setup plugin.
 * The Setup App itself is composed at runtime by collecting setupNav
 * contributions from all registered plugins.
 */
export default defineStack({
  manifest: {
    id: 'com.objectstack.plugin-setup',
    namespace: 'setup',
    version: '3.3.1',
    type: 'plugin',
    name: 'Platform Setup Plugin',
    description: 'Owns and composes the platform Setup App with area-based navigation contributed by other plugins',
  },
});
