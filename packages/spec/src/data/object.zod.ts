// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { FieldSchema } from './field.zod';
import { ValidationRuleSchema } from './validation.zod';
import { StateMachineSchema } from '../automation/state-machine.zod';
import { ActionSchema } from '../ui/action.zod';

/**
 * API Operations Enum
 */
export const ApiMethod = z.enum([
  'get', 'list',          // Read
  'create', 'update', 'delete', // Write
  'upsert',               // Idempotent Write
  'bulk',                 // Batch operations
  'aggregate',            // Analytics (count, sum)
  'history',              // Audit access
  'search',               // Search access
  'restore', 'purge',     // Trash management
  'import', 'export',     // Data portability
]);
export type ApiMethod = z.infer<typeof ApiMethod>;

/**
 * Capability Flags
 * Defines what system features are enabled for this object.
 * 
 * Optimized based on industry standards (Salesforce, ServiceNow):
 * - Added `activities` (Tasks/Events)
 * - Added `mru` (Recent Items)
 * - Added `feeds` (Social/Chatter)
 * - Grouped API permissions
 * 
 * @example
 * {
 *   trackHistory: true,
 *   searchable: true,
 *   apiEnabled: true,
 *   files: true
 * }
 */
export const ObjectCapabilities = z.object({
  /** Enable history tracking (Audit Trail) */
  trackHistory: z.boolean().default(false).describe('Enable field history tracking for audit compliance'),
  
  /** Enable global search indexing */
  searchable: z.boolean().default(true).describe('Index records for global search'),
  
  /** Enable REST/GraphQL API access */
  apiEnabled: z.boolean().default(true).describe('Expose object via automatic APIs'),

  /** 
   * API Supported Operations
   * Granular control over API exposure.
   */
  apiMethods: z.array(ApiMethod).optional().describe('Whitelist of allowed API operations'),
  
  /** Enable standard attachments/files engine */
  files: z.boolean().default(false).describe('Enable file attachments and document management'),
  
  /** Enable social collaboration (Comments, Mentions, Feeds) */
  feeds: z.boolean().default(false).describe('Enable social feed, comments, and mentions (Chatter-like)'),
  
  /** Enable standard Activity suite (Tasks, Calendars, Events) */
  activities: z.boolean().default(false).describe('Enable standard tasks and events tracking'),
  
  /** Enable Recycle Bin / Soft Delete */
  trash: z.boolean().default(true).describe('Enable soft-delete with restore capability'),

  /** Enable "Recently Viewed" tracking */
  mru: z.boolean().default(true).describe('Track Most Recently Used (MRU) list for users'),
  
  /** Allow cloning records */
  clone: z.boolean().default(true).describe('Allow record deep cloning'),
});

/**
 * Schema for database indexes.
 * Enhanced with additional index types and configuration options
 * 
 * @example
 * {
 *   name: "idx_account_name",
 *   fields: ["name"],
 *   type: "btree",
 *   unique: true
 * }
 */
export const IndexSchema = z.object({
  name: z.string().optional().describe('Index name (auto-generated if not provided)'),
  fields: z.array(z.string()).describe('Fields included in the index'),
  type: z.enum(['btree', 'hash', 'gin', 'gist', 'fulltext']).optional().default('btree').describe('Index algorithm type'),
  unique: z.boolean().optional().default(false).describe('Whether the index enforces uniqueness'),
  partial: z.string().optional().describe('Partial index condition (SQL WHERE clause for conditional indexes)'),
});

/**
 * Search Configuration
 * Defines how this object behaves in search results.
 * 
 * @example
 * {
 *   fields: ["name", "email", "phone"],
 *   displayFields: ["name", "title"],
 *   filters: ["status = 'active'"]
 * }
 */
export const SearchConfigSchema = z.object({
  fields: z.array(z.string()).describe('Fields to index for full-text search weighting'),
  displayFields: z.array(z.string()).optional().describe('Fields to display in search result cards'),
  filters: z.array(z.string()).optional().describe('Default filters for search results'),
});

/**
 * Multi-Tenancy Configuration Schema
 * Configures tenant isolation strategy for SaaS applications
 * 
 * @example Shared database with tenant_id isolation
 * {
 *   enabled: true,
 *   strategy: 'shared',
 *   tenantField: 'tenant_id',
 *   crossTenantAccess: false
 * }
 */
export const TenancyConfigSchema = z.object({
  enabled: z.boolean().describe('Enable multi-tenancy for this object'),
  strategy: z.enum(['shared', 'isolated', 'hybrid']).describe('Tenant isolation strategy: shared (single DB, row-level), isolated (separate DB per tenant), hybrid (mix)'),
  tenantField: z.string().default('tenant_id').describe('Field name for tenant identifier'),
  crossTenantAccess: z.boolean().default(false).describe('Allow cross-tenant data access (with explicit permission)'),
});

/**
 * Soft Delete Configuration Schema
 * Implements recycle bin / trash functionality
 * 
 * @example Standard soft delete with cascade
 * {
 *   enabled: true,
 *   field: 'deleted_at',
 *   cascadeDelete: true
 * }
 */
export const SoftDeleteConfigSchema = z.object({
  enabled: z.boolean().describe('Enable soft delete (trash/recycle bin)'),
  field: z.string().default('deleted_at').describe('Field name for soft delete timestamp'),
  cascadeDelete: z.boolean().default(false).describe('Cascade soft delete to related records'),
});

/**
 * Versioning Configuration Schema
 * Implements record versioning and history tracking
 * 
 * @example Snapshot versioning with 90-day retention
 * {
 *   enabled: true,
 *   strategy: 'snapshot',
 *   retentionDays: 90,
 *   versionField: 'version'
 * }
 */
export const VersioningConfigSchema = z.object({
  enabled: z.boolean().describe('Enable record versioning'),
  strategy: z.enum(['snapshot', 'delta', 'event-sourcing']).describe('Versioning strategy: snapshot (full copy), delta (changes only), event-sourcing (event log)'),
  retentionDays: z.number().min(1).optional().describe('Number of days to retain old versions (undefined = infinite)'),
  versionField: z.string().default('version').describe('Field name for version number/timestamp'),
});

/**
 * Partitioning Strategy Schema
 * Configures table partitioning for performance at scale
 * 
 * @example Range partitioning by date (monthly)
 * {
 *   enabled: true,
 *   strategy: 'range',
 *   key: 'created_at',
 *   interval: '1 month'
 * }
 */
export const PartitioningConfigSchema = z.object({
  enabled: z.boolean().describe('Enable table partitioning'),
  strategy: z.enum(['range', 'hash', 'list']).describe('Partitioning strategy: range (date ranges), hash (consistent hashing), list (predefined values)'),
  key: z.string().describe('Field name to partition by'),
  interval: z.string().optional().describe('Partition interval for range strategy (e.g., "1 month", "1 year")'),
}).refine((data) => {
  // If strategy is 'range', interval must be provided
  if (data.strategy === 'range' && !data.interval) {
    return false;
  }
  return true;
}, {
  message: 'interval is required when strategy is "range"',
});

/**
 * Change Data Capture (CDC) Configuration Schema
 * Enables real-time data streaming to external systems
 * 
 * @example Stream all changes to Kafka
 * {
 *   enabled: true,
 *   events: ['insert', 'update', 'delete'],
 *   destination: 'kafka://events.objectstack'
 * }
 */
export const CDCConfigSchema = z.object({
  enabled: z.boolean().describe('Enable Change Data Capture'),
  events: z.array(z.enum(['insert', 'update', 'delete'])).describe('Event types to capture'),
  destination: z.string().describe('Destination endpoint (e.g., "kafka://topic", "webhook://url")'),
});

/**
 * Base Object Schema Definition
 * 
 * The Blueprint of a Business Object.
 * Represents a table, a collection, or a virtual entity.
 * 
 * @example
 * ```yaml
 * name: project_task
 * label: Project Task
 * icon: task
 * fields:
 *   project:
 *     type: lookup
 *     reference: project
 *   status:
 *     type: select
 *     options: [todo, in_progress, done]
 * enable:
 *   trackHistory: true
 *   files: true
 * ```
 */
const ObjectSchemaBase = z.object({
  /** 
   * Identity & Metadata 
   */
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/).describe('Machine unique key (snake_case). Immutable.'),
  label: z.string().optional().describe('Human readable singular label (e.g. "Account")'),
  pluralLabel: z.string().optional().describe('Human readable plural label (e.g. "Accounts")'),
  description: z.string().optional().describe('Developer documentation / description'),
  icon: z.string().optional().describe('Icon name (Lucide/Material) for UI representation'),
  
  /**
   * Taxonomy & Organization
   */
  tags: z.array(z.string()).optional().describe('Categorization tags (e.g. "sales", "system", "reference")'),
  active: z.boolean().optional().default(true).describe('Is the object active and usable'),
  isSystem: z.boolean().optional().default(false).describe('Is system object (protected from deletion)'),
  abstract: z.boolean().optional().default(false).describe('Is abstract base object (cannot be instantiated)'),

  /** 
   * Storage & Virtualization 
   */
  datasource: z.string().optional().default('default').describe('Target Datasource ID. "default" is the primary DB.'),
  tableName: z.string().optional().describe('Physical table/collection name in the target datasource'),
  
  /** 
   * Data Model 
   */
  fields: z.record(z.string().regex(/^[a-z_][a-z0-9_]*$/, {
    message: 'Field names must be lowercase snake_case (e.g., "first_name", "company", "annual_revenue")',
  }), FieldSchema).describe('Field definitions map. Keys must be snake_case identifiers.'),
  indexes: z.array(IndexSchema).optional().describe('Database performance indexes'),
  
  /**
   * Advanced Data Management
   */
  
  // Multi-tenancy configuration
  tenancy: TenancyConfigSchema.optional().describe('Multi-tenancy configuration for SaaS applications'),
  
  // Soft delete configuration
  softDelete: SoftDeleteConfigSchema.optional().describe('Soft delete (trash/recycle bin) configuration'),
  
  // Versioning configuration
  versioning: VersioningConfigSchema.optional().describe('Record versioning and history tracking configuration'),
  
  // Partitioning strategy
  partitioning: PartitioningConfigSchema.optional().describe('Table partitioning configuration for performance'),
  
  // Change Data Capture
  cdc: CDCConfigSchema.optional().describe('Change Data Capture (CDC) configuration for real-time data streaming'),
  
  /**
   * Logic & Validation (Co-located)
   * Best Practice: Define rules close to data.
   */
  validations: z.array(ValidationRuleSchema).optional().describe('Object-level validation rules'),
  
  /**
   * State Machine(s)
   * Named record of state machines, where each key is a unique machine identifier.
   * Multiple machines allow parallel lifecycles (e.g., status + payment_status + approval_status).
   * 
   * @example stateMachines: { lifecycle: {...}, payment: {...}, approval: {...} }
   */
  stateMachines: z.record(z.string(), StateMachineSchema).optional().describe('Named state machines for parallel lifecycles (e.g., status, payment, approval)'),

  /** 
   * Display & UI Hints (Data-Layer)
   */
  displayNameField: z.string().optional().describe('Field to use as the record display name (e.g., "name", "title"). Defaults to "name" if present.'),
  recordName: z.object({
    type: z.enum(['text', 'autonumber']).describe('Record name type: text (user-entered) or autonumber (system-generated)'),
    displayFormat: z.string().optional().describe('Auto-number format pattern (e.g., "CASE-{0000}", "INV-{YYYY}-{0000}")'),
    startNumber: z.number().int().min(0).optional().describe('Starting number for autonumber (default: 1)'),
  }).optional().describe('Record name generation configuration (Salesforce pattern)'),
  titleFormat: z.string().optional().describe('Title expression (e.g. "{name} - {code}"). Overrides displayNameField.'),
  compactLayout: z.array(z.string()).optional().describe('Primary fields for hover/cards/lookups'),
  
  /** 
   * Search Engine Config 
   */
  search: SearchConfigSchema.optional().describe('Search engine configuration'),
  
  /** 
   * System Capabilities 
   */
  enable: ObjectCapabilities.optional().describe('Enabled system features modules'),

  /** Record Types */
  recordTypes: z.array(z.string()).optional().describe('Record type names for this object'),

  /** Sharing Model */
  sharingModel: z.enum(['private', 'read', 'read_write', 'full']).optional().describe('Default sharing model'),

  /** Key Prefix */
  keyPrefix: z.string().max(5).optional().describe('Short prefix for record IDs (e.g., "001" for Account)'),

  /**
   * Object Actions
   * 
   * Actions associated with this object. Populated automatically by `defineStack()`
   * when top-level actions specify `objectName` matching this object.
   * Can also be defined directly on the object.
   * 
   * Aligns with Salesforce/ServiceNow patterns where actions are part of the
   * object schema, so API responses (e.g., `/api/v1/meta/objects/:name`)
   * include the action list without requiring downstream merge.
   */
  actions: z.array(ActionSchema).optional().describe('Actions associated with this object (auto-populated from top-level actions via objectName)'),
});

/**
 * Converts a snake_case name to a human-readable Title Case label.
 * @example snakeCaseToLabel('project_task') → 'Project Task'
 */
function snakeCaseToLabel(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Enhanced ObjectSchema with Factory
 */
export const ObjectSchema = Object.assign(ObjectSchemaBase, {
  /**
   * Type-safe factory for creating business object definitions.
   * 
   * Enhancements over raw schema:
   * - **Auto-label**: Generates `label` from `name` if not provided (snake_case → Title Case).
   * - **Validation**: Runs Zod `.parse()` to validate the config at creation time.
   * 
   * @example
   * ```ts
   * const Task = ObjectSchema.create({
   *   name: 'project_task',
   *   // label auto-generated as 'Project Task'
   *   fields: {
   *     subject: { type: 'text', label: 'Subject', required: true },
   *   },
   * });
   * ```
   */
  create: (config: z.input<typeof ObjectSchemaBase>): ServiceObject => {
    const withDefaults = {
      ...config,
      label: config.label ?? snakeCaseToLabel(config.name),
    };
    return ObjectSchemaBase.parse(withDefaults);
  },
});

export type ServiceObject = z.infer<typeof ObjectSchemaBase>;
export type ServiceObjectInput = z.input<typeof ObjectSchemaBase>;
export type ObjectCapabilities = z.infer<typeof ObjectCapabilities>;
export type ObjectIndex = z.infer<typeof IndexSchema>;
export type TenancyConfig = z.infer<typeof TenancyConfigSchema>;
export type SoftDeleteConfig = z.infer<typeof SoftDeleteConfigSchema>;
export type VersioningConfig = z.infer<typeof VersioningConfigSchema>;
export type PartitioningConfig = z.infer<typeof PartitioningConfigSchema>;
export type CDCConfig = z.infer<typeof CDCConfigSchema>;

// =================================================================
// Object Ownership Model
// =================================================================

/**
 * How a package relates to an object it references.
 * 
 * - `own`: This package is the original author/owner of the object.
 *   Only one package may own a given object name. The owner defines
 *   the base schema (table name, primary key, core fields).
 * 
 * - `extend`: This package adds fields, views, or actions to an
 *   existing object owned by another package. Multiple packages
 *   may extend the same object. Extensions are merged at boot time.
 * 
 * Follows Salesforce/ServiceNow patterns:
 *   object name = database table name, globally unique, no namespace prefix.
 */
export const ObjectOwnershipEnum = z.enum(['own', 'extend']);
export type ObjectOwnership = z.infer<typeof ObjectOwnershipEnum>;

/**
 * Object Extension Entry — used in `objectExtensions` array.
 * Declares fields/config to merge into an existing object owned by another package.
 * 
 * @example
 * ```ts
 * objectExtensions: [{
 *   extend: 'contact',               // target object FQN
 *   fields: { sales_stage: Field.select([...]) },
 * }]
 * ```
 */
export const ObjectExtensionSchema = z.object({
  /** The target object name (FQN) to extend */
  extend: z.string().describe('Target object name (FQN) to extend'),
  
  /** Fields to merge into the target object (additive) */
  fields: z.record(z.string(), FieldSchema).optional().describe('Fields to add/override'),
  
  /** Override label */
  label: z.string().optional().describe('Override label for the extended object'),
  
  /** Override plural label */
  pluralLabel: z.string().optional().describe('Override plural label for the extended object'),
  
  /** Override description */
  description: z.string().optional().describe('Override description for the extended object'),
  
  /** Additional validation rules to add */
  validations: z.array(ValidationRuleSchema).optional().describe('Additional validation rules to merge into the target object'),
  
  /** Additional indexes to add */
  indexes: z.array(IndexSchema).optional().describe('Additional indexes to merge into the target object'),
  
  /** Merge priority. Higher number applied later (wins on conflict). Default: 200 */
  priority: z.number().int().min(0).max(999).default(200).describe('Merge priority (higher = applied later)'),
});

export type ObjectExtension = z.infer<typeof ObjectExtensionSchema>;
