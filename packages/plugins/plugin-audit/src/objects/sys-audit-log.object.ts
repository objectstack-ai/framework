// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_audit_log — System Audit Log Object
 *
 * Immutable audit trail for all significant platform events.
 * Records who did what, when, and the before/after state.
 *
 * @namespace sys
 */
export const SysAuditLog = ObjectSchema.create({
  namespace: 'sys',
  name: 'audit_log',
  label: 'Audit Log',
  pluralLabel: 'Audit Logs',
  icon: 'scroll-text',
  isSystem: true,
  description: 'Immutable audit trail for platform events',
  titleFormat: '{action} on {object_name} by {user_id}',
  compactLayout: ['action', 'object_name', 'user_id', 'created_at'],
  
  fields: {
    id: Field.text({
      label: 'Audit Log ID',
      required: true,
      readonly: true,
    }),
    
    created_at: Field.datetime({
      label: 'Timestamp',
      required: true,
      defaultValue: 'NOW()',
      readonly: true,
    }),
    
    user_id: Field.text({
      label: 'User ID',
      required: false,
      description: 'User who performed the action (null for system actions)',
    }),
    
    action: Field.select(['create', 'update', 'delete', 'restore', 'login', 'logout', 'permission_change', 'config_change', 'export', 'import'], {
      label: 'Action',
      required: true,
    }),
    
    object_name: Field.text({
      label: 'Object Name',
      required: false,
      maxLength: 255,
      description: 'Target object (e.g. sys_user, project_task)',
    }),
    
    record_id: Field.text({
      label: 'Record ID',
      required: false,
      description: 'ID of the affected record',
    }),
    
    old_value: Field.textarea({
      label: 'Old Value',
      required: false,
      description: 'JSON-serialized previous state',
    }),
    
    new_value: Field.textarea({
      label: 'New Value',
      required: false,
      description: 'JSON-serialized new state',
    }),
    
    ip_address: Field.text({
      label: 'IP Address',
      required: false,
      maxLength: 45,
    }),
    
    user_agent: Field.textarea({
      label: 'User Agent',
      required: false,
    }),
    
    tenant_id: Field.text({
      label: 'Tenant ID',
      required: false,
      description: 'Tenant context for multi-tenant isolation',
    }),
    
    metadata: Field.textarea({
      label: 'Metadata',
      required: false,
      description: 'JSON-serialized additional context',
    }),
  },
  
  indexes: [
    { fields: ['created_at'] },
    { fields: ['user_id'] },
    { fields: ['object_name', 'record_id'] },
    { fields: ['action'] },
    { fields: ['tenant_id'] },
  ],
  
  enable: {
    trackHistory: false, // Audit logs are themselves the audit trail
    searchable: true,
    apiEnabled: true,
    apiMethods: ['get', 'list'], // Read-only — audit logs are immutable
    trash: false, // Never soft-delete audit logs
    mru: false,
    clone: false,
  },
});
