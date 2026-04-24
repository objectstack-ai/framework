// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * Audit Log Architecture
 * 
 * Comprehensive audit logging system for compliance and security.
 * Supports SOX, HIPAA, GDPR, and other regulatory requirements.
 * 
 * Features:
 * - Records all CRUD operations on data
 * - Tracks authentication events (login, logout, password reset)
 * - Monitors authorization changes (permissions, roles)
 * - Configurable retention policies (180-day GDPR requirement)
 * - Suspicious activity detection and alerting
 */

/**
 * Audit Event Type Enum
 * Categorizes different types of auditable events in the system
 */
import { lazySchema } from '../shared/lazy-schema';
export const AuditEventType = z.enum([
  // Data Operations (CRUD)
  'data.create',       // Record creation
  'data.read',         // Record retrieval/viewing
  'data.update',       // Record modification
  'data.delete',       // Record deletion
  'data.export',       // Data export operations
  'data.import',       // Data import operations
  'data.bulk_update',  // Bulk update operations
  'data.bulk_delete',  // Bulk delete operations
  
  // Authentication Events
  'auth.login',                // Successful login
  'auth.login_failed',         // Failed login attempt
  'auth.logout',               // User logout
  'auth.session_created',      // New session created
  'auth.session_expired',      // Session expiration
  'auth.password_reset',       // Password reset initiated
  'auth.password_changed',     // Password successfully changed
  'auth.email_verified',       // Email verification completed
  'auth.mfa_enabled',          // Multi-factor auth enabled
  'auth.mfa_disabled',         // Multi-factor auth disabled
  'auth.account_locked',       // Account locked (too many failures)
  'auth.account_unlocked',     // Account unlocked
  
  // Authorization Events
  'authz.permission_granted',  // Permission granted to user
  'authz.permission_revoked',  // Permission revoked from user
  'authz.role_assigned',       // Role assigned to user
  'authz.role_removed',        // Role removed from user
  'authz.role_created',        // New role created
  'authz.role_updated',        // Role permissions modified
  'authz.role_deleted',        // Role deleted
  'authz.policy_created',      // Security policy created
  'authz.policy_updated',      // Security policy updated
  'authz.policy_deleted',      // Security policy deleted
  
  // System Events
  'system.config_changed',     // System configuration modified
  'system.plugin_installed',   // Plugin installed
  'system.plugin_uninstalled', // Plugin uninstalled
  'system.backup_created',     // Backup created
  'system.backup_restored',    // Backup restored
  'system.integration_added',  // External integration added
  'system.integration_removed',// External integration removed
  
  // Security Events
  'security.access_denied',    // Access denied (authorization failure)
  'security.suspicious_activity', // Suspicious activity detected
  'security.data_breach',      // Potential data breach detected
  'security.api_key_created',  // API key created
  'security.api_key_revoked',  // API key revoked
]);

export type AuditEventType = z.infer<typeof AuditEventType>;

/**
 * Audit Event Severity Level
 * Indicates the importance/criticality of an audit event
 */
export const AuditEventSeverity = z.enum([
  'debug',      // Diagnostic information
  'info',       // Informational events (normal operations)
  'notice',     // Normal but significant events
  'warning',    // Warning conditions
  'error',      // Error conditions
  'critical',   // Critical conditions requiring immediate attention
  'alert',      // Action must be taken immediately
  'emergency',  // System is unusable
]);

export type AuditEventSeverity = z.infer<typeof AuditEventSeverity>;

/**
 * Audit Event Actor Schema
 * Identifies who/what performed the action
 */
export const AuditEventActorSchema = lazySchema(() => z.object({
  /**
   * Actor type (user, system, service, api_client, etc.)
   */
  type: z.enum(['user', 'system', 'service', 'api_client', 'integration']).describe('Actor type'),
  
  /**
   * Unique identifier for the actor
   */
  id: z.string().describe('Actor identifier'),
  
  /**
   * Display name of the actor
   */
  name: z.string().optional().describe('Actor display name'),
  
  /**
   * Email address (for user actors)
   */
  email: z.string().email().optional().describe('Actor email address'),
  
  /**
   * IP address of the actor
   */
  ipAddress: z.string().optional().describe('Actor IP address'),
  
  /**
   * User agent string (for web/API requests)
   */
  userAgent: z.string().optional().describe('User agent string'),
}));

export type AuditEventActor = z.infer<typeof AuditEventActorSchema>;

/**
 * Audit Event Target Schema
 * Identifies what was acted upon
 */
export const AuditEventTargetSchema = lazySchema(() => z.object({
  /**
   * Target type (e.g., 'object', 'record', 'user', 'role', 'config')
   */
  type: z.string().describe('Target type'),
  
  /**
   * Unique identifier for the target
   */
  id: z.string().describe('Target identifier'),
  
  /**
   * Display name of the target
   */
  name: z.string().optional().describe('Target display name'),
  
  /**
   * Additional metadata about the target
   */
  metadata: z.record(z.string(), z.unknown()).optional().describe('Target metadata'),
}));

export type AuditEventTarget = z.infer<typeof AuditEventTargetSchema>;

/**
 * Audit Event Change Schema
 * Describes what changed (for update operations)
 */
export const AuditEventChangeSchema = lazySchema(() => z.object({
  /**
   * Field/property that changed
   */
  field: z.string().describe('Changed field name'),
  
  /**
   * Value before the change
   */
  oldValue: z.unknown().optional().describe('Previous value'),
  
  /**
   * Value after the change
   */
  newValue: z.unknown().optional().describe('New value'),
}));

export type AuditEventChange = z.infer<typeof AuditEventChangeSchema>;

/**
 * Audit Event Schema
 * Complete audit event record
 */
export const AuditEventSchema = lazySchema(() => z.object({
  /**
   * Unique identifier for this audit event
   */
  id: z.string().describe('Audit event ID'),
  
  /**
   * Type of event being audited
   */
  eventType: AuditEventType.describe('Event type'),
  
  /**
   * Severity level of the event
   */
  severity: AuditEventSeverity.default('info').describe('Event severity'),
  
  /**
   * Timestamp when the event occurred (ISO 8601)
   */
  timestamp: z.string().datetime().describe('Event timestamp'),
  
  /**
   * Who/what performed the action
   */
  actor: AuditEventActorSchema.describe('Event actor'),
  
  /**
   * What was acted upon
   */
  target: AuditEventTargetSchema.optional().describe('Event target'),
  
  /**
   * Human-readable description of the action
   */
  description: z.string().describe('Event description'),
  
  /**
   * Detailed changes (for update operations)
   */
  changes: z.array(AuditEventChangeSchema).optional().describe('List of changes'),
  
  /**
   * Result of the action (success, failure, partial)
   */
  result: z.enum(['success', 'failure', 'partial']).default('success').describe('Action result'),
  
  /**
   * Error message (if result is failure)
   */
  errorMessage: z.string().optional().describe('Error message'),
  
  /**
   * Tenant identifier (for multi-tenant systems)
   */
  tenantId: z.string().optional().describe('Tenant identifier'),
  
  /**
   * Request/trace ID for correlation
   */
  requestId: z.string().optional().describe('Request ID for tracing'),
  
  /**
   * Additional context and metadata
   */
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata'),
  
  /**
   * Geographic location (if available)
   */
  location: z.object({
    country: z.string().optional(),
    region: z.string().optional(),
    city: z.string().optional(),
  }).optional().describe('Geographic location'),
}));

export type AuditEvent = z.infer<typeof AuditEventSchema>;

/**
 * Audit Retention Policy Schema
 * Defines how long audit logs are retained
 */
export const AuditRetentionPolicySchema = lazySchema(() => z.object({
  /**
   * Retention period in days
   * Default: 180 days (GDPR 6-month requirement)
   */
  retentionDays: z.number().int().min(1).default(180).describe('Retention period in days'),
  
  /**
   * Whether to archive logs after retention period
   * If true, logs are moved to cold storage; if false, they are deleted
   */
  archiveAfterRetention: z.boolean().default(true).describe('Archive logs after retention period'),
  
  /**
   * Archive storage configuration
   */
  archiveStorage: z.object({
    type: z.enum(['s3', 'gcs', 'azure_blob', 'filesystem']).describe('Archive storage type'),
    endpoint: z.string().optional().describe('Storage endpoint URL'),
    bucket: z.string().optional().describe('Storage bucket/container name'),
    path: z.string().optional().describe('Storage path prefix'),
    credentials: z.record(z.string(), z.unknown()).optional().describe('Storage credentials'),
  }).optional().describe('Archive storage configuration'),
  
  /**
   * Event types that have different retention periods
   * Overrides the default retentionDays for specific event types
   */
  customRetention: z.record(z.string(), z.number().int().positive()).optional().describe('Custom retention by event type'),
  
  /**
   * Minimum retention period for compliance
   * Prevents accidental deletion below compliance requirements
   */
  minimumRetentionDays: z.number().int().positive().optional().describe('Minimum retention for compliance'),
}));

export type AuditRetentionPolicy = z.infer<typeof AuditRetentionPolicySchema>;

/**
 * Suspicious Activity Rule Schema
 * Defines rules for detecting suspicious activities
 */
export const SuspiciousActivityRuleSchema = lazySchema(() => z.object({
  /**
   * Unique identifier for the rule
   */
  id: z.string().describe('Rule identifier'),
  
  /**
   * Rule name
   */
  name: z.string().describe('Rule name'),
  
  /**
   * Rule description
   */
  description: z.string().optional().describe('Rule description'),
  
  /**
   * Whether the rule is enabled
   */
  enabled: z.boolean().default(true).describe('Rule enabled status'),
  
  /**
   * Event types to monitor
   */
  eventTypes: z.array(AuditEventType).describe('Event types to monitor'),
  
  /**
   * Detection condition
   */
  condition: z.object({
    /**
     * Number of events that trigger the rule
     */
    threshold: z.number().int().positive().describe('Event threshold'),
    
    /**
     * Time window in seconds
     */
    windowSeconds: z.number().int().positive().describe('Time window in seconds'),
    
    /**
     * Grouping criteria (e.g., by actor.id, by ipAddress)
     */
    groupBy: z.array(z.string()).optional().describe('Grouping criteria'),
    
    /**
     * Additional filters
     */
    filters: z.record(z.string(), z.unknown()).optional().describe('Additional filters'),
  }).describe('Detection condition'),
  
  /**
   * Actions to take when rule is triggered
   */
  actions: z.array(z.enum([
    'alert',              // Send alert notification
    'lock_account',       // Lock the user account
    'block_ip',           // Block the IP address
    'require_mfa',        // Require multi-factor authentication
    'log_critical',       // Log as critical event
    'webhook',            // Call webhook
  ])).describe('Actions to take'),
  
  /**
   * Severity level for triggered alerts
   */
  alertSeverity: AuditEventSeverity.default('warning').describe('Alert severity'),
  
  /**
   * Notification configuration
   */
  notifications: z.object({
    /**
     * Email addresses to notify
     */
    email: z.array(z.string().email()).optional().describe('Email recipients'),
    
    /**
     * Slack webhook URL
     */
    slack: z.string().url().optional().describe('Slack webhook URL'),
    
    /**
     * Custom webhook URL
     */
    webhook: z.string().url().optional().describe('Custom webhook URL'),
  }).optional().describe('Notification configuration'),
}));

export type SuspiciousActivityRule = z.infer<typeof SuspiciousActivityRuleSchema>;

/**
 * Audit Log Storage Configuration
 * Defines where and how audit logs are stored
 */
export const AuditStorageConfigSchema = lazySchema(() => z.object({
  /**
   * Storage backend type
   */
  type: z.enum([
    'database',      // Store in database (PostgreSQL, MySQL, etc.)
    'elasticsearch', // Store in Elasticsearch
    'mongodb',       // Store in MongoDB
    'clickhouse',    // Store in ClickHouse (for analytics)
    's3',            // Store in S3-compatible storage
    'gcs',           // Store in Google Cloud Storage
    'azure_blob',    // Store in Azure Blob Storage
    'custom',        // Custom storage implementation
  ]).describe('Storage backend type'),
  
  /**
   * Connection string or configuration
   */
  connectionString: z.string().optional().describe('Connection string'),
  
  /**
   * Storage configuration
   */
  config: z.record(z.string(), z.unknown()).optional().describe('Storage-specific configuration'),
  
  /**
   * Whether to enable buffering/batching
   */
  bufferEnabled: z.boolean().default(true).describe('Enable buffering'),
  
  /**
   * Buffer size (number of events before flush)
   */
  bufferSize: z.number().int().positive().default(100).describe('Buffer size'),
  
  /**
   * Buffer flush interval in seconds
   */
  flushIntervalSeconds: z.number().int().positive().default(5).describe('Flush interval in seconds'),
  
  /**
   * Whether to compress stored data
   */
  compression: z.boolean().default(true).describe('Enable compression'),
}));

export type AuditStorageConfig = z.infer<typeof AuditStorageConfigSchema>;

/**
 * Audit Event Filter Schema
 * Defines filters for querying audit events
 */
export const AuditEventFilterSchema = lazySchema(() => z.object({
  /**
   * Filter by event types
   */
  eventTypes: z.array(AuditEventType).optional().describe('Event types to include'),
  
  /**
   * Filter by severity levels
   */
  severities: z.array(AuditEventSeverity).optional().describe('Severity levels to include'),
  
  /**
   * Filter by actor ID
   */
  actorId: z.string().optional().describe('Actor identifier'),
  
  /**
   * Filter by tenant ID
   */
  tenantId: z.string().optional().describe('Tenant identifier'),
  
  /**
   * Filter by time range
   */
  timeRange: z.object({
    from: z.string().datetime().describe('Start time'),
    to: z.string().datetime().describe('End time'),
  }).optional().describe('Time range filter'),
  
  /**
   * Filter by result status
   */
  result: z.enum(['success', 'failure', 'partial']).optional().describe('Result status'),
  
  /**
   * Search query (full-text search)
   */
  searchQuery: z.string().optional().describe('Search query'),
  
  /**
   * Custom filters
   */
  customFilters: z.record(z.string(), z.unknown()).optional().describe('Custom filters'),
}));

export type AuditEventFilter = z.infer<typeof AuditEventFilterSchema>;

/**
 * Complete Audit Configuration Schema
 * Main configuration for the audit system
 */
export const AuditConfigSchema = lazySchema(() => z.object({
  /**
   * Unique identifier for this audit configuration
   * Must be in snake_case following ObjectStack conventions
   * Maximum length: 64 characters
   */
  name: z.string()
    .regex(/^[a-z_][a-z0-9_]*$/)
    .max(64)
    .describe('Configuration name (snake_case, max 64 chars)'),
  
  /**
   * Human-readable label
   */
  label: z.string().describe('Display label'),
  
  /**
   * Whether audit logging is enabled
   */
  enabled: z.boolean().default(true).describe('Enable audit logging'),
  
  /**
   * Event types to audit
   * If not specified, all event types are audited
   */
  eventTypes: z.array(AuditEventType).optional().describe('Event types to audit'),
  
  /**
   * Event types to exclude from auditing
   */
  excludeEventTypes: z.array(AuditEventType).optional().describe('Event types to exclude'),
  
  /**
   * Minimum severity level to log
   * Events below this level are not logged
   */
  minimumSeverity: AuditEventSeverity.default('info').describe('Minimum severity level'),
  
  /**
   * Storage configuration
   */
  storage: AuditStorageConfigSchema.describe('Storage configuration'),
  
  /**
   * Retention policy
   */
  retentionPolicy: AuditRetentionPolicySchema.optional().describe('Retention policy'),
  
  /**
   * Suspicious activity detection rules
   */
  suspiciousActivityRules: z.array(SuspiciousActivityRuleSchema).default([]).describe('Suspicious activity rules'),
  
  /**
   * Whether to include sensitive data in audit logs
   * If false, sensitive fields are redacted/masked
   */
  includeSensitiveData: z.boolean().default(false).describe('Include sensitive data'),
  
  /**
   * Fields to redact from audit logs
   */
  redactFields: z.array(z.string()).default([
    'password',
    'passwordHash',
    'token',
    'apiKey',
    'secret',
    'creditCard',
    'ssn',
  ]).describe('Fields to redact'),
  
  /**
   * Whether to log successful read operations
   * Can be disabled to reduce log volume
   */
  logReads: z.boolean().default(false).describe('Log read operations'),
  
  /**
   * Sampling rate for read operations (0.0 to 1.0)
   * Only applies if logReads is true
   */
  readSamplingRate: z.number().min(0).max(1).default(0.1).describe('Read sampling rate'),
  
  /**
   * Whether to log system/internal operations
   */
  logSystemEvents: z.boolean().default(true).describe('Log system events'),
  
  /**
   * Custom audit event handlers
   * Note: Function handlers are for runtime configuration only and will not be serialized to JSON Schema
   */
  customHandlers: z.array(z.object({
    eventType: AuditEventType.describe('Event type to handle'),
    handlerId: z.string().describe('Unique identifier for the handler'),
  })).optional().describe('Custom event handler references'),
  
  /**
   * Compliance mode configuration
   */
  compliance: z.object({
    /**
     * Compliance standards to enforce
     */
    standards: z.array(z.enum([
      'sox',      // Sarbanes-Oxley Act
      'hipaa',    // Health Insurance Portability and Accountability Act
      'gdpr',     // General Data Protection Regulation
      'pci_dss',  // Payment Card Industry Data Security Standard
      'iso_27001',// ISO/IEC 27001
      'fedramp',  // Federal Risk and Authorization Management Program
    ])).optional().describe('Compliance standards'),
    
    /**
     * Whether to enforce immutable audit logs
     */
    immutableLogs: z.boolean().default(true).describe('Enforce immutable logs'),
    
    /**
     * Whether to require cryptographic signing
     */
    requireSigning: z.boolean().default(false).describe('Require log signing'),
    
    /**
     * Signing key configuration
     */
    signingKey: z.string().optional().describe('Signing key'),
  }).optional().describe('Compliance configuration'),
}));

export type AuditConfig = z.infer<typeof AuditConfigSchema>;

/**
 * Default suspicious activity rules
 * Common security patterns to detect
 */
export const DEFAULT_SUSPICIOUS_ACTIVITY_RULES: SuspiciousActivityRule[] = [
  {
    id: 'multiple_failed_logins',
    name: 'Multiple Failed Login Attempts',
    description: 'Detects multiple failed login attempts from the same user or IP',
    enabled: true,
    eventTypes: ['auth.login_failed'],
    condition: {
      threshold: 5,
      windowSeconds: 600, // 10 minutes
      groupBy: ['actor.id', 'actor.ipAddress'],
    },
    actions: ['alert', 'lock_account'],
    alertSeverity: 'warning',
  },
  {
    id: 'bulk_data_export',
    name: 'Bulk Data Export',
    description: 'Detects large data export operations',
    enabled: true,
    eventTypes: ['data.export'],
    condition: {
      threshold: 3,
      windowSeconds: 3600, // 1 hour
      groupBy: ['actor.id'],
    },
    actions: ['alert', 'log_critical'],
    alertSeverity: 'warning',
  },
  {
    id: 'suspicious_permission_changes',
    name: 'Rapid Permission Changes',
    description: 'Detects rapid permission or role changes',
    enabled: true,
    eventTypes: ['authz.permission_granted', 'authz.role_assigned'],
    condition: {
      threshold: 10,
      windowSeconds: 300, // 5 minutes
      groupBy: ['actor.id'],
    },
    actions: ['alert', 'log_critical'],
    alertSeverity: 'critical',
  },
  {
    id: 'after_hours_access',
    name: 'After Hours Access',
    description: 'Detects access during non-business hours',
    enabled: false, // Disabled by default, requires time zone configuration
    eventTypes: ['auth.login'],
    condition: {
      threshold: 1,
      windowSeconds: 86400, // 24 hours
    },
    actions: ['alert'],
    alertSeverity: 'notice',
  },
];
