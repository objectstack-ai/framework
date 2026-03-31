// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// Core service
export { AIService } from './ai-service.js';
export type { AIServiceConfig } from './ai-service.js';

// Kernel plugin
export { AIServicePlugin } from './plugin.js';
export type { AIServicePluginOptions } from './plugin.js';

// Adapters
export { MemoryLLMAdapter } from './adapters/memory-adapter.js';
export type { LLMAdapter } from '@objectstack/spec/contracts';

// Conversation
export { InMemoryConversationService } from './conversation/in-memory-conversation-service.js';
export { ObjectQLConversationService } from './conversation/objectql-conversation-service.js';

// Tool registry
export { ToolRegistry } from './tools/tool-registry.js';
export type { ToolHandler } from './tools/tool-registry.js';

// Data tools
export { registerDataTools, DATA_TOOL_DEFINITIONS } from './tools/data-tools.js';
export type { DataToolContext } from './tools/data-tools.js';

// Agent runtime
export { AgentRuntime } from './agent-runtime.js';
export type { AgentChatContext } from './agent-runtime.js';

// Built-in agents
export { DATA_CHAT_AGENT } from './agents/index.js';

// Object definitions
export { AiConversationObject, AiMessageObject } from './objects/index.js';

// Routes
export { buildAIRoutes } from './routes/ai-routes.js';
export { buildAgentRoutes } from './routes/agent-routes.js';
export type { RouteDefinition, RouteRequest, RouteResponse } from './routes/ai-routes.js';
