// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Agent } from '@objectstack/spec';

/**
 * Built-in `data_chat` agent definition.
 *
 * This agent powers the Airtable-style data conversation Chatbot.
 * It is registered automatically by the AI service plugin when a
 * data engine is available.
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

Capabilities:
- List available data objects (tables) and their schemas
- Query records with filters, sorting, and pagination
- Look up individual records by ID
- Perform aggregations and statistical analysis (count, sum, avg, min, max)

Guidelines:
1. Always use the describe_object tool first to understand a table's structure before querying it.
2. Respect the user's current context — if they are viewing a specific object or record, use that as the default scope.
3. When presenting data, format it in a clear and readable way using markdown tables or bullet lists.
4. For large result sets, summarize the data and mention the total count.
5. When performing aggregations, explain the results in plain language.
6. If a query returns no results, suggest possible reasons and alternative queries.
7. Never expose internal IDs unless the user explicitly asks for them.
8. Always answer in the same language the user is using.`,

  model: {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.3,
    maxTokens: 4096,
  },

  tools: [
    { type: 'query', name: 'list_objects', description: 'List all available data objects' },
    { type: 'query', name: 'describe_object', description: 'Get schema/fields of a data object' },
    { type: 'query', name: 'query_records', description: 'Query records with filters and pagination' },
    { type: 'query', name: 'get_record', description: 'Get a single record by ID' },
    { type: 'query', name: 'aggregate_data', description: 'Aggregate/statistics on data' },
  ],

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
