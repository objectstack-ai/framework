// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineTool } from '@objectstack/spec/ai';

/**
 * get_metadata_schema — AI Tool Metadata (ADR-0033)
 *
 * Lets the agent READ a metadata type's canonical contract on demand: returns
 * the JSON Schema derived from the type's live Zod schema (the same schema that
 * `saveMetaItem` validates against). The AI never sees the raw spec source, so
 * without this it has to *guess* the shape of complex types (view, dashboard,
 * flow, …) and learn from validation errors by trial-and-error. Calling this
 * first lets it author a correct payload in one shot.
 *
 * Read-only: returns a schema, stages nothing.
 */
export const getMetadataSchemaTool = defineTool({
  name: 'get_metadata_schema',
  label: 'Get Metadata Schema',
  description:
    'Return the JSON Schema (contract) for a metadata type — the exact shape `create_metadata` / `update_metadata` must produce. ' +
    'ALWAYS call this BEFORE authoring a non-trivial type you are unsure about (view, dashboard, flow, report, page, …) so you get the structure right the first time instead of guessing. Read-only.',
  category: 'data',
  builtIn: true,
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Metadata type (singular), e.g. "view", "dashboard", "flow", "report", "page", "object", "app".',
      },
    },
    required: ['type'],
    additionalProperties: false,
  },
});
