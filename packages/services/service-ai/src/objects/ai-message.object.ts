// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * ai_messages — AI Message Object
 *
 * Stores individual messages within an AI conversation.
 * Each message belongs to a conversation via `conversation_id` foreign key.
 *
 * @namespace ai
 */
export const AiMessageObject = ObjectSchema.create({
  name: 'ai_messages',
  label: 'AI Message',
  pluralLabel: 'AI Messages',
  icon: 'message-circle',
  isSystem: true,
  description: 'Individual messages within AI conversations',

  fields: {
    id: Field.text({
      label: 'Message ID',
      required: true,
      readonly: true,
    }),

    conversation_id: Field.lookup('ai_conversations', {
      label: 'Conversation',
      required: true,
      description: 'Foreign key to ai_conversations',
    }),

    role: Field.select({
      label: 'Role',
      required: true,
      options: [
        { label: 'System', value: 'system' },
        { label: 'User', value: 'user' },
        { label: 'Assistant', value: 'assistant' },
        { label: 'Tool', value: 'tool' },
      ],
    }),

    content: Field.textarea({
      label: 'Content',
      required: true,
      description: 'Message content',
    }),

    tool_calls: Field.textarea({
      label: 'Tool Calls',
      required: false,
      description: 'JSON-serialized tool calls (when role=assistant)',
    }),

    tool_call_id: Field.text({
      label: 'Tool Call ID',
      required: false,
      maxLength: 255,
      description: 'ID of the tool call this message responds to (when role=tool)',
    }),

    // Stable per-user-turn idempotency key (ADR-0013 D1). The client mints
    // one id per user turn and re-sends it verbatim on Retry; the server
    // dedups the inbound user message by (conversation_id, turn_id) and
    // short-circuits the stored reply when the turn already completed,
    // instead of re-running the tool loop and re-planning. Null on rows
    // written before D1 (and on internal/system invocations with no turn).
    turn_id: Field.text({
      label: 'Turn ID',
      required: false,
      maxLength: 255,
      description: 'Stable per-user-turn idempotency key (ADR-0013 D1)',
    }),

    // ── Per-message observability ────────────────────────────────────
    // Populated when this message is the output of an LLM call (most
    // assistant turns). User and tool messages leave them null. Lets
    // analytics surfaces (cost per turn, latency histograms, A/B model
    // comparisons) query a single table instead of joining ai_traces
    // by timestamp.
    model: Field.text({
      label: 'Model',
      required: false,
      maxLength: 128,
      description: 'Model id reported by the adapter for the call that produced this message',
    }),

    prompt_tokens: Field.number({
      label: 'Prompt Tokens',
      required: false,
      description: 'Tokens in the request that produced this message',
    }),

    completion_tokens: Field.number({
      label: 'Completion Tokens',
      required: false,
      description: 'Tokens generated in this message',
    }),

    total_tokens: Field.number({
      label: 'Total Tokens',
      required: false,
      description: 'prompt + completion for the producing call',
    }),

    latency_ms: Field.number({
      label: 'Latency (ms)',
      required: false,
      description: 'Wall-clock duration of the LLM call that produced this message',
    }),

    created_at: Field.datetime({
      label: 'Created At',
      required: true,
      defaultValue: 'NOW()',
      readonly: true,
    }),
  },

  indexes: [
    { fields: ['conversation_id'] },
    { fields: ['conversation_id', 'created_at'] },
    { fields: ['conversation_id', 'turn_id'] },
    { fields: ['model'] },
  ],

  enable: {
    trackHistory: false,
    searchable: false,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create'],
    trash: false,
    mru: false,
  },
});
