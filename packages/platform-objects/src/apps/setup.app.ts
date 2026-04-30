// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Platform Setup App — static definition.
 *
 * Lists every `sys_*` administrative object as a left-hand navigation
 * entry in Studio's "Setup" area. Lives here (alongside the object
 * schemas it references) instead of being assembled at runtime by
 * `@objectstack/plugin-setup` — that plugin existed only because the
 * referenced objects used to live in three different runtime plugins
 * (auth/security/audit). Now that all `sys_*` objects are centralized
 * in `@objectstack/platform-objects`, the Setup App is a fixed metadata
 * artifact too and can be exported as plain data.
 *
 * The runtime registration happens in `plugin-auth` (which is always
 * loaded alongside security + audit and already calls
 * `manifest.register({...})`).
 */

import type { App } from '@objectstack/spec/ui';

export const SETUP_APP: App = {
  name: 'setup',
  label: 'Setup',
  description: 'Platform settings and administration',
  icon: 'settings',
  active: true,
  isDefault: false,
  branding: {
    primaryColor: '#475569', // Slate-600 — neutral admin palette
  },
  requiredPermissions: ['setup.access'],
  areas: [
    {
      id: 'area_administration',
      label: 'Administration',
      icon: 'shield',
      order: 10,
      description:
        'User management, roles, permissions, and security settings',
      navigation: [
        { id: 'nav_users', type: 'object', label: 'Users', objectName: 'sys_user', icon: 'users', order: 10 },
        { id: 'nav_organizations', type: 'object', label: 'Organizations', objectName: 'sys_organization', icon: 'building-2', order: 20 },
        { id: 'nav_teams', type: 'object', label: 'Teams', objectName: 'sys_team', icon: 'users-round', order: 30 },
        { id: 'nav_api_keys', type: 'object', label: 'API Keys', objectName: 'sys_api_key', icon: 'key', order: 40 },
        { id: 'nav_roles', type: 'object', label: 'Roles', objectName: 'sys_role', icon: 'shield-check', order: 50 },
        { id: 'nav_permission_sets', type: 'object', label: 'Permission Sets', objectName: 'sys_permission_set', icon: 'lock', order: 60 },
        { id: 'nav_oauth_apps', type: 'object', label: 'OAuth Apps', objectName: 'sys_oauth_application', icon: 'app-window', order: 70 },
        { id: 'nav_jwks', type: 'object', label: 'Signing Keys', objectName: 'sys_jwks', icon: 'key-round', order: 80 },
      ],
    },
    {
      id: 'area_platform',
      label: 'Platform',
      icon: 'layers',
      order: 20,
      description:
        'Objects, views, flows, apps, packages, and extensibility settings',
      navigation: [
        { id: 'nav_objects', type: 'object', label: 'Objects', objectName: 'sys_object', icon: 'database', order: 10 },
        { id: 'nav_views', type: 'object', label: 'Views', objectName: 'sys_view', icon: 'table', order: 20 },
        { id: 'nav_flows', type: 'object', label: 'Flows', objectName: 'sys_flow', icon: 'workflow', order: 30 },
        { id: 'nav_agents', type: 'object', label: 'AI Agents', objectName: 'sys_agent', icon: 'bot', order: 40 },
        { id: 'nav_tools', type: 'object', label: 'AI Tools', objectName: 'sys_tool', icon: 'wrench', order: 50 },
        { id: 'nav_apps', type: 'object', label: 'Apps', objectName: 'sys_app', icon: 'layout-grid', order: 60 },
        { id: 'nav_packages', type: 'object', label: 'Packages', objectName: 'sys_package', icon: 'package', order: 70 },
        { id: 'nav_package_installations', type: 'object', label: 'Installations', objectName: 'sys_package_installation', icon: 'package-check', order: 80 },
        { id: 'nav_metadata', type: 'object', label: 'All Metadata', objectName: 'sys_metadata', icon: 'file-cog', order: 90 },
      ],
    },
    {
      id: 'area_system',
      label: 'System',
      icon: 'settings',
      order: 30,
      description:
        'Datasources, integrations, jobs, logs, and environment configuration',
      navigation: [
        { id: 'nav_sessions', type: 'object', label: 'Sessions', objectName: 'sys_session', icon: 'monitor', order: 10 },
        { id: 'nav_audit_logs', type: 'object', label: 'Audit Logs', objectName: 'sys_audit_log', icon: 'scroll-text', order: 20 },
        { id: 'nav_activity', type: 'object', label: 'Activity', objectName: 'sys_activity', icon: 'activity', order: 30 },
        { id: 'nav_comments', type: 'object', label: 'Comments', objectName: 'sys_comment', icon: 'message-square', order: 40 },
      ],
    },
  ].filter((a) => a.navigation.length > 0),
};
