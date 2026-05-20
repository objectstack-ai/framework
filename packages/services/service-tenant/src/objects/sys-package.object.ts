// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_package — Control Plane Package Registry
 *
 * One row per logical package (also called Solution in Power Platform,
 * Unlocked Package in Salesforce, Application in ServiceNow).
 * The package itself carries only identity and publishing metadata.
 * Actual content (objects, views, flows…) lives in sys_package_version.
 *
 * Addressable by the globally unique `manifest_id` (reverse-domain string).
 * The `manifest_id` is immutable once set — renaming a package requires
 * creating a new package entry.
 *
 * **This table lives in the Control Plane only.**
 *
 * See `docs/adr/0003-package-as-first-class-citizen.md` for the full rationale.
 *
 * @namespace sys
 */
export const SysPackage = ObjectSchema.create({
  name: 'sys_package',
  label: 'Package',
  pluralLabel: 'Packages',
  icon: 'package',
  isSystem: true,
  managedBy: 'config',
  description: 'Browse and install apps from the Marketplace.',
  titleFormat: '{display_name}',
  compactLayout: ['display_name', 'manifest_id', 'visibility', 'created_at'],
  // sys_package is a global catalog (Marketplace). Visibility/access is
  // governed by the `visibility` column + `owner_org_id` (when set), NOT
  // by implicit organization_id row-scoping. Disable tenant injection so
  // platform-seeded starter rows (owner_org_id NULL) are visible to all.
  tenancy: { enabled: false, strategy: 'shared' },

  fields: {
    id: Field.text({
      label: 'Package ID',
      required: true,
      readonly: true,
      description: 'UUID of the package (stable, never reused).',
    }),

    created_at: Field.datetime({
      label: 'Created At',
      defaultValue: 'NOW()',
      readonly: true,
      description: 'Creation timestamp (ISO-8601).',
    }),

    updated_at: Field.datetime({
      label: 'Updated At',
      defaultValue: 'NOW()',
      readonly: true,
      description: 'Last update timestamp (ISO-8601).',
    }),

    manifest_id: Field.text({
      label: 'Manifest ID',
      required: true,
      readonly: true,
      maxLength: 255,
      description:
        'Globally unique reverse-domain package identifier (e.g. com.acme.crm). ' +
        'Immutable once set. Used as the stable public key for dependency declarations.',
    }),

    owner_org_id: Field.lookup('sys_organization', {
      label: 'Owner Organization',
      required: false,
      description: 'Organization that owns and publishes this package. Null for platform-seeded starter packages.',
    }),

    display_name: Field.text({
      label: 'Display Name',
      required: true,
      maxLength: 128,
      description: 'Human-readable name shown in Studio and Marketplace.',
    }),

    description: Field.textarea({
      label: 'Description',
      required: false,
      description: 'Short package description shown in search results and install dialogs (max 512 chars).',
    }),

    readme: Field.textarea({
      label: 'Readme',
      required: false,
      description: 'Long-form package documentation (markdown). Displayed on the Marketplace detail page.',
    }),

    visibility: Field.select({
      label: 'Visibility',
      required: true,
      defaultValue: 'private',
      description:
        'Controls who can discover and install the package. ' +
        'private = owner org only; org = all envs in owner org; marketplace = public registry.',
      options: [
        { value: 'private', label: 'Private' },
        { value: 'org', label: 'Organization' },
        { value: 'marketplace', label: 'Marketplace' },
      ],
    }),

    category: Field.text({
      label: 'Category',
      required: false,
      maxLength: 100,
      description: 'Primary category for Marketplace filtering (e.g. crm, hr, finance, devtools).',
    }),

    tags: Field.textarea({
      label: 'Tags',
      required: false,
      description: 'JSON-serialized array of search/filter tags (e.g. ["salesforce","sync","crm"]).',
    }),

    icon_url: Field.url({
      label: 'Icon URL',
      required: false,
      description: 'URL to the package icon image displayed in Studio and Marketplace.',
    }),

    homepage_url: Field.url({
      label: 'Homepage URL',
      required: false,
      description: 'URL to the package homepage or external documentation site.',
    }),

    license: Field.text({
      label: 'License',
      required: false,
      maxLength: 64,
      description: 'SPDX license identifier (e.g. MIT, Apache-2.0, proprietary).',
    }),

    publisher: Field.select({
      label: 'Publisher Tier',
      required: false,
      defaultValue: 'private',
      description:
        'Publisher provenance tier — surfaced as a trust badge in Marketplace and Studio. ' +
        'objectstack = first-party core team; partner = verified third-party; ' +
        'community = unverified public submission; private = internal to owner org.',
      options: [
        { value: 'objectstack', label: 'ObjectStack' },
        { value: 'partner', label: 'Partner' },
        { value: 'community', label: 'Community' },
        { value: 'private', label: 'Private' },
      ],
    }),

    is_starter: Field.boolean({
      label: 'Starter Template',
      required: false,
      defaultValue: false,
      description:
        'If true, this package is offered as a starting blueprint in the Create Project ' +
        'wizard. Starter packages are regular packages — there is no separate "template" ' +
        'concept. CI promotes examples/app-* packages by setting this flag during publish.',
    }),

    created_by: Field.lookup('sys_user', {
      label: 'Created By',
      required: false,
      description: 'User that registered this package in the Control Plane. Null for platform-seeded packages.',
    }),
  },

  indexes: [
    { fields: ['manifest_id'], unique: true },
    { fields: ['owner_org_id'] },
    { fields: ['visibility'] },
    { fields: ['owner_org_id', 'visibility'] },
    { fields: ['is_starter'] },
  ],

  actions: [
    {
      name: 'install_package',
      label: 'Install into Environment',
      icon: 'download-cloud',
      variant: 'primary',
      type: 'api',
      locations: ['list_item', 'record_header'],
      target: '/api/v1/cloud/packages/{id}/install',
      method: 'POST',
      recordIdParam: 'id',
      successMessage: 'Package installed. Open your environment to see it.',
      refreshAfter: true,
      params: [
        {
          // Borrow the typed lookup config from sys_package_installation
          // so renderers that support it can show a record picker
          // instead of asking the user to paste a UUID. We keep the
          // explicit `name` and `placeholder` so renderers that don't
          // support field-borrow still get a usable text input.
          name: 'environment_id',
          field: 'environment_id',
          objectOverride: 'sys_package_installation',
          label: 'Target Environment',
          type: 'lookup',
          required: true,
          placeholder: 'Pick an environment (or paste its ID)',
          helpText: 'Environment to install this package into. ' +
            'Renderers that support record pickers will show your environments; ' +
            'otherwise paste the Environment ID from the Environments list.',
        },
        {
          name: 'seed_sample_data',
          label: 'Include sample data',
          type: 'boolean',
          required: false,
          defaultValue: false,
          helpText: 'Pre-populate the environment with the package\'s demo records ' +
            '(e.g. example Accounts, Contacts, Leads) so you can explore the app immediately. ' +
            'Recommended for first-time users; leave unchecked for a clean production environment.',
        },
      ],
    },
  ],

  enable: {
    trackHistory: false,
    searchable: true,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update'],
    trash: false,
    mru: false,
  },
});
