// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_package_installation — Per-environment package installation record.
 *
 * Tracks which packages (business solutions) are installed in each environment.
 * Stored in the environment's own data-plane database (Power Apps "solution" model).
 *
 * @namespace sys
 */
export const SysPackageInstallation = ObjectSchema.create({
  namespace: 'sys',
  name: 'package_installation',
  label: 'Package Installation',
  pluralLabel: 'Package Installations',
  icon: 'package',
  isSystem: true,
  description: 'Per-environment package installation registry (sys_package_installation)',
  titleFormat: '{package_id} @ {environment_id}',
  compactLayout: ['package_id', 'environment_id', 'version', 'status'],

  fields: {
    id: Field.text({
      label: 'Installation ID',
      required: true,
      readonly: true,
      description: 'UUID-based installation identifier',
    }),

    created_at: Field.datetime({
      label: 'Created At',
      defaultValue: 'NOW()',
      readonly: true,
    }),

    updated_at: Field.datetime({
      label: 'Updated At',
      defaultValue: 'NOW()',
      readonly: true,
    }),

    environment_id: Field.text({
      label: 'Environment ID',
      required: true,
      description: 'Foreign key to sys__environment',
    }),

    package_id: Field.text({
      label: 'Package ID',
      required: true,
      maxLength: 255,
      description: 'Manifest ID of the installed package (reverse-domain, e.g. com.example.crm)',
    }),

    version: Field.text({
      label: 'Version',
      required: true,
      maxLength: 50,
      description: 'Installed package version (semver)',
    }),

    status: Field.select({
      label: 'Status',
      required: true,
      options: [
        { value: 'installed', label: 'Installed' },
        { value: 'installing', label: 'Installing' },
        { value: 'upgrading', label: 'Upgrading' },
        { value: 'disabled', label: 'Disabled' },
        { value: 'error', label: 'Error' },
      ],
      defaultValue: 'installed',
    }),

    enabled: Field.boolean({
      label: 'Enabled',
      required: true,
      defaultValue: true,
      description: 'Whether the package is currently active in this environment',
    }),

    installed_at: Field.datetime({
      label: 'Installed At',
      required: true,
      defaultValue: 'NOW()',
    }),

    installed_by: Field.text({
      label: 'Installed By',
      required: false,
      description: 'User ID who installed the package',
    }),

    error_message: Field.textarea({
      label: 'Error Message',
      required: false,
      description: 'Error details when status is error',
    }),

    settings: Field.textarea({
      label: 'Settings',
      required: false,
      description: 'JSON-serialized per-installation configuration',
    }),

    upgrade_history: Field.textarea({
      label: 'Upgrade History',
      required: false,
      defaultValue: '[]',
      description: 'JSON array of version upgrade records',
    }),
  },

  indexes: [
    { fields: ['environment_id', 'package_id'], unique: true },
    { fields: ['environment_id'] },
    { fields: ['package_id'] },
    { fields: ['status'] },
  ],

  enable: {
    trackHistory: false,
    searchable: true,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update', 'delete'],
    trash: false,
    mru: false,
  },
});
