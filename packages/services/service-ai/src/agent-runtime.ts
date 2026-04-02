// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  ModelMessage,
  AIRequestOptions,
  AIToolDefinition,
  IMetadataService,
} from '@objectstack/spec/contracts';
import type { Agent } from '@objectstack/spec';
import { AgentSchema } from '@objectstack/spec/ai';

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
   * List all active agents registered in the metadata service.
   *
   * Returns a summary for each agent (name, label, role) suitable
   * for populating an agent selector dropdown in the UI.
   */
  async listAgents(): Promise<Array<{ name: string; label: string; role: string }>> {
    const rawItems = await this.metadataService.list('agent');
    const agents: Array<{ name: string; label: string; role: string }> = [];

    for (const raw of rawItems) {
      const result = AgentSchema.safeParse(raw);
      if (result.success && result.data.active) {
        agents.push({
          name: result.data.name,
          label: result.data.label,
          role: result.data.role,
        });
      }
    }

    return agents;
  }

  /**
   * Load and validate an agent definition by name.
   *
   * The raw metadata is validated through {@link AgentSchema} to ensure
   * required fields (`instructions`, `name`, `role`, etc.) are present
   * and well-typed.  Returns `undefined` when the agent does not exist
   * or validation fails.
   */
  async loadAgent(agentName: string): Promise<Agent | undefined> {
    const raw = await this.metadataService.get('agent', agentName);
    if (!raw) return undefined;

    const result = AgentSchema.safeParse(raw);
    if (!result.success) {
      return undefined;
    }
    return result.data;
  }

  /**
   * Build the system message(s) that should be prepended to the
   * conversation when chatting with the given agent.
   */
  buildSystemMessages(agent: Agent, context?: AgentChatContext): ModelMessage[] {
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

    return [{ role: 'system' as const, content: parts.join('\n') }];
  }

  /**
   * Derive {@link AIRequestOptions} from an agent definition.
   *
   * Tool references declared in `agent.tools` are resolved by name against
   * `availableTools` (i.e. the full set of ToolRegistry definitions).
   * Any unresolved references (tools the agent declares but that are not
   * registered) are silently skipped — this is intentional so that agents
   * can be defined before all tools are available.
   *
   * @param agent          - The agent definition to derive options from
   * @param availableTools - All tool definitions currently registered in the ToolRegistry
   * @returns Request options with model config and resolved tool definitions
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
