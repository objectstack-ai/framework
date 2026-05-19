// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_department — Enterprise Org-Skeleton Node
 *
 * The persistent, hierarchical org chart node. **This is distinct from
 * `sys_team`** (which is the flat better-auth collaboration grouping).
 *
 * A single tenant typically has one `kind='company'` root, then nested
 * `division` / `department` / `team` / `office` nodes underneath. The
 * `kind` enum is purely a display/categorisation hint — the recursive
 * structure works identically regardless of value.
 *
 * Drives:
 *   - `recipient_type='department'` sharing rules
 *   - `dept:` approver prefix in the approval engine
 *   - Report rollups and manager chains in CRM/PM apps
 *
 * @namespace sys
 */
export const SysDepartment = ObjectSchema.create({
  name: 'sys_department',
  label: 'Department',
  pluralLabel: 'Departments',
  icon: 'building',
  isSystem: true,
  managedBy: 'platform',
  description: 'Hierarchical org-skeleton node (department / division / business unit / office).',
  displayNameField: 'name',
  titleFormat: '{name}',
  compactLayout: ['name', 'kind', 'parent_department_id', 'manager_user_id'],

  fields: {
    // ── Identity ─────────────────────────────────────────────────
    name: Field.text({
      label: 'Name',
      required: true,
      searchable: true,
      maxLength: 255,
      group: 'Identity',
    }),

    code: Field.text({
      label: 'Code',
      required: false,
      searchable: true,
      maxLength: 64,
      description: 'Short stable code (e.g. EMEA-SALES). Unique within tenant.',
      group: 'Identity',
    }),

    kind: Field.select(
      ['company', 'division', 'department', 'team', 'office', 'cost_center'],
      {
        label: 'Kind',
        required: true,
        defaultValue: 'department',
        description: 'Categorisation hint — does not change graph semantics.',
        group: 'Identity',
      },
    ),

    // ── Hierarchy ────────────────────────────────────────────────
    parent_department_id: Field.lookup('sys_department', {
      label: 'Parent Department',
      required: false,
      description: 'Self-reference for the org tree. Null = root of tenant.',
      group: 'Hierarchy',
    }),

    organization_id: Field.lookup('sys_organization', {
      label: 'Organization',
      required: true,
      description: 'Tenant scope.',
      group: 'Hierarchy',
    }),

    // ── Leadership ───────────────────────────────────────────────
    manager_user_id: Field.lookup('sys_user', {
      label: 'Department Head',
      required: false,
      description: 'User responsible for this org unit (department head / lead).',
      group: 'Leadership',
    }),

    // ── Lifecycle ────────────────────────────────────────────────
    active: Field.boolean({
      label: 'Active',
      required: false,
      defaultValue: true,
      description: 'When false, members are not expanded by graph queries.',
      group: 'Lifecycle',
    }),

    effective_from: Field.datetime({
      label: 'Effective From',
      required: false,
      description: 'When this department came into existence (HRIS sync).',
      group: 'Lifecycle',
    }),

    effective_to: Field.datetime({
      label: 'Effective To',
      required: false,
      description: 'When this department was retired (HRIS sync).',
      group: 'Lifecycle',
    }),

    external_ref: Field.text({
      label: 'External Reference',
      required: false,
      maxLength: 200,
      description: 'ID in upstream HRIS (Workday / SAP HR / 北森).',
      group: 'Lifecycle',
    }),

    // ── System ───────────────────────────────────────────────────
    id: Field.text({
      label: 'Department ID',
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
    { fields: ['organization_id'] },
    { fields: ['parent_department_id'] },
    { fields: ['code', 'organization_id'], unique: true },
    { fields: ['active'] },
  ],

  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update', 'delete'],
    trash: true,
    mru: false,
  },
});
