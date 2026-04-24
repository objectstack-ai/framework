// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { FieldSchema } from '../data/field.zod';
import { ObjectSchema } from '../data/object.zod';

// --- Atomic Operations ---

import { lazySchema } from '../shared/lazy-schema';
export const AddFieldOperation = z.object({
  type: z.literal('add_field'),
  objectName: z.string().describe('Target object name'),
  fieldName: z.string().describe('Name of the field to add'),
  field: FieldSchema.describe('Full field definition to add')
}).describe('Add a new field to an existing object');

export const ModifyFieldOperation = z.object({
  type: z.literal('modify_field'),
  objectName: z.string().describe('Target object name'),
  fieldName: z.string().describe('Name of the field to modify'),
  changes: z.record(z.string(), z.unknown()).describe('Partial field definition updates')
}).describe('Modify properties of an existing field');

export const RemoveFieldOperation = z.object({
  type: z.literal('remove_field'),
  objectName: z.string().describe('Target object name'),
  fieldName: z.string().describe('Name of the field to remove')
}).describe('Remove a field from an existing object');

export const CreateObjectOperation = z.object({
  type: z.literal('create_object'),
  object: ObjectSchema.describe('Full object definition to create')
}).describe('Create a new object');

export const RenameObjectOperation = z.object({
  type: z.literal('rename_object'),
  oldName: z.string().describe('Current object name'),
  newName: z.string().describe('New object name')
}).describe('Rename an existing object');

export const DeleteObjectOperation = z.object({
  type: z.literal('delete_object'),
  objectName: z.string().describe('Name of the object to delete')
}).describe('Delete an existing object');

export const ExecuteSqlOperation = z.object({
  type: z.literal('execute_sql'),
  sql: z.string().describe('Raw SQL statement to execute'),
  description: z.string().optional().describe('Human-readable description of the SQL')
}).describe('Execute a raw SQL statement');

// Union of all possible operations
export const MigrationOperationSchema = lazySchema(() => z.discriminatedUnion('type', [
  AddFieldOperation,
  ModifyFieldOperation,
  RemoveFieldOperation,
  CreateObjectOperation,
  RenameObjectOperation,
  DeleteObjectOperation,
  ExecuteSqlOperation
]));

// --- Migration & ChangeSet ---

export const MigrationDependencySchema = lazySchema(() => z.object({
  migrationId: z.string().describe('ID of the migration this depends on'),
  package: z.string().optional().describe('Package that owns the dependency migration')
}).describe('Dependency reference to another migration that must run first'));

export const ChangeSetSchema = lazySchema(() => z.object({
  id: z.string().uuid().describe('Unique identifier for this change set'),
  name: z.string().describe('Human readable name for the migration'),
  description: z.string().optional().describe('Detailed description of what this migration does'),
  author: z.string().optional().describe('Author who created this migration'),
  createdAt: z.string().datetime().optional().describe('ISO 8601 timestamp when the migration was created'),
  
  // Dependencies ensure migrations run in order
  dependencies: z.array(MigrationDependencySchema).optional().describe('Migrations that must run before this one'),
  
  // The actual atomic operations
  operations: z.array(MigrationOperationSchema).describe('Ordered list of atomic migration operations'),
  
  // Rollback operations (AI should generate these too)
  rollback: z.array(MigrationOperationSchema).optional().describe('Operations to reverse this migration')
}).describe('A versioned set of atomic schema migration operations'));

export type ChangeSet = z.infer<typeof ChangeSetSchema>;
export type MigrationOperation = z.infer<typeof MigrationOperationSchema>;
