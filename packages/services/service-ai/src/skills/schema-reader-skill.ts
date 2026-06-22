// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Skill } from '@objectstack/spec/ai';

/**
 * Built-in `schema_reader` skill — the genuinely **shared, read-only**
 * schema/query capability both kernel agents need (ADR-0064 §2).
 *
 * `surface: 'both'` is the one affinity that binds to *either* agent:
 *   - `ask` reads the schema to ground data questions before querying.
 *   - `build` reads the schema to know what already exists before authoring.
 *
 * These tools are read-only and safe to share, so they live in one place
 * instead of being dual-listed by comment across `data_explorer` (ask) and
 * the cloud authoring skills (build). Mutation/authoring tools are NEVER
 * here — they are owned only by `surface:'build'` skills, which is why `ask`
 * cannot author by construction (ADR-0064 §1).
 *
 * Note: `describe_object` / `list_objects` are materialised by the cloud
 * `@objectstack/service-ai-studio` package; on an open-source deployment
 * without it those names simply don't resolve (the registry ignores unknown
 * tool names) and `schema_reader` contributes only `query_data`. This
 * preserves the prior OSS behaviour exactly.
 */
export const SCHEMA_READER_SKILL: Skill = {
  name: 'schema_reader',
  label: 'Schema Reader',
  surface: 'both',
  description:
    "Read-only discovery of the user's data model and records — list objects, " +
    'describe an object\'s fields, and run filtered queries. Shared by both the ' +
    'data (`ask`) and authoring (`build`) agents.',
  instructions: `You can inspect the data model and read records through these tools.

- \`list_objects\` — enumerate the available data objects (tables).
- \`describe_object\` — get an object's fields and their types. ALWAYS call this before querying or referencing an object so you use real field names, not assumed ones (\`status\`, \`is_active\`, \`type\`, … almost never exist universally).
- \`query_data\` — read records with filters, sorting, and pagination.

If a tool reports an "Unknown field" error, call \`describe_object\` on that object and retry with the real field names. Always answer in the same language the user is using.`,
  tools: [
    'describe_object',
    'list_objects',
    'query_data',
  ],
  active: true,
};
