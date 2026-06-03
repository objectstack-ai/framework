// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

export { ToolRegistry } from './tool-registry.js';
export type { ToolHandler, ToolExecutionResult } from './tool-registry.js';

export { registerDataTools, DATA_TOOL_DEFINITIONS } from './data-tools.js';
export type { DataToolContext } from './data-tools.js';

export { registerKnowledgeTools, SEARCH_KNOWLEDGE_TOOL } from './knowledge-tools.js';
export type { KnowledgeToolContext } from './knowledge-tools.js';

// NOTE: the AI metadata-authoring tools (metadata-tools, blueprint-tools,
// package-tools, and the create-object / add-field / *-metadata.tool surfaces)
// moved to the cloud-only @objectstack/service-ai-studio package.
