// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Dashboard } from '@objectstack/spec/ui';

/**
 * Security Overview Dashboard
 * 
 * Provides security and compliance monitoring:
 * - User authentication events
 * - Permission changes
 * - System configuration audits
 * - Active user sessions
 */
export const SecurityOverviewDashboard = Dashboard.create({
  name: 'security_overview',
  label: 'Security Overview',
  description: 'Security events, authentication, and audit trails',

  // 12-column grid matches the widget `w` values below.
  columns: 12,
  gap: 4,

  widgets: [
    // ── Failed Login Attempts Widget ────────────────────────────────
    {
      id: 'widget_failed_logins',
      title: 'Failed Login Attempts',
      type: 'metric',
      object: 'sys_audit_log',
      layout: {
        x: 0,
        y: 0,
        w: 3,
        h: 2,
      },
      filter: {
        field: 'action',
        operator: 'equals',
        value: 'login',
      },
      aggregate: 'count',
      colorVariant: 'danger',
      description: 'Failed authentication attempts (24h)',
    },

    // ── Permission Changes Widget ───────────────────────────────────
    {
      id: 'widget_permission_changes',
      title: 'Permission Changes',
      type: 'metric',
      object: 'sys_audit_log',
      layout: {
        x: 3,
        y: 0,
        w: 3,
        h: 2,
      },
      filter: {
        field: 'action',
        operator: 'equals',
        value: 'permission_change',
      },
      aggregate: 'count',
      colorVariant: 'warning',
      description: 'Recent permission and role modifications',
    },

    // ── System Config Changes Widget ────────────────────────────────
    {
      id: 'widget_config_changes',
      title: 'Config Changes',
      type: 'metric',
      object: 'sys_audit_log',
      layout: {
        x: 6,
        y: 0,
        w: 3,
        h: 2,
      },
      filter: {
        field: 'action',
        operator: 'equals',
        value: 'config_change',
      },
      aggregate: 'count',
      colorVariant: 'blue',
      description: 'System configuration modifications',
    },

    // ── Active Sessions Widget ──────────────────────────────────────
    {
      id: 'widget_active_sessions',
      title: 'Active Sessions',
      type: 'metric',
      object: 'sys_session',
      layout: {
        x: 9,
        y: 0,
        w: 3,
        h: 2,
      },
      aggregate: 'count',
      colorVariant: 'success',
      description: 'Currently active user sessions',
    },

    // ── Audit Events by Type ────────────────────────────────────────
    {
      id: 'widget_events_by_type',
      title: 'Audit Events by Type',
      description: 'Distribution of security and audit events',
      type: 'pie',
      object: 'sys_audit_log',
      layout: {
        x: 0,
        y: 2,
        w: 6,
        h: 4,
      },
      categoryField: 'action',
      aggregate: 'count',
    },

    // ── Audit Events by User ────────────────────────────────────────
    {
      id: 'widget_events_by_user',
      title: 'Events by User',
      description: 'Activity distribution across users',
      type: 'bar',
      object: 'sys_audit_log',
      layout: {
        x: 6,
        y: 2,
        w: 6,
        h: 4,
      },
      categoryField: 'user_id',
      aggregate: 'count',
    },

    // ── Recent Security Events (Table) ──────────────────────────────
    {
      id: 'widget_recent_security_events',
      title: 'Recent Security Events',
      description: 'Latest permission and config changes',
      type: 'metric',
      object: 'sys_audit_log',
      layout: {
        x: 0,
        y: 6,
        w: 12,
        h: 3,
      },
      aggregate: 'count',
      colorVariant: 'default',
    },
  ],
  globalFilters: [
    {
      field: 'created_at',
      type: 'date',
      label: 'Date Range',
      scope: 'dashboard',
      defaultValue: 'last_7_days',
    },
  ],
});
