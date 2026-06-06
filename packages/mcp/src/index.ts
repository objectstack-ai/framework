// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @objectstack/mcp
 *
 * ObjectStack as an MCP server. Exposes your app's objects (and registered AI
 * tools, data resources, agent prompts) over the Model Context Protocol — via
 * stdio (local) and Streamable HTTP (remote agents: Claude, Cursor, Codex,
 * Gemini, Copilot, …). The inbound sibling (consuming external MCP servers) is
 * `@objectstack/connector-mcp`.
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
export {
  renderSkillMarkdown,
  OBJECTSTACK_SKILL_NAME,
  OBJECTSTACK_SKILL_DESCRIPTION,
} from './skill.js';
export type { RenderSkillOptions } from './skill.js';
