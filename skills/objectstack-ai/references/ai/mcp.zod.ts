// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * Model Context Protocol (MCP)
 * 
 * Defines the protocol for connecting AI assistants to external tools, data sources,
 * and resources. MCP enables AI models to access contextual information, invoke
 * functions, and interact with external systems in a standardized way.
 * 
 * Architecture Alignment:
 * - Anthropic Model Context Protocol (MCP)
 * - OpenAI Function Calling / Tools
 * - LangChain Tool Interface
 * - Microsoft Semantic Kernel Plugins
 * 
 * Use Cases:
 * - Connect AI agents to ObjectStack data (Objects, Views, Reports)
 * - Expose business logic as callable tools (Workflows, Flows, Actions)
 * - Provide dynamic context to AI models (User profile, Recent activity)
 * - Enable AI to read and modify data through standardized interfaces
 */

// ==========================================
// MCP Transport Configuration
// ==========================================

/**
 * MCP Transport Type
 * Defines how the MCP server communicates
 */
export const MCPTransportTypeSchema = z.enum([
  'stdio',      // Standard input/output (for local processes)
  'http',       // HTTP REST API
  'websocket',  // WebSocket bidirectional communication
  'grpc',       // gRPC for high-performance communication
]);

/**
 * MCP Transport Configuration
 */
export const MCPTransportConfigSchema = z.object({
  type: MCPTransportTypeSchema,
  
  /** HTTP/WebSocket Configuration */
  url: z.string().url().optional().describe('Server URL (for HTTP/WebSocket/gRPC)'),
  headers: z.record(z.string(), z.string()).optional().describe('Custom headers for requests'),
  
  /** Authentication */
  auth: z.object({
    type: z.enum(['none', 'bearer', 'api_key', 'oauth2', 'custom']).default('none'),
    token: z.string().optional().describe('Bearer token or API key'),
    secretRef: z.string().optional().describe('Reference to stored secret'),
    headerName: z.string().optional().describe('Custom auth header name'),
  }).optional(),
  
  /** Connection Options */
  timeout: z.number().int().positive().optional().default(30000).describe('Request timeout in milliseconds'),
  retryAttempts: z.number().int().min(0).max(5).optional().default(3),
  retryDelay: z.number().int().positive().optional().default(1000).describe('Delay between retries in milliseconds'),
  
  /** STDIO Configuration */
  command: z.string().optional().describe('Command to execute (for stdio transport)'),
  args: z.array(z.string()).optional().describe('Command arguments'),
  env: z.record(z.string(), z.string()).optional().describe('Environment variables'),
  workingDirectory: z.string().optional().describe('Working directory for the process'),
});

// ==========================================
// MCP Resource Protocol
// ==========================================

/**
 * MCP Resource Type
 * Types of resources that can be exposed through MCP
 */
export const MCPResourceTypeSchema = z.enum([
  'text',       // Plain text or markdown content
  'json',       // Structured JSON data
  'binary',     // Binary data (files, images, etc.)
  'stream',     // Streaming data
]);

/**
 * MCP Resource Schema
 * Represents a piece of contextual information available to the AI
 */
export const MCPResourceSchema = z.object({
  /** Identity */
  uri: z.string().describe('Unique resource identifier (e.g., "objectstack://objects/account/ABC123")'),
  name: z.string().describe('Human-readable resource name'),
  description: z.string().optional().describe('Resource description for AI consumption'),
  
  /** Resource Type */
  mimeType: z.string().optional().describe('MIME type (e.g., "application/json", "text/plain")'),
  resourceType: MCPResourceTypeSchema.default('json'),
  
  /** Content */
  content: z.unknown().optional().describe('Resource content (for static resources)'),
  contentUrl: z.string().url().optional().describe('URL to fetch content dynamically'),
  
  /** Metadata */
  size: z.number().int().nonnegative().optional().describe('Resource size in bytes'),
  lastModified: z.string().datetime().optional().describe('Last modification timestamp (ISO 8601)'),
  tags: z.array(z.string()).optional().describe('Tags for resource categorization'),
  
  /** Access Control */
  permissions: z.object({
    read: z.boolean().default(true),
    write: z.boolean().default(false),
    delete: z.boolean().default(false),
  }).optional(),
  
  /** Caching */
  cacheable: z.boolean().default(true).describe('Whether this resource can be cached'),
  cacheMaxAge: z.number().int().nonnegative().optional().describe('Cache max age in seconds'),
});

/**
 * MCP Resource Template
 * Dynamic resource generation pattern
 */
export const MCPResourceTemplateSchema = z.object({
  uriPattern: z.string().describe('URI pattern with variables (e.g., "objectstack://objects/{objectName}/{recordId}")'),
  name: z.string().describe('Template name'),
  description: z.string().optional(),
  
  /** Parameters */
  parameters: z.array(z.object({
    name: z.string().describe('Parameter name'),
    type: z.enum(['string', 'number', 'boolean']).default('string'),
    required: z.boolean().default(true),
    description: z.string().optional(),
    pattern: z.string().optional().describe('Regex validation pattern'),
    default: z.unknown().optional(),
  })).describe('URI parameters'),
  
  /** Generation Logic */
  handler: z.string().optional().describe('Handler function name for dynamic generation'),
  
  mimeType: z.string().optional(),
  resourceType: MCPResourceTypeSchema.default('json'),
});

// ==========================================
// MCP Tool Protocol
// ==========================================

/**
 * MCP Tool Parameter Schema
 * Defines parameters for MCP tool functions
 */
export const MCPToolParameterSchema: z.ZodType<MCPToolParameter> = z.object({
  name: z.string().describe('Parameter name'),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  description: z.string().describe('Parameter description for AI consumption'),
  required: z.boolean().default(false),
  default: z.unknown().optional(),
  
  /** Validation */
  enum: z.array(z.unknown()).optional().describe('Allowed values'),
  pattern: z.string().optional().describe('Regex validation pattern (for strings)'),
  minimum: z.number().optional().describe('Minimum value (for numbers)'),
  maximum: z.number().optional().describe('Maximum value (for numbers)'),
  minLength: z.number().int().nonnegative().optional().describe('Minimum length (for strings/arrays)'),
  maxLength: z.number().int().nonnegative().optional().describe('Maximum length (for strings/arrays)'),
  
  /** Nested Schema */
  properties: z.record(z.string(), z.lazy(() => MCPToolParameterSchema)).optional().describe('Properties for object types'),
  items: z.lazy(() => MCPToolParameterSchema).optional().describe('Item schema for array types'),
});

/**
 * MCP Tool Parameter Type (inferred before schema to avoid circular reference)
 */
export type MCPToolParameter = {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  properties?: Record<string, MCPToolParameter>;
  items?: MCPToolParameter;
};

/**
 * MCP Tool Schema
 * Represents a callable function or action available to the AI
 */
export const MCPToolSchema = z.object({
  /** Identity */
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/).describe('Tool function name (snake_case)'),
  description: z.string().describe('Tool description for AI consumption (be detailed and specific)'),
  
  /** Parameters */
  parameters: z.array(MCPToolParameterSchema).describe('Tool parameters'),
  
  /** Return Type */
  returns: z.object({
    type: z.enum(['string', 'number', 'boolean', 'object', 'array', 'void']),
    description: z.string().optional(),
    schema: MCPToolParameterSchema.optional().describe('Return value schema'),
  }).optional(),
  
  /** Execution Configuration */
  handler: z.string().describe('Handler function or endpoint reference'),
  async: z.boolean().default(true).describe('Whether the tool executes asynchronously'),
  timeout: z.number().int().positive().optional().describe('Execution timeout in milliseconds'),
  
  /** Side Effects */
  sideEffects: z.enum(['none', 'read', 'write', 'delete']).default('read').describe('Tool side effects'),
  requiresConfirmation: z.boolean().default(false).describe('Require user confirmation before execution'),
  confirmationMessage: z.string().optional(),
  
  /** Examples */
  examples: z.array(z.object({
    description: z.string(),
    parameters: z.record(z.string(), z.unknown()),
    result: z.unknown().optional(),
  })).optional().describe('Usage examples for AI learning'),
  
  /** Metadata */
  category: z.string().optional().describe('Tool category (e.g., "data", "workflow", "analytics")'),
  tags: z.array(z.string()).optional(),
  deprecated: z.boolean().default(false),
  version: z.string().optional().default('1.0.0'),
});

// ==========================================
// MCP Prompt Protocol
// ==========================================

/**
 * MCP Prompt Argument
 * Dynamic arguments for prompt templates
 */
export const MCPPromptArgumentSchema = z.object({
  name: z.string().describe('Argument name'),
  description: z.string().optional(),
  type: z.enum(['string', 'number', 'boolean']).default('string'),
  required: z.boolean().default(false),
  default: z.unknown().optional(),
});

/**
 * MCP Prompt Message
 * Individual message in a prompt template
 */
export const MCPPromptMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']).describe('Message role'),
  content: z.string().describe('Message content (can include {{variable}} placeholders)'),
});

/**
 * MCP Prompt Schema
 * Predefined prompt templates available to the AI
 */
export const MCPPromptSchema = z.object({
  /** Identity */
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/).describe('Prompt template name (snake_case)'),
  description: z.string().optional().describe('Prompt description'),
  
  /** Template */
  messages: z.array(MCPPromptMessageSchema).describe('Prompt message sequence'),
  
  /** Arguments */
  arguments: z.array(MCPPromptArgumentSchema).optional().describe('Dynamic arguments for the prompt'),
  
  /** Metadata */
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  version: z.string().optional().default('1.0.0'),
});

// ==========================================
// MCP Streaming Configuration
// ==========================================

/**
 * MCP Streaming Configuration
 * Controls streaming behavior for MCP server communication
 */
export const MCPStreamingConfigSchema = z.object({
  /** Whether streaming is enabled */
  enabled: z.boolean().describe('Enable streaming for MCP communication'),

  /** Size of each streamed chunk in bytes */
  chunkSize: z.number().int().positive().optional().describe('Size of each streamed chunk in bytes'),

  /** Heartbeat interval to keep connection alive */
  heartbeatIntervalMs: z.number().int().positive().optional().default(30000).describe('Heartbeat interval in milliseconds'),

  /** Backpressure handling strategy */
  backpressure: z.enum(['drop', 'buffer', 'block']).optional().describe('Backpressure handling strategy'),
}).describe('Streaming configuration for MCP communication');

// ==========================================
// MCP Tool Approval Configuration
// ==========================================

/**
 * MCP Tool Approval Configuration
 * Controls approval requirements for tool execution
 */
export const MCPToolApprovalSchema = z.object({
  /** Whether tool execution requires approval */
  requireApproval: z.boolean().default(false).describe('Require approval before tool execution'),

  /** Strategy for handling approvals */
  approvalStrategy: z.enum(['human_in_loop', 'auto_approve', 'policy_based']).describe('Approval strategy for tool execution'),

  /** Regex patterns matching tool names that require approval */
  dangerousToolPatterns: z.array(z.string()).optional().describe('Regex patterns for tools needing approval'),

  /** Timeout in seconds for auto-approval */
  autoApproveTimeout: z.number().int().positive().optional().describe('Auto-approve timeout in seconds'),
}).describe('Tool approval configuration for MCP');

// ==========================================
// MCP Sampling Configuration
// ==========================================

/**
 * MCP Sampling Configuration
 * Controls LLM sampling behavior for MCP servers
 */
export const MCPSamplingConfigSchema = z.object({
  /** Whether sampling is enabled */
  enabled: z.boolean().describe('Enable LLM sampling'),

  /** Maximum tokens to generate */
  maxTokens: z.number().int().positive().describe('Maximum tokens to generate'),

  /** Sampling temperature */
  temperature: z.number().min(0).max(2).optional().describe('Sampling temperature'),

  /** Stop sequences to end generation */
  stopSequences: z.array(z.string()).optional().describe('Stop sequences to end generation'),

  /** Preferred model IDs in priority order */
  modelPreferences: z.array(z.string()).optional().describe('Preferred model IDs in priority order'),

  /** System prompt for sampling context */
  systemPrompt: z.string().optional().describe('System prompt for sampling context'),
}).describe('Sampling configuration for MCP');

// ==========================================
// MCP Roots Configuration
// ==========================================

/**
 * MCP Root Entry
 * A single root directory or resource available to the MCP client
 */
export const MCPRootEntrySchema = z.object({
  /** Root URI */
  uri: z.string().describe('Root URI (e.g., file:///path/to/project)'),

  /** Human-readable name for the root */
  name: z.string().optional().describe('Human-readable root name'),

  /** Whether the root is read-only */
  readOnly: z.boolean().optional().describe('Whether the root is read-only'),
}).describe('A single root directory or resource');

/**
 * MCP Roots Configuration
 * Controls filesystem/resource roots available to the MCP client
 */
export const MCPRootsConfigSchema = z.object({
  /** Root directories/resources */
  roots: z.array(MCPRootEntrySchema).describe('Root directories or resources available to the client'),

  /** Watch roots for changes */
  watchForChanges: z.boolean().default(false).describe('Watch root directories for filesystem changes'),

  /** Notify server on root changes */
  notifyOnChange: z.boolean().default(true).describe('Notify server when root contents change'),
}).describe('Roots configuration for MCP client');

// ==========================================
// MCP Server Configuration
// ==========================================

/**
 * MCP Capability
 * Features supported by the MCP server
 */
export const MCPCapabilitySchema = z.object({
  resources: z.boolean().default(false).describe('Supports resource listing and retrieval'),
  resourceTemplates: z.boolean().default(false).describe('Supports dynamic resource templates'),
  tools: z.boolean().default(false).describe('Supports tool/function calling'),
  prompts: z.boolean().default(false).describe('Supports prompt templates'),
  sampling: z.boolean().default(false).describe('Supports sampling from LLMs'),
  logging: z.boolean().default(false).describe('Supports logging and debugging'),
});

/**
 * MCP Server Info
 * Server metadata and capabilities
 */
export const MCPServerInfoSchema = z.object({
  name: z.string().describe('Server name'),
  version: z.string().describe('Server version (semver)'),
  description: z.string().optional(),
  capabilities: MCPCapabilitySchema,
  
  /** Protocol Version */
  protocolVersion: z.string().default('2024-11-05').describe('MCP protocol version'),
  
  /** Metadata */
  vendor: z.string().optional().describe('Server vendor/provider'),
  homepage: z.string().url().optional().describe('Server homepage URL'),
  documentation: z.string().url().optional().describe('Documentation URL'),
});

/**
 * MCP Server Configuration
 * Complete MCP server definition
 */
export const MCPServerConfigSchema = z.object({
  /** Identity */
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/).describe('Server unique identifier (snake_case)'),
  label: z.string().describe('Display name'),
  description: z.string().optional(),
  
  /** Server Info */
  serverInfo: MCPServerInfoSchema,
  
  /** Transport */
  transport: MCPTransportConfigSchema,
  
  /** Resources */
  resources: z.array(MCPResourceSchema).optional().describe('Static resources'),
  resourceTemplates: z.array(MCPResourceTemplateSchema).optional().describe('Dynamic resource templates'),
  
  /** Tools */
  tools: z.array(MCPToolSchema).optional().describe('Available tools'),
  
  /** Prompts */
  prompts: z.array(MCPPromptSchema).optional().describe('Prompt templates'),
  
  /** Lifecycle */
  autoStart: z.boolean().default(false).describe('Auto-start server on system boot'),
  restartOnFailure: z.boolean().default(true).describe('Auto-restart on failure'),
  healthCheck: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().int().positive().default(60000).describe('Health check interval in milliseconds'),
    timeout: z.number().int().positive().default(5000).describe('Health check timeout in milliseconds'),
    endpoint: z.string().optional().describe('Health check endpoint (for HTTP servers)'),
  }).optional(),
  
  /** Access Control */
  permissions: z.object({
    allowedAgents: z.array(z.string()).optional().describe('Agent names allowed to use this server'),
    allowedUsers: z.array(z.string()).optional().describe('User IDs allowed to use this server'),
    requireAuth: z.boolean().default(true),
  }).optional(),
  
  /** Rate Limiting */
  rateLimit: z.object({
    enabled: z.boolean().default(false),
    requestsPerMinute: z.number().int().positive().optional(),
    requestsPerHour: z.number().int().positive().optional(),
    burstSize: z.number().int().positive().optional(),
  }).optional(),
  
  /** Metadata */
  tags: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive', 'maintenance', 'deprecated']).default('active'),
  version: z.string().optional().default('1.0.0'),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),

  /** Streaming */
  streaming: MCPStreamingConfigSchema.optional().describe('Streaming configuration'),

  /** Tool Approval */
  toolApproval: MCPToolApprovalSchema.optional().describe('Tool approval configuration'),

  /** Sampling */
  sampling: MCPSamplingConfigSchema.optional().describe('LLM sampling configuration'),
});

// ==========================================
// MCP Request/Response Schemas
// ==========================================

/**
 * MCP Resource Request
 */
export const MCPResourceRequestSchema = z.object({
  uri: z.string().describe('Resource URI to fetch'),
  parameters: z.record(z.string(), z.unknown()).optional().describe('URI template parameters'),
});

/**
 * MCP Resource Response
 */
export const MCPResourceResponseSchema = z.object({
  resource: MCPResourceSchema,
  content: z.unknown().describe('Resource content'),
});

/**
 * MCP Tool Call Request
 */
export const MCPToolCallRequestSchema = z.object({
  toolName: z.string().describe('Tool to invoke'),
  parameters: z.record(z.string(), z.unknown()).describe('Tool parameters'),
  
  /** Execution Options */
  timeout: z.number().int().positive().optional(),
  confirmationProvided: z.boolean().optional().describe('User confirmation for tools that require it'),
  
  /** Context */
  context: z.object({
    userId: z.string().optional(),
    sessionId: z.string().optional(),
    agentName: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
});

/**
 * MCP Tool Call Response
 */
export const MCPToolCallResponseSchema = z.object({
  toolName: z.string(),
  status: z.enum(['success', 'error', 'timeout', 'cancelled']),
  
  /** Result */
  result: z.unknown().optional().describe('Tool execution result'),
  
  /** Error */
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }).optional(),
  
  /** Metrics */
  executionTime: z.number().nonnegative().optional().describe('Execution time in milliseconds'),
  timestamp: z.string().datetime().optional(),
});

/**
 * MCP Prompt Request
 */
export const MCPPromptRequestSchema = z.object({
  promptName: z.string().describe('Prompt template to use'),
  arguments: z.record(z.string(), z.unknown()).optional().describe('Prompt arguments'),
});

/**
 * MCP Prompt Response
 */
export const MCPPromptResponseSchema = z.object({
  promptName: z.string(),
  messages: z.array(MCPPromptMessageSchema).describe('Rendered prompt messages'),
});

// ==========================================
// MCP Client Configuration
// ==========================================

/**
 * MCP Client Configuration
 * Configuration for AI clients connecting to MCP servers
 */
export const MCPClientConfigSchema = z.object({
  /** Server Connection */
  servers: z.array(MCPServerConfigSchema).describe('MCP servers to connect to'),
  
  /** Client Settings */
  defaultTimeout: z.number().int().positive().default(30000).describe('Default timeout for requests'),
  enableCaching: z.boolean().default(true).describe('Enable client-side caching'),
  cacheMaxAge: z.number().int().nonnegative().default(300).describe('Cache max age in seconds'),
  
  /** Retry Logic */
  retryAttempts: z.number().int().min(0).max(5).default(3),
  retryDelay: z.number().int().positive().default(1000),
  
  /** Logging */
  enableLogging: z.boolean().default(true),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  /** Roots */
  roots: MCPRootsConfigSchema.optional().describe('Root directories/resources configuration'),
});

// ==========================================
// Type Exports
// ==========================================

export type MCPTransportType = z.infer<typeof MCPTransportTypeSchema>;
export type MCPTransportConfig = z.infer<typeof MCPTransportConfigSchema>;
export type MCPResourceType = z.infer<typeof MCPResourceTypeSchema>;
export type MCPResource = z.infer<typeof MCPResourceSchema>;
export type MCPResourceTemplate = z.infer<typeof MCPResourceTemplateSchema>;
// MCPToolParameter type is exported above with the schema
export type MCPTool = z.infer<typeof MCPToolSchema>;
export type MCPPromptArgument = z.infer<typeof MCPPromptArgumentSchema>;
export type MCPPromptMessage = z.infer<typeof MCPPromptMessageSchema>;
export type MCPPrompt = z.infer<typeof MCPPromptSchema>;
export type MCPCapability = z.infer<typeof MCPCapabilitySchema>;
export type MCPServerInfo = z.infer<typeof MCPServerInfoSchema>;
export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;
export type MCPResourceRequest = z.infer<typeof MCPResourceRequestSchema>;
export type MCPResourceResponse = z.infer<typeof MCPResourceResponseSchema>;
export type MCPToolCallRequest = z.infer<typeof MCPToolCallRequestSchema>;
export type MCPToolCallResponse = z.infer<typeof MCPToolCallResponseSchema>;
export type MCPPromptRequest = z.infer<typeof MCPPromptRequestSchema>;
export type MCPPromptResponse = z.infer<typeof MCPPromptResponseSchema>;
export type MCPClientConfig = z.infer<typeof MCPClientConfigSchema>;
export type MCPStreamingConfig = z.infer<typeof MCPStreamingConfigSchema>;
export type MCPToolApproval = z.infer<typeof MCPToolApprovalSchema>;
export type MCPSamplingConfig = z.infer<typeof MCPSamplingConfigSchema>;
export type MCPRootEntry = z.infer<typeof MCPRootEntrySchema>;
export type MCPRootsConfig = z.infer<typeof MCPRootsConfigSchema>;
