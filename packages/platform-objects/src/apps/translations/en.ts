// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { TranslationData } from '@objectstack/spec/system';

/**
 * English (en) — Setup App Translations
 *
 * Per-locale file mirroring the CRM example convention (one file per
 * language, aggregated into a single `TranslationBundle` by
 * `setup.translation.ts`).
 *
 * Scope: the static Setup App metadata artifact owned by
 * `@objectstack/platform-objects/apps`:
 *   - `apps.setup.label` / `description`
 *   - `apps.setup.navigation.<id>.label` for every group AND leaf
 *   - `dashboards.system_overview.*`
 *   - `dashboards.security_overview.*`
 *
 * Object-level labels (Users, Roles, Audit Logs, …) are owned by the
 * sys_* object schemas themselves and translated separately.
 */
export const en: TranslationData = {
  apps: {
    setup: {
      label: 'Setup',
      description: 'Platform settings and administration',
      navigation: {
        // Groups
        group_overview: { label: 'Overview' },
        group_people_org: { label: 'People & Organization' },
        group_access_control: { label: 'Access Control' },
        group_approvals: { label: 'Approvals' },
        group_configuration: { label: 'Configuration' },
        group_diagnostics: { label: 'Diagnostics' },
        group_advanced: { label: 'Advanced' },

        // Overview
        nav_system_overview: { label: 'System Overview' },
        nav_security_overview: { label: 'Security Overview' },

        // People & Organization
        nav_users: { label: 'Users' },
        nav_departments: { label: 'Departments' },
        nav_teams: { label: 'Teams' },
        nav_organizations: { label: 'Organizations' },
        nav_invitations: { label: 'Invitations' },

        // Access Control
        nav_roles: { label: 'Roles' },
        nav_permission_sets: { label: 'Permission Sets' },
        nav_sharing_rules: { label: 'Sharing Rules' },
        nav_record_shares: { label: 'Record Shares' },
        nav_api_keys: { label: 'API Keys' },

        // Approvals
        nav_approval_processes: { label: 'Processes' },
        nav_approval_requests: { label: 'Requests' },
        nav_approval_actions: { label: 'Action History' },

        // Configuration
        nav_settings_hub: { label: 'All Settings' },
        nav_settings_mail: { label: 'Email' },
        nav_settings_branding: { label: 'Branding' },
        nav_settings_feature_flags: { label: 'Feature Flags' },

        // Diagnostics
        nav_sessions: { label: 'Sessions' },
        nav_audit_logs: { label: 'Audit Logs' },
        nav_notifications: { label: 'Notifications' },

        // Advanced
        nav_oauth_apps: { label: 'OAuth Applications' },
        nav_jwks: { label: 'Signing Keys (JWKS)' },
        nav_verifications: { label: 'Verifications' },
        nav_two_factor: { label: 'Two-Factor' },
        nav_device_codes: { label: 'Device Codes' },
        nav_accounts: { label: 'Identity Links' },
        nav_user_preferences: { label: 'User Preferences' },
        nav_metadata: { label: 'All Metadata' },
      },
    },
  },

  dashboards: {
    system_overview: {
      label: 'System Overview',
      description: 'Platform health, sessions, and audit activity',
      widgets: {
        widget_active_sessions: {
          title: 'Active Sessions',
          description: 'Number of currently active user sessions',
        },
        widget_total_users: {
          title: 'Total Users',
          description: 'Total registered users in the system',
        },
        widget_organizations: {
          title: 'Organizations',
          description: 'Total organizations on the platform',
        },
        widget_packages_installed: {
          title: 'Packages Installed',
          description: 'Active package installations across projects',
        },
        widget_audit_actions: {
          title: 'Audit Actions',
          description: 'Distribution of audit events by action type',
        },
        widget_active_orgs: {
          title: 'Sessions by Organization',
          description: 'Active sessions grouped by organization',
        },
        widget_recent_events: {
          title: 'Recent Audit Events',
          description: 'Latest platform events',
        },
      },
    },

    security_overview: {
      label: 'Security Overview',
      description: 'Security events, authentication, and audit trails',
      widgets: {
        widget_login_events: {
          title: 'Login Events',
          description: 'Authentication events recorded by the audit log',
        },
        widget_permission_changes: {
          title: 'Permission Changes',
          description: 'Recent permission and role modifications',
        },
        widget_config_changes: {
          title: 'Config Changes',
          description: 'System configuration modifications',
        },
        widget_active_sessions: {
          title: 'Active Sessions',
          description: 'Currently active user sessions',
        },
        widget_events_by_type: {
          title: 'Audit Events by Type',
          description: 'Distribution of security and audit events',
        },
        widget_events_by_user: {
          title: 'Events by User',
          description: 'Activity distribution across users',
        },
        widget_recent_security_events: {
          title: 'Recent Security Events',
          description: 'Latest permission and config changes',
        },
      },
    },
  },
};
