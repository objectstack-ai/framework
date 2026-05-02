// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// Core engine
export { AutomationEngine } from './engine.js';
export type { NodeExecutor, NodeExecutionResult, FlowTrigger } from './engine.js';

// Kernel plugin
export { AutomationServicePlugin } from './plugin.js';
export type { AutomationServicePluginOptions } from './plugin.js';

// Node plugins
export { CrudNodesPlugin } from './plugins/crud-nodes-plugin.js';
export { LogicNodesPlugin } from './plugins/logic-nodes-plugin.js';
export { HttpConnectorPlugin } from './plugins/http-connector-plugin.js';
export { ScreenNodesPlugin } from './plugins/screen-nodes-plugin.js';
