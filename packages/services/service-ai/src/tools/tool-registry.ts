// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { AIToolDefinition, ToolCallPart, ToolResultPart } from '@objectstack/spec/contracts';

/**
 * Handler function for a registered tool.
 *
 * Receives parsed arguments and returns the tool output as a string.
 */
export type ToolHandler = (args: Record<string, unknown>) => Promise<string> | string;

/**
 * Extended ToolResultPart that carries an `isError` flag for internal
 * error-tracking in the tool-call loop.
 */
export interface ToolExecutionResult extends ToolResultPart {
  isError?: boolean;
}

/**
 * ToolRegistry — Central registry for AI-callable tools.
 *
 * Plugins register tools (metadata helpers, data queries, business actions)
 * during the `ai:ready` hook.  The AI service resolves tool calls against
 * this registry and feeds the results back to the LLM.
 */
export class ToolRegistry {
  private readonly definitions = new Map<string, AIToolDefinition>();
  private readonly handlers = new Map<string, ToolHandler>();

  /**
   * Register a tool with its definition and handler.
   * @param definition - Tool definition (name, description, parameters schema)
   * @param handler    - Async function that executes the tool
   */
  register(definition: AIToolDefinition, handler: ToolHandler): void {
    this.definitions.set(definition.name, definition);
    this.handlers.set(definition.name, handler);
  }

  /**
   * Unregister a tool by name.
   */
  unregister(name: string): void {
    this.definitions.delete(name);
    this.handlers.delete(name);
  }

  /**
   * Check whether a tool is registered.
   */
  has(name: string): boolean {
    return this.definitions.has(name);
  }

  /**
   * Get the definition for a registered tool.
   */
  getDefinition(name: string): AIToolDefinition | undefined {
    return this.definitions.get(name);
  }

  /**
   * Return all registered tool definitions.
   */
  getAll(): AIToolDefinition[] {
    return Array.from(this.definitions.values());
  }

  /** Number of registered tools. */
  get size(): number {
    return this.definitions.size;
  }

  /** All registered tool names. */
  names(): string[] {
    return Array.from(this.definitions.keys());
  }

  /**
   * Execute a tool call and return the result.
   */
  async execute(toolCall: ToolCallPart): Promise<ToolExecutionResult> {
    const handler = this.handlers.get(toolCall.toolName);
    if (!handler) {
      return {
        type: 'tool-result',
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        output: { type: 'text', value: `Tool "${toolCall.toolName}" is not registered` },
        isError: true,
      };
    }

    try {
      const args = typeof toolCall.input === 'string'
        ? JSON.parse(toolCall.input)
        : (toolCall.input as Record<string, unknown>) ?? {};
      const content = await handler(args);
      return {
        type: 'tool-result',
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        output: { type: 'text', value: content },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        type: 'tool-result',
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        output: { type: 'text', value: message },
        isError: true,
      };
    }
  }

  /**
   * Execute multiple tool calls in parallel.
   */
  async executeAll(toolCalls: ToolCallPart[]): Promise<ToolExecutionResult[]> {
    return Promise.all(toolCalls.map(tc => this.execute(tc)));
  }

  /**
   * Clear all registered tools.
   */
  clear(): void {
    this.definitions.clear();
    this.handlers.clear();
  }
}
