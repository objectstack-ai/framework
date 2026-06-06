// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * mcp-http-tools — object CRUD exposed as MCP tools for the HTTP transport.
 *
 * These are the tools an external agent (Claude Desktop / Cursor) drives over
 * the network. Unlike the stdio bridge — which is a trusted local process —
 * the HTTP surface is reached by arbitrary callers, so every operation MUST
 * run under the caller's resolved principal. We never touch the data engine
 * directly here: all reads/writes go through an injected {@link McpDataBridge}
 * that the runtime wires to the SAME permission/RLS-enforcing path the REST
 * API uses (`callData` with the request's ExecutionContext). This module owns
 * the tool *shape*; the bridge owns *execution + security*.
 *
 * SECURITY (zero-tolerance):
 *  - System objects (`sys_*`) are NOT exposed by default — fail-closed guard on
 *    every tool that takes an object name, independent of the bridge.
 *  - The bridge is bound to the caller's principal; tools cannot widen it.
 *  - Errors are returned as tool errors (text), never thrown across the wire,
 *    and never include secrets.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface McpObjectSummary {
  name: string;
  label?: string;
  fieldCount?: number;
}

/**
 * Data access seam for the HTTP MCP tools. Implemented by the runtime/dispatcher
 * so execution flows through the existing permission + RLS path bound to the
 * caller's ExecutionContext. Every method runs AS the authenticated principal.
 */
export interface McpDataBridge {
  listObjects(): Promise<McpObjectSummary[]>;
  describeObject(name: string): Promise<unknown | null>;
  query(
    object: string,
    opts: {
      where?: Record<string, unknown>;
      fields?: string[];
      limit?: number;
      offset?: number;
      orderBy?: Array<{ field: string; order: 'asc' | 'desc' }>;
    },
  ): Promise<unknown>;
  get(object: string, id: string): Promise<unknown>;
  create(object: string, data: Record<string, unknown>): Promise<unknown>;
  update(object: string, id: string, data: Record<string, unknown>): Promise<unknown>;
  remove(object: string, id: string): Promise<unknown>;
}

export interface RegisterObjectToolsOptions {
  /** Expose `sys_*` system objects too. Default false (fail-closed). */
  allowSystemObjects?: boolean;
  /** Hard cap on `query_records` page size. Default 50. */
  maxQueryLimit?: number;
}

const DEFAULT_MAX_LIMIT = 50;

/** A `sys_`-prefixed object is a system table — off-limits to external agents. */
function isSystemObject(name: string): boolean {
  return /^sys_/i.test(name);
}

function textResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: jsonText(value) }] };
}

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true as const };
}

function jsonText(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Register the object-CRUD tool set on a fresh per-request {@link McpServer}.
 * All execution is delegated to `bridge`, which is bound to the caller's
 * principal by the runtime.
 */
export function registerObjectTools(
  server: McpServer,
  bridge: McpDataBridge,
  options: RegisterObjectToolsOptions = {},
): void {
  const allowSystem = options.allowSystemObjects === true;
  const maxLimit = options.maxQueryLimit ?? DEFAULT_MAX_LIMIT;

  /** Fail-closed object-name guard shared by every object-scoped tool. */
  const guard = (objectName: string): string | undefined => {
    if (!objectName || typeof objectName !== 'string') return 'objectName is required';
    if (!allowSystem && isSystemObject(objectName)) {
      return `Object "${objectName}" is a system object and is not exposed via MCP`;
    }
    return undefined;
  };

  server.registerTool(
    'list_objects',
    {
      description:
        'List the data objects (tables) available in this app. Returns each object\'s name, label and field count.',
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => {
      try {
        const objects = await bridge.listObjects();
        const visible = allowSystem ? objects : objects.filter((o) => !isSystemObject(o.name));
        return textResult({ objects: visible, totalCount: visible.length });
      } catch (err) {
        return errorResult(messageOf(err));
      }
    },
  );

  server.registerTool(
    'describe_object',
    {
      description:
        'Get the schema of a data object: its fields (name, type, label, required) and enabled features.',
      inputSchema: { objectName: z.string().describe('The object/table name, e.g. "task"') },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ objectName }) => {
      const bad = guard(objectName);
      if (bad) return errorResult(bad);
      try {
        const def = await bridge.describeObject(objectName);
        if (!def) return errorResult(`Object "${objectName}" not found`);
        return textResult(def);
      } catch (err) {
        return errorResult(messageOf(err));
      }
    },
  );

  server.registerTool(
    'query_records',
    {
      description:
        'Query records from an object with optional filter, field selection, sorting and pagination. ' +
        'Runs under the caller\'s permissions and row-level security.',
      inputSchema: {
        objectName: z.string().describe('The object/table name'),
        where: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Filter conditions, e.g. {"status":"open"}'),
        fields: z.array(z.string()).optional().describe('Field names to return (defaults to all)'),
        limit: z.number().int().positive().max(maxLimit).optional().describe(`Max rows (≤ ${maxLimit})`),
        offset: z.number().int().nonnegative().optional().describe('Rows to skip'),
        orderBy: z
          .array(z.object({ field: z.string(), order: z.enum(['asc', 'desc']) }))
          .optional()
          .describe('Sort order'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ objectName, where, fields, limit, offset, orderBy }) => {
      const bad = guard(objectName);
      if (bad) return errorResult(bad);
      try {
        const result = await bridge.query(objectName, {
          where,
          fields,
          limit: Math.min(limit ?? maxLimit, maxLimit),
          offset,
          orderBy,
        });
        return textResult(result);
      } catch (err) {
        return errorResult(messageOf(err));
      }
    },
  );

  server.registerTool(
    'get_record',
    {
      description: 'Fetch a single record by id.',
      inputSchema: {
        objectName: z.string().describe('The object/table name'),
        recordId: z.string().describe('The record id'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ objectName, recordId }) => {
      const bad = guard(objectName);
      if (bad) return errorResult(bad);
      try {
        const record = await bridge.get(objectName, recordId);
        if (record == null) return errorResult(`Record "${recordId}" not found in "${objectName}"`);
        return textResult(record);
      } catch (err) {
        return errorResult(messageOf(err));
      }
    },
  );

  server.registerTool(
    'create_record',
    {
      description: 'Create a new record. Runs under the caller\'s permissions and validations.',
      inputSchema: {
        objectName: z.string().describe('The object/table name'),
        data: z.record(z.string(), z.unknown()).describe('Field values for the new record'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ objectName, data }) => {
      const bad = guard(objectName);
      if (bad) return errorResult(bad);
      try {
        return textResult(await bridge.create(objectName, data));
      } catch (err) {
        return errorResult(messageOf(err));
      }
    },
  );

  server.registerTool(
    'update_record',
    {
      description: 'Update fields on an existing record by id.',
      inputSchema: {
        objectName: z.string().describe('The object/table name'),
        recordId: z.string().describe('The record id'),
        data: z.record(z.string(), z.unknown()).describe('Field values to change'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ objectName, recordId, data }) => {
      const bad = guard(objectName);
      if (bad) return errorResult(bad);
      try {
        return textResult(await bridge.update(objectName, recordId, data));
      } catch (err) {
        return errorResult(messageOf(err));
      }
    },
  );

  server.registerTool(
    'delete_record',
    {
      description: 'Delete a record by id. This is destructive.',
      inputSchema: {
        objectName: z.string().describe('The object/table name'),
        recordId: z.string().describe('The record id'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ objectName, recordId }) => {
      const bad = guard(objectName);
      if (bad) return errorResult(bad);
      try {
        return textResult(await bridge.remove(objectName, recordId));
      } catch (err) {
        return errorResult(messageOf(err));
      }
    },
  );
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as any).message);
  return String(err);
}
