// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { AIMessage } from '@objectstack/spec/contracts';
import type { Logger } from '@objectstack/spec/contracts';
import type { AIService } from '../ai-service.js';
import type { AgentRuntime, AgentChatContext } from '../agent-runtime.js';
import type { RouteDefinition } from './ai-routes.js';

/** Valid message roles accepted by the agent routes. */
const VALID_ROLES = new Set<string>(['system', 'user', 'assistant', 'tool']);

function validateMessage(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) {
    return 'each message must be an object';
  }
  const msg = raw as Record<string, unknown>;
  if (typeof msg.role !== 'string' || !VALID_ROLES.has(msg.role)) {
    return `message.role must be one of ${[...VALID_ROLES].map(r => `"${r}"`).join(', ')}`;
  }
  if (typeof msg.content !== 'string') {
    return 'message.content must be a string';
  }
  return null;
}

/**
 * Build agent-specific REST routes.
 *
 * | Method | Path | Description |
 * |:---|:---|:---|
 * | POST | /api/v1/ai/agents/:agentName/chat | Chat with a specific agent |
 */
export function buildAgentRoutes(
  aiService: AIService,
  agentRuntime: AgentRuntime,
  logger: Logger,
): RouteDefinition[] {
  return [
    {
      method: 'POST',
      path: '/api/v1/ai/agents/:agentName/chat',
      description: 'Chat with a specific AI agent',
      handler: async (req) => {
        const agentName = req.params?.agentName;
        if (!agentName) {
          return { status: 400, body: { error: 'agentName parameter is required' } };
        }

        // Parse request body
        const {
          messages: rawMessages,
          context: chatContext,
          options: extraOptions,
        } = (req.body ?? {}) as {
          messages?: unknown[];
          context?: AgentChatContext;
          options?: Record<string, unknown>;
        };

        if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
          return { status: 400, body: { error: 'messages array is required' } };
        }

        for (const msg of rawMessages) {
          const err = validateMessage(msg);
          if (err) return { status: 400, body: { error: err } };
        }

        // Load agent definition
        const agent = await agentRuntime.loadAgent(agentName);
        if (!agent) {
          return { status: 404, body: { error: `Agent "${agentName}" not found` } };
        }
        if (!agent.active) {
          return { status: 403, body: { error: `Agent "${agentName}" is not active` } };
        }

        try {
          // Build system messages from agent instructions + UI context
          const systemMessages = agentRuntime.buildSystemMessages(agent, chatContext);

          // Resolve agent model/tools → request options
          const agentOptions = agentRuntime.buildRequestOptions(
            agent,
            aiService.toolRegistry.getAll(),
          );

          // Merge agent options with any caller overrides
          const mergedOptions = { ...agentOptions, ...extraOptions };

          // Prepend system messages then user conversation
          const fullMessages: AIMessage[] = [
            ...systemMessages,
            ...(rawMessages as AIMessage[]),
          ];

          // Use chatWithTools for automatic tool resolution
          const result = await aiService.chatWithTools(fullMessages, {
            ...mergedOptions,
            maxIterations: agent.guardrails?.maxTokensPerInvocation
              ? undefined  // let default apply
              : undefined,
          });

          return { status: 200, body: result };
        } catch (err) {
          logger.error(
            '[AI Route] /agents/:agentName/chat error',
            err instanceof Error ? err : undefined,
          );
          return { status: 500, body: { error: 'Internal AI service error' } };
        }
      },
    },
  ];
}
