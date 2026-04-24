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
  namespace: 'ai',
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

    conversation_id: Field.text({
      label: 'Conversation ID',
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
