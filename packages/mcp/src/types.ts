// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { AIToolDefinition, ToolCallPart, ToolResultPart } from '@objectstack/spec/contracts';

/**
 * Minimal ToolRegistry interface consumed by the MCP bridge.
 *
 * Matches the public API of `ToolRegistry` from `@objectstack/service-ai`
 * without creating a hard dependency on that package.
 */
export interface ToolRegistry {
  /** Return all registered tool definitions. */
  getAll(): AIToolDefinition[];

  /** Execute a tool call and return the result. */
  execute(toolCall: ToolCallPart): Promise<ToolExecutionResult>;
}

/**
 * Extended ToolResultPart with isError flag, matching service-ai's ToolExecutionResult.
 */
export interface ToolExecutionResult extends ToolResultPart {
  isError?: boolean;
}
