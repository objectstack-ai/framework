// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  AIMessage,
  AIRequestOptions,
  AIToolDefinition,
  IMetadataService,
} from '@objectstack/spec/contracts';
import type { Agent } from '@objectstack/spec';

/**
 * Context passed alongside a user message when chatting with an agent.
 *
 * UI clients set these fields to tell the agent which object, record,
 * or view the user is currently looking at so it can provide contextual
 * answers without additional tool calls.
 */
export interface AgentChatContext {
  /** Current object the user is viewing (e.g. "account") */
  objectName?: string;
  /** Currently selected record ID */
  recordId?: string;
  /** Current view name */
  viewName?: string;
}

/**
 * AgentRuntime — Resolves an agent definition into runnable chat parameters.
 *
 * Responsibilities:
 * 1. Load & validate agent metadata from the metadata service.
 * 2. Build the system prompt from agent `instructions` + UI context.
 * 3. Derive {@link AIRequestOptions} from agent `model` and `tools`.
 * 4. Map agent tool references to concrete {@link AIToolDefinition}s
 *    registered in the {@link ToolRegistry}.
 */
export class AgentRuntime {
  constructor(private readonly metadataService: IMetadataService) {}

  // ── Public API ────────────────────────────────────────────────

  /**
   * Load an agent definition by name.
   * @returns The agent definition, or `undefined` if not found.
   */
  async loadAgent(agentName: string): Promise<Agent | undefined> {
    const raw = await this.metadataService.get('agent', agentName);
    return raw as Agent | undefined;
  }

  /**
   * Build the system message(s) that should be prepended to the
   * conversation when chatting with the given agent.
   */
  buildSystemMessages(agent: Agent, context?: AgentChatContext): AIMessage[] {
    const parts: string[] = [];

    // Base instructions
    parts.push(agent.instructions);

    // Contextual hints from the user's current UI state
    if (context) {
      const ctx: string[] = [];
      if (context.objectName) ctx.push(`Current object: ${context.objectName}`);
      if (context.recordId) ctx.push(`Selected record ID: ${context.recordId}`);
      if (context.viewName) ctx.push(`Current view: ${context.viewName}`);
      if (ctx.length > 0) {
        parts.push('\n--- Current Context ---\n' + ctx.join('\n'));
      }
    }

    return [{ role: 'system', content: parts.join('\n') }];
  }

  /**
   * Derive {@link AIRequestOptions} from an agent definition.
   *
   * Tool references declared in `agent.tools` are resolved against
   * `availableTools` (i.e. the full ToolRegistry definitions).
   * Any unresolved references are silently ignored.
   */
  buildRequestOptions(
    agent: Agent,
    availableTools: AIToolDefinition[],
  ): AIRequestOptions {
    const options: AIRequestOptions = {};

    // Model config
    if (agent.model) {
      options.model = agent.model.model;
      options.temperature = agent.model.temperature;
      options.maxTokens = agent.model.maxTokens;
    }

    // Resolve agent tool references → concrete tool definitions
    if (agent.tools && agent.tools.length > 0) {
      const toolMap = new Map(availableTools.map(t => [t.name, t]));
      const resolved: AIToolDefinition[] = [];
      for (const ref of agent.tools) {
        const def = toolMap.get(ref.name);
        if (def) {
          resolved.push(def);
        }
      }
      if (resolved.length > 0) {
        options.tools = resolved;
        options.toolChoice = 'auto';
      }
    }

    return options;
  }
}
