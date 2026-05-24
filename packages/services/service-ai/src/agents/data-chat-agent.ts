// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Agent } from '@objectstack/spec/ai';

/**
 * Built-in `data_chat` agent — a thin **persona** record.
 *
 * Following the platform's metadata-driven philosophy, this agent no
 * longer hardcodes the tools it can call. The capability bundle lives
 * on the `data_explorer` *skill* (see `../skills/data-explorer-skill.ts`).
 * The agent record is now just:
 *   - identity (name / label / role)
 *   - persona (system prompt)
 *   - model + safety config
 *   - skills attached → `skills: ['data_explorer']`
 *
 * To grant data-exploration powers to a different agent, just add
 * `data_explorer` to its `skills[]`. To revoke globally, set the
 * skill's `active: false` in metadata.
 *
 * @example
 * ```
 * POST /api/v1/ai/agents/data_chat/chat
 * {
 *   "messages": [{ "role": "user", "content": "Show me all active accounts" }],
 *   "context": { "objectName": "account" }
 * }
 * ```
 */
export const DATA_CHAT_AGENT: Agent = {
  name: 'data_chat',
  label: 'Data Assistant',
  role: 'Business Data Analyst',
  instructions: `You are a helpful data assistant that helps users explore and understand their business data through natural language.

Always answer in the same language the user is using. Detailed tool-usage guidance is supplied by the skills attached to this agent.`,

  model: {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.3,
    maxTokens: 4096,
  },

  // Capability bundle lives on the skill; the agent only references it.
  // `data_explorer` = read side, `actions_executor` = write side.
  skills: ['data_explorer', 'actions_executor'],

  active: true,
  visibility: 'global',

  guardrails: {
    maxTokensPerInvocation: 8192,
    maxExecutionTimeSec: 30,
    blockedTopics: ['delete_records', 'drop_table', 'alter_schema'],
  },

  planning: {
    strategy: 'react',
    maxIterations: 5,
    allowReplan: false,
  },

  memory: {
    shortTerm: {
      maxMessages: 20,
      maxTokens: 4096,
    },
  },
};

