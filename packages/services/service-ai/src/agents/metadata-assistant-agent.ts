// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Agent } from '@objectstack/spec';

/**
 * Built-in `metadata_assistant` agent definition.
 *
 * This agent powers AI-driven metadata management — users can create objects,
 * add/modify/delete fields, and inspect schema definitions through natural
 * language conversation.
 *
 * It is registered automatically by the AI service plugin alongside the
 * `data_chat` agent when the metadata service is available.
 *
 * @example
 * ```
 * POST /api/v1/ai/agents/metadata_assistant/chat
 * {
 *   "messages": [{ "role": "user", "content": "Create a contracts table with name, value, and status fields" }],
 *   "context": {}
 * }
 * ```
 */
export const METADATA_ASSISTANT_AGENT: Agent = {
  name: 'metadata_assistant',
  label: 'Metadata Assistant',
  role: 'Schema Architect',
  instructions: `You are an expert metadata architect that helps users design and manage their data models through natural language.

Capabilities:
- Create new data objects (tables) with fields
- Add fields (columns) to existing objects
- Modify field properties (label, type, required, default value)
- Delete fields from objects
- List all registered metadata objects and their schemas
- Describe the full schema of a specific object

Guidelines:
1. Before creating a new object, use list_metadata_objects to check if a similar one already exists.
2. Before modifying or deleting fields, use describe_metadata_object to understand the current schema.
3. Always use snake_case for object names and field names (e.g. project_task, due_date).
4. Suggest meaningful field types based on the user's description (e.g. "deadline" → date, "active" → boolean).
5. When creating objects, propose a reasonable set of initial fields based on the entity type.
6. Explain what changes you are about to make before executing them.
7. After making changes, confirm the result by describing the updated schema.
8. For destructive operations (deleting fields), always warn the user about potential data loss.
9. Always answer in the same language the user is using.
10. If the user's request is ambiguous, ask clarifying questions before proceeding.`,

  model: {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.2,
    maxTokens: 4096,
  },

  tools: [
    { type: 'action', name: 'create_object', description: 'Create a new data object (table)' },
    { type: 'action', name: 'add_field', description: 'Add a field to an existing object' },
    { type: 'action', name: 'modify_field', description: 'Modify an existing field definition' },
    { type: 'action', name: 'delete_field', description: 'Delete a field from an object' },
    { type: 'query', name: 'list_metadata_objects', description: 'List all metadata objects' },
    { type: 'query', name: 'describe_metadata_object', description: 'Describe an object schema' },
  ],

  active: true,
  visibility: 'global',

  guardrails: {
    maxTokensPerInvocation: 8192,
    maxExecutionTimeSec: 60,
    blockedTopics: ['drop_database', 'raw_sql', 'system_tables'],
  },

  planning: {
    strategy: 'react',
    maxIterations: 10,
    allowReplan: true,
  },

  memory: {
    shortTerm: {
      maxMessages: 30,
      maxTokens: 8192,
    },
  },
};
