// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// Core service
export { AIService } from './ai-service.js';
export type { AIServiceConfig } from './ai-service.js';

// Kernel plugin
export { AIServicePlugin } from './plugin.js';
export type { AIServicePluginOptions } from './plugin.js';

// Adapters
export { MemoryLLMAdapter } from './adapters/memory-adapter.js';
export type { LLMAdapter } from './adapters/types.js';

// Conversation
export { InMemoryConversationService } from './conversation/in-memory-conversation-service.js';

// Tool registry
export { ToolRegistry } from './tools/tool-registry.js';
export type { ToolHandler } from './tools/tool-registry.js';

// Routes
export { buildAIRoutes } from './routes/ai-routes.js';
export type { RouteDefinition, RouteRequest, RouteResponse } from './routes/ai-routes.js';
