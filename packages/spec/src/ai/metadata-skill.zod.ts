// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineSkill, type Skill } from './skill.zod';
import { METADATA_TOOL_NAMES } from './metadata-tools.zod';

// ==========================================
// Metadata Management Skill
// ==========================================

/**
 * Metadata Management Skill
 *
 * Aggregates all metadata CRUD tools into a single capability bundle
 * that can be attached to any Agent via the Agent → Skill → Tool architecture.
 *
 * This skill enables AI agents to create, modify, and inspect
 * data objects and fields through structured, permission-controlled operations.
 *
 * @example
 * ```ts
 * const agent = defineAgent({
 *   name: 'metadata_assistant',
 *   label: 'Metadata Assistant',
 *   role: 'Data Architect',
 *   instructions: 'Help users design and manage their data models.',
 *   skills: ['metadata_management'],
 * });
 * ```
 */
export const metadataManagementSkill: Skill = defineSkill({
  name: 'metadata_management',
  label: 'Metadata Management',
  description:
    'Provides AI-driven metadata operations including creating objects/tables, ' +
    'adding, modifying, and deleting fields, and inspecting schema definitions. ' +
    'Enables agents to serve as data architects and schema designers.',
  instructions:
    'You have access to metadata management tools that can create and modify data objects (tables) and their fields (columns). ' +
    'Always use `list_objects` or `describe_object` to understand the current schema before making changes. ' +
    'Use `create_object` to create new tables, `add_field` to add columns, `modify_field` to change existing columns, ' +
    'and `delete_field` to remove columns. Destructive operations (modify_field type changes, delete_field) require explicit user confirmation. ' +
    'Follow snake_case naming conventions for all machine names.',
  tools: [...METADATA_TOOL_NAMES],
  triggerPhrases: [
    'create a table',
    'create an object',
    'add a field',
    'add a column',
    'modify a field',
    'change a column',
    'delete a field',
    'remove a column',
    'list all tables',
    'list all objects',
    'describe a table',
    'show table schema',
    'show object fields',
    'design a data model',
  ],
  triggerConditions: [
    { field: 'intent', operator: 'in', value: ['schema_design', 'metadata_management', 'data_modeling'] },
  ],
  permissions: ['metadata.object.read', 'metadata.object.create', 'metadata.field.create', 'metadata.field.update', 'metadata.field.delete'],
});
