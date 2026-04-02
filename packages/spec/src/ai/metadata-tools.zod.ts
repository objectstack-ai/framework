// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineTool, type Tool } from './tool.zod';

// ==========================================
// Shared Constants
// ==========================================

/** Snake_case pattern used in JSON Schema `pattern` properties for machine names. */
const SNAKE_CASE_PATTERN = '^[a-z_][a-z0-9_]*$';

/** Supported field data types for metadata tool parameters. */
const FIELD_TYPE_ENUM = [
  'text', 'textarea', 'number', 'boolean', 'date', 'datetime',
  'select', 'lookup', 'formula', 'autonumber',
] as const;

// ==========================================
// Metadata Management Tools
// ==========================================

/**
 * Metadata Management Tools
 *
 * Platform built-in tools for AI-driven metadata operations.
 * These tools follow the Tool → Skill → Agent architecture and
 * provide structured, permission-controlled metadata CRUD capabilities.
 *
 * Each tool is defined using the `defineTool` factory to ensure
 * Zod validation at creation time.
 *
 * Tools:
 * - create_object — Create a new data object/table
 * - add_field — Add a field/column to an existing object
 * - modify_field — Modify an existing field definition
 * - delete_field — Remove a field from an object
 * - list_objects — List all registered objects/tables
 * - describe_object — Get full schema details of an object
 */

// ------------------------------------------
// create_object
// ------------------------------------------

/**
 * Create Object Tool
 *
 * Creates a new data object (table) in the metadata registry.
 * Requires `metadata.object.create` permission.
 */
export const createObjectTool: Tool = defineTool({
  name: 'create_object',
  label: 'Create Object',
  description:
    'Creates a new data object (table) with the specified name, label, and optional field definitions. ' +
    'Use this when the user wants to create a new entity, table, or data model.',
  category: 'action',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Machine name for the object (snake_case, e.g. project_task)',
        pattern: SNAKE_CASE_PATTERN,
      },
      label: {
        type: 'string',
        description: 'Human-readable display name (e.g. Project Task)',
      },
      fields: {
        type: 'array',
        description: 'Initial fields to create with the object',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Field machine name (snake_case)' },
            label: { type: 'string', description: 'Field display name' },
            type: {
              type: 'string',
              description: 'Field data type',
              enum: [...FIELD_TYPE_ENUM],
            },
            required: { type: 'boolean', description: 'Whether the field is required' },
          },
          required: ['name', 'type'],
        },
      },
      enableFeatures: {
        type: 'object',
        description: 'Object capability flags',
        properties: {
          trackHistory: { type: 'boolean', description: 'Enable change history tracking' },
          apiEnabled: { type: 'boolean', description: 'Enable REST/GraphQL API access' },
        },
      },
    },
    required: ['name', 'label'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Created object machine name' },
      label: { type: 'string', description: 'Created object display name' },
      fieldCount: { type: 'number', description: 'Number of fields created' },
    },
  },
  requiresConfirmation: true,
  permissions: ['metadata.object.create'],
  builtIn: true,
});

// ------------------------------------------
// add_field
// ------------------------------------------

/**
 * Add Field Tool
 *
 * Adds a new field/column to an existing data object.
 * Requires `metadata.field.create` permission.
 */
export const addFieldTool: Tool = defineTool({
  name: 'add_field',
  label: 'Add Field',
  description:
    'Adds a new field (column) to an existing data object. ' +
    'Use this when the user wants to add a property, column, or attribute to a table.',
  category: 'action',
  parameters: {
    type: 'object',
    properties: {
      objectName: {
        type: 'string',
        description: 'Target object machine name (snake_case)',
        pattern: SNAKE_CASE_PATTERN,
      },
      name: {
        type: 'string',
        description: 'Field machine name (snake_case, e.g. due_date)',
        pattern: SNAKE_CASE_PATTERN,
      },
      label: {
        type: 'string',
        description: 'Human-readable field label (e.g. Due Date)',
      },
      type: {
        type: 'string',
        description: 'Field data type',
        enum: [...FIELD_TYPE_ENUM],
      },
      required: {
        type: 'boolean',
        description: 'Whether the field is required',
      },
      defaultValue: {
        description: 'Default value for the field',
      },
      options: {
        type: 'array',
        description: 'Options for select/picklist fields',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            value: { type: 'string' },
          },
          required: ['label', 'value'],
        },
      },
      reference: {
        type: 'object',
        description: 'Lookup/relationship configuration',
        properties: {
          object: { type: 'string', description: 'Referenced object name (snake_case)' },
          labelField: { type: 'string', description: 'Field to display as label' },
        },
        required: ['object'],
      },
    },
    required: ['objectName', 'name', 'type'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      objectName: { type: 'string', description: 'Parent object name' },
      fieldName: { type: 'string', description: 'Created field name' },
      fieldType: { type: 'string', description: 'Created field type' },
    },
  },
  requiresConfirmation: true,
  permissions: ['metadata.field.create'],
  builtIn: true,
});

// ------------------------------------------
// modify_field
// ------------------------------------------

/**
 * Modify Field Tool
 *
 * Modifies an existing field definition on a data object.
 * Requires `metadata.field.update` permission.
 */
export const modifyFieldTool: Tool = defineTool({
  name: 'modify_field',
  label: 'Modify Field',
  description:
    'Modifies an existing field definition (label, type, required, default value, etc.) on a data object. ' +
    'Use this when the user wants to change, rename, or reconfigure a column or attribute.',
  category: 'action',
  parameters: {
    type: 'object',
    properties: {
      objectName: {
        type: 'string',
        description: 'Target object machine name (snake_case)',
        pattern: SNAKE_CASE_PATTERN,
      },
      fieldName: {
        type: 'string',
        description: 'Existing field machine name to modify (snake_case)',
        pattern: SNAKE_CASE_PATTERN,
      },
      changes: {
        type: 'object',
        description: 'Field properties to update (partial patch)',
        properties: {
          label: { type: 'string', description: 'New display label' },
          type: {
            type: 'string',
            description: 'New field type (use with caution — may cause data loss)',
            enum: [...FIELD_TYPE_ENUM],
          },
          required: { type: 'boolean', description: 'Update required constraint' },
          defaultValue: { description: 'New default value' },
        },
      },
    },
    required: ['objectName', 'fieldName', 'changes'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      objectName: { type: 'string', description: 'Parent object name' },
      fieldName: { type: 'string', description: 'Modified field name' },
      updatedProperties: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of properties that were updated',
      },
    },
  },
  requiresConfirmation: true,
  permissions: ['metadata.field.update'],
  builtIn: true,
});

// ------------------------------------------
// delete_field
// ------------------------------------------

/**
 * Delete Field Tool
 *
 * Removes a field from a data object.
 * Requires `metadata.field.delete` permission.
 */
export const deleteFieldTool: Tool = defineTool({
  name: 'delete_field',
  label: 'Delete Field',
  description:
    'Removes a field (column) from an existing data object. This is a destructive operation. ' +
    'Use this when the user explicitly wants to remove an attribute or column from a table.',
  category: 'action',
  parameters: {
    type: 'object',
    properties: {
      objectName: {
        type: 'string',
        description: 'Target object machine name (snake_case)',
        pattern: SNAKE_CASE_PATTERN,
      },
      fieldName: {
        type: 'string',
        description: 'Field machine name to delete (snake_case)',
        pattern: SNAKE_CASE_PATTERN,
      },
      confirm: {
        type: 'boolean',
        description: 'Explicit deletion confirmation (must be true)',
      },
    },
    required: ['objectName', 'fieldName'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      objectName: { type: 'string', description: 'Parent object name' },
      fieldName: { type: 'string', description: 'Deleted field name' },
      success: { type: 'boolean', description: 'Whether the deletion succeeded' },
    },
  },
  requiresConfirmation: true,
  permissions: ['metadata.field.delete'],
  builtIn: true,
});

// ------------------------------------------
// list_objects
// ------------------------------------------

/**
 * List Objects Tool
 *
 * Lists all registered data objects/tables in the current environment.
 * Requires `metadata.object.read` permission.
 */
export const listObjectsTool: Tool = defineTool({
  name: 'list_objects',
  label: 'List Objects',
  description:
    'Lists all registered data objects (tables) in the current environment. ' +
    'Use this when the user wants to see what tables, entities, or data models exist.',
  category: 'data',
  parameters: {
    type: 'object',
    properties: {
      filter: {
        type: 'string',
        description: 'Optional name or label substring to filter objects',
      },
      includeFields: {
        type: 'boolean',
        description: 'Whether to include field summaries for each object (default: false)',
      },
    },
  },
  outputSchema: {
    type: 'object',
    properties: {
      objects: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            label: { type: 'string' },
            fieldCount: { type: 'number' },
          },
        },
        description: 'List of object summaries',
      },
      totalCount: { type: 'number', description: 'Total number of objects' },
    },
  },
  permissions: ['metadata.object.read'],
  builtIn: true,
});

// ------------------------------------------
// describe_object
// ------------------------------------------

/**
 * Describe Object Tool
 *
 * Returns full schema details (fields, types, relationships) for a data object.
 * Requires `metadata.object.read` permission.
 */
export const describeObjectTool: Tool = defineTool({
  name: 'describe_object',
  label: 'Describe Object',
  description:
    'Returns the full schema details of a data object, including all fields, types, relationships, and configuration. ' +
    'Use this when the user wants to inspect or understand the structure of a specific table or entity.',
  category: 'data',
  parameters: {
    type: 'object',
    properties: {
      objectName: {
        type: 'string',
        description: 'Object machine name to describe (snake_case)',
        pattern: SNAKE_CASE_PATTERN,
      },
    },
    required: ['objectName'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Object machine name' },
      label: { type: 'string', description: 'Object display name' },
      fields: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            label: { type: 'string' },
            type: { type: 'string' },
            required: { type: 'boolean' },
          },
        },
        description: 'Full field definitions',
      },
      enableFeatures: {
        type: 'object',
        description: 'Object capability flags',
      },
    },
  },
  permissions: ['metadata.object.read'],
  builtIn: true,
});

// ==========================================
// Aggregated exports
// ==========================================

/**
 * All metadata management tools as a typed array.
 * Convenient for bulk registration in a tool registry.
 */
export const METADATA_TOOLS: readonly Tool[] = [
  createObjectTool,
  addFieldTool,
  modifyFieldTool,
  deleteFieldTool,
  listObjectsTool,
  describeObjectTool,
] as const;

/**
 * Metadata tool names as a typed array.
 * Matches the `tools` array expected by `SkillSchema`.
 */
export const METADATA_TOOL_NAMES = [
  'create_object',
  'add_field',
  'modify_field',
  'delete_field',
  'list_objects',
  'describe_object',
] as const;

export type MetadataToolName = (typeof METADATA_TOOL_NAMES)[number];
