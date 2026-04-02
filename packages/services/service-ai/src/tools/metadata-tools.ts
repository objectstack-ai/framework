// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { IMetadataService } from '@objectstack/spec/contracts';
import type { Tool } from '@objectstack/spec/ai';
import type { ToolHandler } from './tool-registry.js';
import type { ToolRegistry } from './tool-registry.js';

// ---------------------------------------------------------------------------
// Tool Metadata — individual .tool.ts files (single source of truth)
// ---------------------------------------------------------------------------

export { createObjectTool } from './create-object.tool.js';
export { addFieldTool } from './add-field.tool.js';
export { modifyFieldTool } from './modify-field.tool.js';
export { deleteFieldTool } from './delete-field.tool.js';
export { listMetadataObjectsTool } from './list-metadata-objects.tool.js';
export { describeMetadataObjectTool } from './describe-metadata-object.tool.js';

import { createObjectTool } from './create-object.tool.js';
import { addFieldTool } from './add-field.tool.js';
import { modifyFieldTool } from './modify-field.tool.js';
import { deleteFieldTool } from './delete-field.tool.js';
import { listMetadataObjectsTool } from './list-metadata-objects.tool.js';
import { describeMetadataObjectTool } from './describe-metadata-object.tool.js';

/** All built-in metadata management tool definitions (Tool metadata). */
export const METADATA_TOOL_DEFINITIONS: Tool[] = [
  createObjectTool,
  addFieldTool,
  modifyFieldTool,
  deleteFieldTool,
  listMetadataObjectsTool,
  describeMetadataObjectTool,
];

// ---------------------------------------------------------------------------
// Internal type aliases for metadata payloads (returned as `unknown` from
// IMetadataService — we cast to these lightweight shapes for field access).
// ---------------------------------------------------------------------------

/** Minimal shape of an object definition as returned by IMetadataService. */
interface ObjectDef {
  name: string;
  label?: string;
  fields?: Record<string, FieldDef>;
  enable?: Record<string, boolean>;
}

/** Minimal shape of a field definition inside an object. */
interface FieldDef {
  name?: string;
  type?: string;
  label?: string;
  required?: boolean;
  reference?: string;
  options?: unknown;
  defaultValue?: unknown;
}

// ---------------------------------------------------------------------------
// Shared validation helpers
// ---------------------------------------------------------------------------

/** snake_case identifier pattern (e.g. `project_task`, `due_date`). */
const SNAKE_CASE_RE = /^[a-z_][a-z0-9_]*$/;

/** Validate that a value matches snake_case. */
function isSnakeCase(value: string): boolean {
  return SNAKE_CASE_RE.test(value);
}

// ---------------------------------------------------------------------------
// Context — injected once at registration time
// ---------------------------------------------------------------------------

/**
 * Services required by the metadata management tools.
 *
 * Provided by the kernel at `ai:ready` time and closed over
 * by the handler functions so they stay framework-agnostic.
 */
export interface MetadataToolContext {
  /** Metadata service for schema CRUD operations. */
  metadataService: IMetadataService;
}

// ---------------------------------------------------------------------------
// Handler Factories
// ---------------------------------------------------------------------------

function createCreateObjectHandler(ctx: MetadataToolContext): ToolHandler {
  return async (args) => {
    const { name, label, fields, enableFeatures } = args as {
      name: string;
      label: string;
      fields?: Array<{ name: string; label?: string; type: string; required?: boolean }>;
      enableFeatures?: Record<string, boolean>;
    };

    if (!name || !label) {
      return JSON.stringify({ error: 'Both "name" and "label" are required' });
    }

    // Validate snake_case name
    if (!isSnakeCase(name)) {
      return JSON.stringify({ error: `Invalid object name "${name}". Must be snake_case.` });
    }

    // Check if the object already exists
    const existing = await ctx.metadataService.getObject(name);
    if (existing) {
      return JSON.stringify({ error: `Object "${name}" already exists` });
    }

    // Build field map from array input with per-field validation
    const fieldMap: Record<string, Record<string, unknown>> = {};
    if (fields && Array.isArray(fields)) {
      const seenNames = new Set<string>();
      for (const f of fields) {
        if (!f.name) {
          return JSON.stringify({ error: 'Each field must have a "name" property' });
        }
        if (!isSnakeCase(f.name)) {
          return JSON.stringify({ error: `Invalid field name "${f.name}". Must be snake_case.` });
        }
        if (seenNames.has(f.name)) {
          return JSON.stringify({ error: `Duplicate field name "${f.name}" in initial fields` });
        }
        seenNames.add(f.name);
        fieldMap[f.name] = {
          type: f.type,
          ...(f.label ? { label: f.label } : {}),
          ...(f.required !== undefined ? { required: f.required } : {}),
        };
      }
    }

    const objectDef: Record<string, unknown> = {
      name,
      label,
      ...(Object.keys(fieldMap).length > 0 ? { fields: fieldMap } : {}),
      ...(enableFeatures ? { enable: enableFeatures } : {}),
    };

    await ctx.metadataService.register('object', name, objectDef);

    return JSON.stringify({
      name,
      label,
      fieldCount: Object.keys(fieldMap).length,
    });
  };
}

function createAddFieldHandler(ctx: MetadataToolContext): ToolHandler {
  return async (args) => {
    const { objectName, name, label, type, required, defaultValue, options, reference } = args as {
      objectName: string;
      name: string;
      label?: string;
      type: string;
      required?: boolean;
      defaultValue?: unknown;
      options?: Array<{ label: string; value: string }>;
      reference?: string;
    };

    if (!objectName || !name || !type) {
      return JSON.stringify({ error: '"objectName", "name", and "type" are required' });
    }

    // Validate snake_case names
    if (!isSnakeCase(objectName)) {
      return JSON.stringify({ error: `Invalid object name "${objectName}". Must be snake_case.` });
    }
    if (!isSnakeCase(name)) {
      return JSON.stringify({ error: `Invalid field name "${name}". Must be snake_case.` });
    }

    // Validate reference as snake_case if provided
    if (reference && !isSnakeCase(reference)) {
      return JSON.stringify({ error: `Invalid reference "${reference}". Must be a snake_case object name.` });
    }

    // Validate select option values as snake_case if provided
    if (options && Array.isArray(options)) {
      for (const opt of options) {
        if (opt.value && !isSnakeCase(opt.value)) {
          return JSON.stringify({ error: `Invalid option value "${opt.value}". Must be lowercase snake_case.` });
        }
      }
    }

    // Verify the target object exists
    const objectDef = await ctx.metadataService.getObject(objectName);
    if (!objectDef) {
      return JSON.stringify({ error: `Object "${objectName}" not found` });
    }

    // Check if field already exists
    const def = objectDef as ObjectDef;
    if (def.fields && def.fields[name]) {
      return JSON.stringify({ error: `Field "${name}" already exists on object "${objectName}"` });
    }

    // Build new field definition
    const fieldDef: Record<string, unknown> = {
      type,
      ...(label ? { label } : {}),
      ...(required !== undefined ? { required } : {}),
      ...(defaultValue !== undefined ? { defaultValue } : {}),
      ...(options ? { options } : {}),
      ...(reference ? { reference } : {}),
    };

    // Merge the new field into the existing object definition and re-register
    const updatedFields = { ...(def.fields ?? {}), [name]: fieldDef };
    await ctx.metadataService.register('object', objectName, {
      ...def,
      fields: updatedFields,
    });

    return JSON.stringify({
      objectName,
      fieldName: name,
      fieldType: type,
    });
  };
}

function createModifyFieldHandler(ctx: MetadataToolContext): ToolHandler {
  return async (args) => {
    const { objectName, fieldName, changes } = args as {
      objectName: string;
      fieldName: string;
      changes: Record<string, unknown>;
    };

    if (!objectName || !fieldName || !changes) {
      return JSON.stringify({ error: '"objectName", "fieldName", and "changes" are required' });
    }

    // Validate snake_case names
    if (!isSnakeCase(objectName)) {
      return JSON.stringify({ error: `Invalid object name "${objectName}". Must be snake_case.` });
    }
    if (!isSnakeCase(fieldName)) {
      return JSON.stringify({ error: `Invalid field name "${fieldName}". Must be snake_case.` });
    }

    // Verify the target object exists
    const objectDef = await ctx.metadataService.getObject(objectName);
    if (!objectDef) {
      return JSON.stringify({ error: `Object "${objectName}" not found` });
    }

    const def = objectDef as ObjectDef;
    if (!def.fields || !def.fields[fieldName]) {
      return JSON.stringify({ error: `Field "${fieldName}" not found on object "${objectName}"` });
    }

    // Apply changes to the field definition
    const existingField = def.fields[fieldName];
    const updatedField = { ...existingField, ...changes };
    const updatedFields = { ...def.fields, [fieldName]: updatedField };

    await ctx.metadataService.register('object', objectName, {
      ...def,
      fields: updatedFields,
    });

    return JSON.stringify({
      objectName,
      fieldName,
      updatedProperties: Object.keys(changes),
    });
  };
}

function createDeleteFieldHandler(ctx: MetadataToolContext): ToolHandler {
  return async (args) => {
    const { objectName, fieldName } = args as {
      objectName: string;
      fieldName: string;
    };

    if (!objectName || !fieldName) {
      return JSON.stringify({ error: '"objectName" and "fieldName" are required' });
    }

    // Validate snake_case names
    if (!isSnakeCase(objectName)) {
      return JSON.stringify({ error: `Invalid object name "${objectName}". Must be snake_case.` });
    }
    if (!isSnakeCase(fieldName)) {
      return JSON.stringify({ error: `Invalid field name "${fieldName}". Must be snake_case.` });
    }

    // Verify the target object exists
    const objectDef = await ctx.metadataService.getObject(objectName);
    if (!objectDef) {
      return JSON.stringify({ error: `Object "${objectName}" not found` });
    }

    const def = objectDef as ObjectDef;
    if (!def.fields || !def.fields[fieldName]) {
      return JSON.stringify({ error: `Field "${fieldName}" not found on object "${objectName}"` });
    }

    // Remove the field and re-register
    const { [fieldName]: _removed, ...remainingFields } = def.fields;
    await ctx.metadataService.register('object', objectName, {
      ...def,
      fields: remainingFields,
    });

    return JSON.stringify({
      objectName,
      fieldName,
      success: true,
    });
  };
}

function createListObjectsHandler(ctx: MetadataToolContext): ToolHandler {
  return async (args) => {
    const { filter, includeFields } = (args ?? {}) as {
      filter?: string;
      includeFields?: boolean;
    };

    const objects = await ctx.metadataService.listObjects();
    let result = (objects as ObjectDef[]).map(o => {
      const base: Record<string, unknown> = {
        name: o.name,
        label: o.label ?? o.name,
        fieldCount: o.fields ? Object.keys(o.fields).length : 0,
      };
      if (includeFields && o.fields) {
        base.fields = Object.entries(o.fields).map(([key, f]) => ({
          name: key,
          type: f.type,
          label: f.label ?? key,
        }));
      }
      return base;
    });

    // Apply optional name/label substring filter
    if (filter) {
      const lower = filter.toLowerCase();
      result = result.filter(o =>
        (o.name as string).toLowerCase().includes(lower) ||
        (o.label as string).toLowerCase().includes(lower),
      );
    }

    return JSON.stringify({
      objects: result,
      totalCount: result.length,
    });
  };
}

function createDescribeObjectHandler(ctx: MetadataToolContext): ToolHandler {
  return async (args) => {
    const { objectName } = args as { objectName: string };

    if (!objectName) {
      return JSON.stringify({ error: '"objectName" is required' });
    }

    // Validate snake_case name
    if (!isSnakeCase(objectName)) {
      return JSON.stringify({ error: `Invalid object name "${objectName}". Must be snake_case.` });
    }

    const objectDef = await ctx.metadataService.getObject(objectName);
    if (!objectDef) {
      return JSON.stringify({ error: `Object "${objectName}" not found` });
    }

    const def = objectDef as ObjectDef;
    const fields = def.fields ?? {};
    const fieldSummary = Object.entries(fields).map(([key, f]) => ({
      name: key,
      type: f.type,
      label: f.label ?? key,
      required: f.required ?? false,
      ...(f.reference ? { reference: f.reference } : {}),
      ...(f.options ? { options: f.options } : {}),
    }));

    return JSON.stringify({
      name: def.name,
      label: def.label ?? def.name,
      fields: fieldSummary,
      enableFeatures: def.enable ?? {},
    });
  };
}

// ---------------------------------------------------------------------------
// Public Registration Helper
// ---------------------------------------------------------------------------

/**
 * Register all built-in metadata management tools on the given {@link ToolRegistry}.
 *
 * Typically called from the `ai:ready` hook after the metadata service is available.
 *
 * @example
 * ```ts
 * ctx.hook('ai:ready', async (aiService) => {
 *   const metadataService = ctx.getService<IMetadataService>('metadata');
 *   registerMetadataTools(aiService.toolRegistry, { metadataService });
 * });
 * ```
 */
export function registerMetadataTools(
  registry: ToolRegistry,
  context: MetadataToolContext,
): void {
  registry.register(createObjectTool, createCreateObjectHandler(context));
  registry.register(addFieldTool, createAddFieldHandler(context));
  registry.register(modifyFieldTool, createModifyFieldHandler(context));
  registry.register(deleteFieldTool, createDeleteFieldHandler(context));
  registry.register(listMetadataObjectsTool, createListObjectsHandler(context));
  registry.register(describeMetadataObjectTool, createDescribeObjectHandler(context));
}
