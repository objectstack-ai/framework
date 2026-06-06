// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @objectstack/plugin-mcp-server
 *
 * MCP Runtime Server Plugin for ObjectStack.
 * Exposes all registered AI tools, data resources, and agent prompts
 * via the Model Context Protocol (MCP) for use by external AI clients
 * (Claude Desktop, Cursor, VS Code Copilot, etc.).
 */

export { MCPServerPlugin } from './plugin.js';
export type { MCPServerPluginOptions } from './plugin.js';
export { MCPServerRuntime } from './mcp-server-runtime.js';
export type { MCPServerRuntimeConfig } from './mcp-server-runtime.js';
export { registerObjectTools } from './mcp-http-tools.js';
export type {
  McpDataBridge,
  McpObjectSummary,
  RegisterObjectToolsOptions,
} from './mcp-http-tools.js';
