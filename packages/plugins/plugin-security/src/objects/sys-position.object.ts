// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_position — Position definitions (ADR-0090 D3).
 *
 * A position (岗位) is the flat capability-DISTRIBUTION group: users hold
 * positions (`sys_user_position`), positions bind permission sets
 * (`sys_position_permission_set`). Positions carry no capability of their
 * own and no hierarchy — the visibility tree lives on `sys_business_unit`.
 *
 * @namespace sys
 */
export const SysPosition = ObjectSchema.create({
  name: 'sys_position',
  label: 'Position',
  pluralLabel: 'Positions',
  icon: 'shield',
  isSystem: true,
  managedBy: 'config',
  // ADR-0010 §3.7 — RBAC primitive; tenants may add custom rows
  // (created via UI / API) but the schema itself is locked.
  // ADR-0068 D3: position-DEFINITION authority follows the isolation boundary.
  // Framework-reserved built-in identities (platform_admin / org_*) and the
  // ADR-0090 D9 audience anchors (everyone / guest) are seeded with
  // `managed_by = 'system'` and MUST NOT be repurposed by a tenant; ad-hoc
  // position definitions in a shared cross-tenant kernel namespace are forbidden.
  protection: {
    lock: 'no-overlay',
    reason: 'RBAC schema is platform-defined — see ADR-0010.',
    docsUrl: 'https://docs.objectstack.ai/adr/0010-metadata-protection',
  },
  description: 'Position definitions for capability distribution (ADR-0090)',
  displayNameField: 'label',
  nameField: 'label', // [ADR-0079] canonical primary-title pointer (mirrors deprecated displayNameField)
  titleFormat: '{label}',
  highlightFields: ['label', 'name', 'active', 'is_default'],

  // Custom actions — positions drive capability distribution and are edited
  // rarely but require the four high-frequency sysadmin affordances every IdP
  // (Salesforce, ServiceNow, Okta) ships: activate/deactivate (lifecycle
  // without losing assignments), mark default (auto-assign to new users),
  // and clone (template for new positions). All operations hit the generic
  // data CRUD endpoint exposed by `apiEnabled` — no custom server route
  // required because `managedBy: 'config'` allows direct mutation.
  actions: [
    {
      name: 'activate_position',
      label: 'Activate Position',
      icon: 'circle-check',
      variant: 'secondary',
      mode: 'custom',
      locations: ['list_item', 'record_header'],
      type: 'api',
      method: 'PATCH',
      target: '/api/v1/data/sys_position/{id}',
      bodyExtra: { active: true },
      successMessage: 'Position activated',
      refreshAfter: true,
    },
    {
      name: 'deactivate_position',
      label: 'Deactivate Position',
      icon: 'circle-off',
      variant: 'danger',
      mode: 'custom',
      locations: ['list_item', 'record_header'],
      type: 'api',
      method: 'PATCH',
      target: '/api/v1/data/sys_position/{id}',
      bodyExtra: { active: false },
      confirmText: 'Deactivate this position? Users keep their assignment but the position stops granting permissions until re-activated.',
      successMessage: 'Position deactivated',
      refreshAfter: true,
    },
    {
      name: 'set_default_position',
      label: 'Set as Default',
      icon: 'star',
      variant: 'secondary',
      mode: 'custom',
      locations: ['list_item', 'record_header'],
      type: 'api',
      method: 'PATCH',
      target: '/api/v1/data/sys_position/{id}',
      bodyExtra: { is_default: true },
      confirmText: 'Make this the default position for new users? Existing users are unaffected.',
      successMessage: 'Default position updated',
      refreshAfter: true,
    },
    {
      // Clone — POST a new sys_position row pre-filled from the source. The
      // dialog asks only for the new API name / label so the operator
      // can rename atomically; permissions JSON is copied wholesale via
      // defaultFromRow.
      name: 'clone_position',
      label: 'Clone Position',
      icon: 'copy',
      variant: 'secondary',
      mode: 'custom',
      locations: ['list_item', 'record_header'],
      type: 'api',
      method: 'POST',
      target: '/api/v1/data/sys_position',
      bodyExtra: { is_default: false, active: true },
      successMessage: 'Position cloned',
      refreshAfter: true,
      params: [
        { name: 'label', label: 'New Display Name', type: 'text', required: true },
        { name: 'name', label: 'New API Name', type: 'text', required: true, helpText: 'Unique snake_case machine name' },
        { field: 'description', defaultFromRow: true },
        { field: 'permissions', defaultFromRow: true },
      ],
    },
  ],

  listViews: {
    active: {
      type: 'grid',
      name: 'active',
      label: 'Active',
      data: { provider: 'object', object: 'sys_position' },
      columns: ['label', 'name', 'is_default', 'updated_at'],
      filter: [{ field: 'active', operator: 'equals', value: true }],
      sort: [{ field: 'label', order: 'asc' }],
      pagination: { pageSize: 50 },
    },
    default_positions: {
      type: 'grid',
      name: 'default_positions',
      label: 'Default',
      data: { provider: 'object', object: 'sys_position' },
      columns: ['label', 'name', 'description', 'active'],
      filter: [{ field: 'is_default', operator: 'equals', value: true }],
      sort: [{ field: 'label', order: 'asc' }],
      pagination: { pageSize: 50 },
    },
    custom: {
      type: 'grid',
      name: 'custom',
      label: 'Custom',
      data: { provider: 'object', object: 'sys_position' },
      columns: ['label', 'name', 'active', 'updated_at'],
      filter: [{ field: 'is_default', operator: 'equals', value: false }],
      sort: [{ field: 'label', order: 'asc' }],
      pagination: { pageSize: 50 },
    },
    all_positions: {
      type: 'grid',
      name: 'all_positions',
      label: 'All',
      data: { provider: 'object', object: 'sys_position' },
      columns: ['label', 'name', 'active', 'is_default', 'updated_at'],
      sort: [{ field: 'label', order: 'asc' }],
      pagination: { pageSize: 50 },
    },
  },

  fields: {
    // ── Identity ─────────────────────────────────────────────────
    label: Field.text({
      label: 'Display Name',
      required: true,
      searchable: true,
      maxLength: 255,
      group: 'Identity',
    }),

    name: Field.text({
      label: 'API Name',
      required: true,
      searchable: true,
      maxLength: 100,
      description: 'Unique machine name for the position (e.g. sales_manager, hr_specialist)',
      group: 'Identity',
    }),

    description: Field.textarea({
      label: 'Description',
      required: false,
      group: 'Identity',
    }),

    // ── Configuration ────────────────────────────────────────────
    permissions: Field.textarea({
      label: 'Permissions',
      required: false,
      description: 'JSON-serialized array of permission strings',
      group: 'Configuration',
    }),

    // ── Status ───────────────────────────────────────────────────
    active: Field.boolean({
      label: 'Active',
      defaultValue: true,
      group: 'Status',
    }),

    is_default: Field.boolean({
      label: 'Default Position',
      defaultValue: false,
      description: 'Automatically assigned to new users',
      group: 'Status',
    }),

    // ── System ───────────────────────────────────────────────────
    // ADR-0068 D2/D3 — provenance of this row. `system` = a framework-reserved
    // built-in identity position (seeded by bootstrapBuiltinPositions); `config` =
    // stack-declared; null / `user` = tenant-created. Built-in rows are read-only.
    managed_by: Field.text({
      label: 'Managed By',
      readonly: true,
      description: 'Provenance: system (built-in) / config (declared) / user (tenant)',
      group: 'System',
    }),

    id: Field.text({
      label: 'Position ID',
      required: true,
      readonly: true,
      group: 'System',
    }),

    created_at: Field.datetime({
      label: 'Created At',
      defaultValue: 'NOW()',
      readonly: true,
      group: 'System',
    }),

    updated_at: Field.datetime({
      label: 'Updated At',
      defaultValue: 'NOW()',
      readonly: true,
      group: 'System',
    }),
  },

  indexes: [
    { fields: ['name'], unique: true },
    { fields: ['active'] },
  ],

  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update', 'delete'],
    trash: true,
    mru: true,
  },
});
