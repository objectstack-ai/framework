// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// Core service
export { AIService } from './ai-service.js';
export type { AIServiceConfig } from './ai-service.js';

// Kernel plugin
export { AIServicePlugin } from './plugin.js';
export type { AIServicePluginOptions } from './plugin.js';

// Adapters
export { MemoryLLMAdapter } from './adapters/memory-adapter.js';
export { VercelLLMAdapter } from './adapters/vercel-adapter.js';
export type { VercelLLMAdapterConfig } from './adapters/vercel-adapter.js';
export type { LLMAdapter } from '@objectstack/spec/contracts';

// Vercel Data Stream encoder
export { encodeStreamPart, encodeVercelDataStream } from './stream/vercel-stream-encoder.js';

// Conversation
export { InMemoryConversationService } from './conversation/in-memory-conversation-service.js';
export { ObjectQLConversationService } from './conversation/objectql-conversation-service.js';

// Tool registry
export { ToolRegistry } from './tools/tool-registry.js';
export type { ToolHandler, ToolExecutionResult } from './tools/tool-registry.js';

// Data tools
export { registerDataTools, DATA_TOOL_DEFINITIONS } from './tools/data-tools.js';
export type { DataToolContext } from './tools/data-tools.js';

// Metadata tools
export { registerMetadataTools, METADATA_TOOL_DEFINITIONS } from './tools/metadata-tools.js';
export type { MetadataToolContext } from './tools/metadata-tools.js';

// Individual tool metadata (first-class Tool definitions via defineTool)
export {
  createObjectTool,
  addFieldTool,
  modifyFieldTool,
  deleteFieldTool,
  listObjectsTool,
  describeObjectTool,
} from './tools/metadata-tools.js';

// Agent runtime
export { AgentRuntime } from './agent-runtime.js';
export type { AgentChatContext } from './agent-runtime.js';

// Built-in agents
export { DATA_CHAT_AGENT, METADATA_ASSISTANT_AGENT } from './agents/index.js';

// Object definitions
export { AiConversationObject, AiMessageObject } from './objects/index.js';

// Routes
export { buildAIRoutes } from './routes/ai-routes.js';
export { buildAgentRoutes } from './routes/agent-routes.js';
export type { RouteDefinition, RouteRequest, RouteResponse, RouteUserContext } from './routes/ai-routes.js';
