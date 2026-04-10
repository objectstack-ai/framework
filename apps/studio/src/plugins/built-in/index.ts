// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Built-in Plugins Barrel Export
 * 
 * All built-in plugins are registered by default when Studio starts.
 * External plugins can be added at runtime via the PluginRegistry.
 */

import type { StudioPlugin } from '../types';

// Core plugins
import { objectDesignerPlugin } from './object-plugin';
import { defaultInspectorPlugin } from './default-plugin';

// Playground plugins
import { agentPlaygroundPlugin } from './agent-playground-plugin';
import { toolPlaygroundPlugin } from './tool-playground-plugin';

// Protocol plugins (sidebar groups + icons)
import { uiProtocolPlugin } from './ui-plugin';
import { automationProtocolPlugin } from './automation-plugin';
import { securityProtocolPlugin } from './security-plugin';
import { aiProtocolPlugin } from './ai-plugin';
import { apiProtocolPlugin } from './api-plugin';

/** All built-in plugins, in activation order */
export const builtInPlugins: StudioPlugin[] = [
  // The default inspector MUST be first — it provides the wildcard fallback
  defaultInspectorPlugin,

  // Object designer (highest priority for object/objects types)
  objectDesignerPlugin,

  // Playground plugins (priority 10, higher than default inspector)
  agentPlaygroundPlugin,
  toolPlaygroundPlugin,

  // Protocol group plugins (provide sidebar groups + icons)
  uiProtocolPlugin,
  automationProtocolPlugin,
  securityProtocolPlugin,
  aiProtocolPlugin,
  apiProtocolPlugin,
];

// Re-export individual plugins for selective use / testing
export {
  objectDesignerPlugin,
  defaultInspectorPlugin,
  agentPlaygroundPlugin,
  toolPlaygroundPlugin,
  uiProtocolPlugin,
  automationProtocolPlugin,
  securityProtocolPlugin,
  aiProtocolPlugin,
  apiProtocolPlugin,
};
