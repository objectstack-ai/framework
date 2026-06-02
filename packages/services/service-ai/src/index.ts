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
export { registerMetadataTools, METADATA_TOOL_DEFINITIONS, stageDraft } from './tools/metadata-tools.js';
export type { MetadataToolContext, StageDraftInput, StageDraftResult, DraftCapableProtocol } from './tools/metadata-tools.js';

// Blueprint tools (ADR-0033 §4 — plan-first authoring)
export { registerBlueprintTools, BLUEPRINT_TOOL_DEFINITIONS, proposeBlueprintTool, applyBlueprintTool } from './tools/blueprint-tools.js';
export type { BlueprintToolContext } from './tools/blueprint-tools.js';

// Knowledge tools
export { registerKnowledgeTools, SEARCH_KNOWLEDGE_TOOL } from './tools/knowledge-tools.js';
export type { KnowledgeToolContext } from './tools/knowledge-tools.js';

// Individual tool metadata (first-class Tool definitions via defineTool)
export {
  createObjectTool,
  addFieldTool,
  modifyFieldTool,
  deleteFieldTool,
  listObjectsTool,
  describeObjectTool,
} from './tools/metadata-tools.js';

// Package tools
export { registerPackageTools, PACKAGE_TOOL_DEFINITIONS } from './tools/package-tools.js';
export type { PackageToolContext, IPackageRegistry, IConversationService } from './tools/package-tools.js';

// Individual package tool metadata
export {
  listPackagesTool,
  getPackageTool,
  createPackageTool,
  getActivePackageTool,
  setActivePackageTool,
} from './tools/package-tools.js';

// Action tools (write-side: turn declarative Actions into AI-callable tools)
export {
  registerActionsAsTools,
  actionToToolDefinition,
  actionToolName,
  actionSkipReason,
} from './tools/action-tools.js';
export type { ActionToolsContext } from './tools/action-tools.js';

// Agent runtime
export { AgentRuntime } from './agent-runtime.js';
export type { AgentChatContext } from './agent-runtime.js';

// Skill registry (Agent → Skill → Tool composition)
export { SkillRegistry } from './skill-registry.js';
export type { SkillContext, SkillSummary } from './skill-registry.js';

// Built-in agents
export { DATA_CHAT_AGENT, METADATA_ASSISTANT_AGENT } from './agents/index.js';

// Built-in skills
export {
  DATA_EXPLORER_SKILL,
  METADATA_AUTHORING_SKILL,
  SOLUTION_DESIGN_SKILL,
  ACTIONS_EXECUTOR_SKILL,
} from './skills/index.js';

// Object definitions
export { AiConversationObject, AiMessageObject, AiTraceObject } from './objects/index.js';

// View definitions (built-in Studio surfaces)
export { AiTraceView } from './views/index.js';

// Model registry
export { ModelRegistry, computeCost } from './model-registry.js';
export type { ModelRegistryConfig, CostEstimate, TokenUsage } from './model-registry.js';

// Trace recorder
export {
  NullTraceRecorder,
  ObjectQLTraceRecorder,
  buildTraceEvent,
} from './trace-recorder.js';
export type { TraceRecorder, TraceEvent, TraceOperation } from './trace-recorder.js';

// Schema retriever (keyword-based metadata retrieval for AI prompts)
export { SchemaRetriever } from './schema-retriever.js';
export type {
  SchemaHit,
  SchemaRetrieverOptions,
  ObjectShape,
  FieldShape,
} from './schema-retriever.js';

// query_data tool (NL → ObjectQL via structured output)
export {
  QUERY_DATA_TOOL,
  createQueryDataHandler,
  registerQueryDataTool,
} from './tools/query-data.tool.js';
export type { QueryDataToolContext, QueryPlan } from './tools/query-data.tool.js';

// Routes
export { buildAIRoutes } from './routes/ai-routes.js';
export { buildAgentRoutes } from './routes/agent-routes.js';
export { buildAssistantRoutes } from './routes/assistant-routes.js';
export { buildToolRoutes } from './routes/tool-routes.js';
export type { RouteDefinition, RouteRequest, RouteResponse, RouteUserContext } from './routes/ai-routes.js';
