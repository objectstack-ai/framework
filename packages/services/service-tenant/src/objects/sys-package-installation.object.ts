// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_package_installation — Package Installation Registry
 *
 * Tracks which packages are installed in which tenant.
 * Stored in the global control plane database.
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
  description: 'Per-tenant package installation registry',
  titleFormat: '{package_id} @ {tenant_id}',
  compactLayout: ['package_id', 'tenant_id', 'version', 'status'],

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

    tenant_id: Field.text({
      label: 'Tenant ID',
      required: true,
      description: 'Foreign key to tenant_database',
    }),

    package_id: Field.text({
      label: 'Package ID',
      required: true,
      maxLength: 255,
      description: 'Package identifier (e.g., @objectstack/crm)',
    }),

    version: Field.text({
      label: 'Version',
      required: true,
      maxLength: 50,
      description: 'Installed package version (semver)',
    }),

    status: Field.picklist({
      label: 'Status',
      required: true,
      options: [
        { value: 'installing', label: 'Installing' },
        { value: 'active', label: 'Active' },
        { value: 'disabled', label: 'Disabled' },
        { value: 'uninstalling', label: 'Uninstalling' },
        { value: 'failed', label: 'Failed' },
      ],
      defaultValue: 'installing',
    }),

    installed_at: Field.datetime({
      label: 'Installed At',
      required: true,
      defaultValue: 'NOW()',
    }),

    installed_by: Field.text({
      label: 'Installed By',
      required: true,
      description: 'User ID who installed the package',
    }),

    config: Field.textarea({
      label: 'Configuration',
      required: false,
      description: 'JSON-serialized package-specific configuration',
    }),
  },

  indexes: [
    { fields: ['tenant_id', 'package_id'], unique: true },
    { fields: ['tenant_id'] },
    { fields: ['package_id'] },
    { fields: ['status'] },
  },

  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update', 'delete'],
    trash: true,
    mru: true,
  },
});
