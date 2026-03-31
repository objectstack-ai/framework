// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { AIToolDefinition, IDataEngine, IMetadataService } from '@objectstack/spec/contracts';
import type { ToolHandler } from './tool-registry.js';
import type { ToolRegistry } from './tool-registry.js';

// ---------------------------------------------------------------------------
// Internal type aliases for metadata payloads (returned as `unknown` from
// IMetadataService — we cast to these lightweight shapes for field access).
// ---------------------------------------------------------------------------

/** Minimal shape of an object definition as returned by IMetadataService. */
interface ObjectDef {
  name: string;
  label?: string;
  fields?: Record<string, FieldDef>;
}

/** Minimal shape of a field definition inside an object. */
interface FieldDef {
  type?: string;
  label?: string;
  required?: boolean;
  reference?: string;
  options?: unknown;
}

// ---------------------------------------------------------------------------
// Data context — injected once at registration time
// ---------------------------------------------------------------------------

/**
 * Services required by the built-in data tools.
 *
 * These are provided by the kernel at `ai:ready` time and closed over
 * by the handler functions so they stay framework-agnostic.
 */
export interface DataToolContext {
  /** ObjectQL data engine for record-level operations. */
  dataEngine: IDataEngine;
  /** Metadata service for schema/object introspection. */
  metadataService: IMetadataService;
}

// ---------------------------------------------------------------------------
// Tool Definitions
// ---------------------------------------------------------------------------

/** Maximum number of records a single query may return. */
const MAX_QUERY_LIMIT = 200;

/** Default record limit when not specified. */
const DEFAULT_QUERY_LIMIT = 20;

export const LIST_OBJECTS_TOOL: AIToolDefinition = {
  name: 'list_objects',
  description: 'List all available data objects (tables) in the system. Returns object names and labels.',
  parameters: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
};

export const DESCRIBE_OBJECT_TOOL: AIToolDefinition = {
  name: 'describe_object',
  description:
    'Get the schema (fields, types, labels) of a specific data object. ' +
    'Use this to understand the structure of a table before querying it.',
  parameters: {
    type: 'object',
    properties: {
      objectName: {
        type: 'string',
        description: 'The snake_case name of the object to describe',
      },
    },
    required: ['objectName'],
    additionalProperties: false,
  },
};

export const QUERY_RECORDS_TOOL: AIToolDefinition = {
  name: 'query_records',
  description:
    'Query records from a data object with optional filters, field selection, ' +
    'sorting, and pagination. Returns an array of matching records.',
  parameters: {
    type: 'object',
    properties: {
      objectName: {
        type: 'string',
        description: 'The snake_case name of the object to query',
      },
      where: {
        type: 'object',
        description:
          'Filter conditions as key-value pairs (e.g. { "status": "active" }) ' +
          'or MongoDB-style operators (e.g. { "amount": { "$gt": 100 } })',
      },
      fields: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of field names to return (omit for all fields)',
      },
      orderBy: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            order: { type: 'string', enum: ['asc', 'desc'] },
          },
        },
        description: 'Sort order (e.g. [{ "field": "created_at", "order": "desc" }])',
      },
      limit: {
        type: 'number',
        description: `Maximum number of records to return (default ${DEFAULT_QUERY_LIMIT}, max ${MAX_QUERY_LIMIT})`,
      },
      offset: {
        type: 'number',
        description: 'Number of records to skip for pagination',
      },
    },
    required: ['objectName'],
    additionalProperties: false,
  },
};

export const GET_RECORD_TOOL: AIToolDefinition = {
  name: 'get_record',
  description: 'Get a single record by its ID from a data object.',
  parameters: {
    type: 'object',
    properties: {
      objectName: {
        type: 'string',
        description: 'The snake_case name of the object',
      },
      recordId: {
        type: 'string',
        description: 'The unique ID of the record',
      },
      fields: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of field names to return (omit for all fields)',
      },
    },
    required: ['objectName', 'recordId'],
    additionalProperties: false,
  },
};

export const AGGREGATE_DATA_TOOL: AIToolDefinition = {
  name: 'aggregate_data',
  description:
    'Perform aggregation/statistical operations on a data object. ' +
    'Supports count, sum, avg, min, max with optional groupBy and where filters.',
  parameters: {
    type: 'object',
    properties: {
      objectName: {
        type: 'string',
        description: 'The snake_case name of the object to aggregate',
      },
      aggregations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            function: {
              type: 'string',
              enum: ['count', 'sum', 'avg', 'min', 'max', 'count_distinct'],
              description: 'Aggregation function',
            },
            field: {
              type: 'string',
              description: 'Field to aggregate (optional for count)',
            },
            alias: {
              type: 'string',
              description: 'Result column alias',
            },
          },
          required: ['function', 'alias'],
        },
        description: 'Aggregation definitions',
      },
      groupBy: {
        type: 'array',
        items: { type: 'string' },
        description: 'Fields to group by',
      },
      where: {
        type: 'object',
        description: 'Filter conditions applied before aggregation',
      },
    },
    required: ['objectName', 'aggregations'],
    additionalProperties: false,
  },
};

/** All built-in data tool definitions. */
export const DATA_TOOL_DEFINITIONS: AIToolDefinition[] = [
  LIST_OBJECTS_TOOL,
  DESCRIBE_OBJECT_TOOL,
  QUERY_RECORDS_TOOL,
  GET_RECORD_TOOL,
  AGGREGATE_DATA_TOOL,
];

// ---------------------------------------------------------------------------
// Handler Factories
// ---------------------------------------------------------------------------

function createListObjectsHandler(ctx: DataToolContext): ToolHandler {
  return async () => {
    const objects = await ctx.metadataService.listObjects();
    const summary = (objects as ObjectDef[]).map(o => ({
      name: o.name,
      label: o.label ?? o.name,
    }));
    return JSON.stringify(summary);
  };
}

function createDescribeObjectHandler(ctx: DataToolContext): ToolHandler {
  return async (args) => {
    const { objectName } = args as { objectName: string };
    const objectDef = await ctx.metadataService.getObject(objectName);
    if (!objectDef) {
      return JSON.stringify({ error: `Object "${objectName}" not found` });
    }

    const def = objectDef as ObjectDef;
    const fields = def.fields ?? {};
    const fieldSummary: Record<string, Record<string, unknown>> = {};
    for (const [key, f] of Object.entries(fields)) {
      fieldSummary[key] = {
        type: f.type,
        label: f.label ?? key,
        required: f.required ?? false,
        ...(f.reference ? { reference: f.reference } : {}),
        ...(f.options ? { options: f.options } : {}),
      };
    }

    return JSON.stringify({
      name: def.name,
      label: def.label ?? def.name,
      fields: fieldSummary,
    });
  };
}

function createQueryRecordsHandler(ctx: DataToolContext): ToolHandler {
  return async (args) => {
    const {
      objectName,
      where,
      fields,
      orderBy,
      limit,
      offset,
    } = args as {
      objectName: string;
      where?: Record<string, unknown>;
      fields?: string[];
      orderBy?: Array<{ field: string; order: 'asc' | 'desc' }>;
      limit?: number;
      offset?: number;
    };

    // Validate and clamp limit to [1, MAX_QUERY_LIMIT]
    const rawLimit = limit ?? DEFAULT_QUERY_LIMIT;
    const safeLimit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_QUERY_LIMIT)
      : DEFAULT_QUERY_LIMIT;

    // Validate offset: must be a non-negative finite integer
    const safeOffset = (Number.isFinite(offset) && (offset as number) >= 0)
      ? Math.floor(offset as number)
      : undefined;

    const records = await ctx.dataEngine.find(objectName, {
      where,
      fields,
      orderBy,
      limit: safeLimit,
      offset: safeOffset,
    });

    return JSON.stringify({ count: records.length, records });
  };
}

function createGetRecordHandler(ctx: DataToolContext): ToolHandler {
  return async (args) => {
    const { objectName, recordId, fields } = args as {
      objectName: string;
      recordId: string;
      fields?: string[];
    };

    const record = await ctx.dataEngine.findOne(objectName, {
      where: { id: recordId },
      fields,
    });

    if (!record) {
      return JSON.stringify({ error: `Record "${recordId}" not found in "${objectName}"` });
    }

    return JSON.stringify(record);
  };
}

/** Aggregation function names supported by the data engine. */
type AggFn = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'count_distinct';

/** Set of valid aggregation function names for runtime validation. */
const VALID_AGG_FUNCTIONS = new Set<string>([
  'count', 'sum', 'avg', 'min', 'max', 'count_distinct',
]);

function createAggregateDataHandler(ctx: DataToolContext): ToolHandler {
  return async (args) => {
    const { objectName, aggregations, groupBy, where } = args as {
      objectName: string;
      aggregations: Array<{ function: string; field?: string; alias: string }>;
      groupBy?: string[];
      where?: Record<string, unknown>;
    };

    // Validate aggregation functions at runtime
    for (const a of aggregations) {
      if (!VALID_AGG_FUNCTIONS.has(a.function)) {
        return JSON.stringify({
          error: `Invalid aggregation function "${a.function}". ` +
            `Allowed: ${[...VALID_AGG_FUNCTIONS].join(', ')}`,
        });
      }
    }

    const result = await ctx.dataEngine.aggregate(objectName, {
      where,
      groupBy,
      aggregations: aggregations.map(a => ({
        function: a.function as AggFn,
        field: a.field,
        alias: a.alias,
      })),
    });

    return JSON.stringify(result);
  };
}

// ---------------------------------------------------------------------------
// Public Registration Helper
// ---------------------------------------------------------------------------

/**
 * Register all built-in data tools on the given {@link ToolRegistry}.
 *
 * Typically called from the `ai:ready` hook after both the data engine
 * and metadata service are available.
 *
 * @example
 * ```ts
 * ctx.hook('ai:ready', async (aiService) => {
 *   const dataEngine = ctx.getService<IDataEngine>('data');
 *   const metadataService = ctx.getService<IMetadataService>('metadata');
 *   registerDataTools(aiService.toolRegistry, { dataEngine, metadataService });
 * });
 * ```
 */
export function registerDataTools(
  registry: ToolRegistry,
  context: DataToolContext,
): void {
  registry.register(LIST_OBJECTS_TOOL, createListObjectsHandler(context));
  registry.register(DESCRIBE_OBJECT_TOOL, createDescribeObjectHandler(context));
  registry.register(QUERY_RECORDS_TOOL, createQueryRecordsHandler(context));
  registry.register(GET_RECORD_TOOL, createGetRecordHandler(context));
  registry.register(AGGREGATE_DATA_TOOL, createAggregateDataHandler(context));
}
