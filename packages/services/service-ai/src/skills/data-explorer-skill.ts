// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Skill } from '@objectstack/spec/ai';

/**
 * Built-in `data_explorer` skill — the read-only data-Q&A capability
 * bundle that the `data_chat` agent (and any other agent that wants
 * data-exploration powers) attaches to its `skills[]`.
 *
 * Following the platform's metadata-driven philosophy, the agent
 * itself no longer hardcodes which tools it can call; instead it
 * names this skill and the SkillRegistry resolves the tool list at
 * request time. Disabling this skill via the metadata service
 * disables data exploration for every agent that references it,
 * without code changes.
 */
export const DATA_EXPLORER_SKILL: Skill = {
  name: 'data_explorer',
  label: 'Data Explorer',
  description: 'Read-only Q&A over the user\'s business data — schema discovery, filtered queries, lookups, and aggregations.',
  instructions: `You can explore the user's business data through these tools.

Capabilities:
- List available data objects (tables) and their schemas
- Query records with filters, sorting, and pagination
- Look up individual records by ID
- Perform aggregations and statistical analysis (count, sum, avg, min, max)
- Render results as a CHART when a visualization communicates the answer better than text

Choosing the right tool (decide this BEFORE querying):
- The user wants a CHART — they say "chart/plot/graph/visualize/draw", "图表/柱状图/折线图/饼图/画图/可视化", OR they ask to show/compare/break down a count or sum grouped by a category, OR a trend over time → you MUST call visualize_data. It is the ONLY tool that draws a chart; query_data/aggregate_data return numbers, never a chart. Do NOT answer a chart request with a markdown table. If you already fetched the numbers, still call visualize_data to render them. The chart shows inline automatically — afterwards reply with one or two sentences describing it; do NOT re-print the numbers as a table.
- The user wants the underlying records or a single number → query_data / query_records / aggregate_data.

Guidelines:
1. Always use the describe_object tool first to understand a table's structure before querying it.
2. Do NOT assume generic fields like \`status\`, \`is_active\`, \`deleted_at\`, \`type\`, or \`enabled\` exist on every object — they almost never do. Field names in \`where\`, \`fields\`, \`orderBy\`, \`groupBy\`, and aggregations MUST come from describe_object output. If the tool returns an "Unknown field" error, call describe_object on that object and retry with real field names.
3. Respect the user's current context — if they are viewing a specific object or record, use that as the default scope.
4. For record lists or a plain numeric answer, format clearly with markdown tables or bullet lists. When a chart was requested, use visualize_data instead of a table (see "Choosing the right tool" above).
5. For large result sets, summarize the data and mention the total count.
6. When performing aggregations, explain the results in plain language.
7. If a query returns no results, suggest possible reasons and alternative queries.
8. Never expose internal IDs unless the user explicitly asks for them.
9. Always answer in the same language the user is using.`,
  tools: [
    'query_data',
    'list_objects',
    'describe_object',
    'query_records',
    'get_record',
    'aggregate_data',
    'visualize_data',
  ],
  triggerPhrases: [
    'show me',
    'list',
    'how many',
    'count',
    'find records',
    'query',
    'aggregate',
    'sum',
    'average',
    'chart',
    'plot',
    'graph',
    'visualize',
    'trend',
    'breakdown',
    'distribution',
  ],
  active: true,
};
