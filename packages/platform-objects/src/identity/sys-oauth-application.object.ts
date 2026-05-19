// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_oauth_application — Registered OAuth/OIDC client application
 *
 * Backed by `@better-auth/oauth-provider`'s `oauthClient` model. Each row
 * represents an external application that has been registered to authenticate
 * users against this ObjectStack server (acting as an OpenID Connect IdP).
 *
 * The table name is preserved from the deprecated `oidc-provider` plugin
 * (which used the `oauthApplication` model name) so existing data remains
 * accessible. The new model exposes a richer set of OAuth 2.1 / OIDC
 * registration fields — see RFC 7591 (Dynamic Client Registration) and
 * RFC 8414 (Authorization Server Metadata).
 *
 * @namespace sys
 */
export const SysOauthApplication = ObjectSchema.create({
  name: 'sys_oauth_application',
  label: 'OAuth Application',
  pluralLabel: 'OAuth Applications',
  icon: 'key-round',
  isSystem: true,
  managedBy: 'better-auth',
  description: 'Registered OAuth/OIDC client applications',
  displayNameField: 'name',
  titleFormat: '{name}',
  compactLayout: ['name', 'client_id', 'type', 'disabled'],

  listViews: {
    active: {
      type: 'grid',
      name: 'active',
      label: 'Active',
      data: { provider: 'object', object: 'sys_oauth_application' },
      columns: ['name', 'client_id', 'type', 'updated_at'],
      filter: [{ field: 'disabled', operator: 'equals', value: false }],
      sort: [{ field: 'name', order: 'asc' }],
      pagination: { pageSize: 50 },
    },
    disabled_apps: {
      type: 'grid',
      name: 'disabled_apps',
      label: 'Disabled',
      data: { provider: 'object', object: 'sys_oauth_application' },
      columns: ['name', 'client_id', 'type', 'updated_at'],
      filter: [{ field: 'disabled', operator: 'equals', value: true }],
      sort: [{ field: 'updated_at', order: 'desc' }],
      pagination: { pageSize: 50 },
    },
    all_apps: {
      type: 'grid',
      name: 'all_apps',
      label: 'All',
      data: { provider: 'object', object: 'sys_oauth_application' },
      columns: ['name', 'client_id', 'type', 'disabled', 'created_at'],
      sort: [{ field: 'name', order: 'asc' }],
      pagination: { pageSize: 50 },
    },
  },

  fields: {
    // ── Identity ─────────────────────────────────────────────────
    id: Field.text({
      label: 'ID',
      required: true,
      readonly: true,
      group: 'System',
    }),

    name: Field.text({
      label: 'Name',
      required: false,
      searchable: true,
      maxLength: 255,
      group: 'Identity',
    }),

    icon: Field.url({
      label: 'Icon',
      required: false,
      description: 'Logo URL shown on the consent screen',
      group: 'Identity',
    }),

    uri: Field.url({
      label: 'Home URI',
      required: false,
      description: 'Public homepage of the registered client',
      group: 'Identity',
    }),

    contacts: Field.textarea({
      label: 'Contacts',
      required: false,
      description: 'JSON-serialized list of contact email addresses',
      group: 'Identity',
    }),

    tos: Field.url({
      label: 'Terms of Service',
      required: false,
      group: 'Identity',
    }),

    policy: Field.url({
      label: 'Privacy Policy',
      required: false,
      group: 'Identity',
    }),

    metadata: Field.textarea({
      label: 'Metadata',
      required: false,
      description: 'JSON-serialized application metadata',
      group: 'Identity',
    }),

    // ── OAuth Credentials ────────────────────────────────────────
    client_id: Field.text({
      label: 'Client ID',
      required: true,
      readonly: true,
      maxLength: 255,
      description: 'Public OAuth client identifier',
      group: 'Credentials',
    }),

    client_secret: Field.text({
      label: 'Client Secret',
      required: false,
      maxLength: 1024,
      description: 'OAuth client secret (hashed/encrypted at rest)',
      group: 'Credentials',
    }),

    redirect_uris: Field.textarea({
      label: 'Redirect URIs',
      required: true,
      description: 'JSON-serialized list of allowed redirect URIs',
      group: 'Credentials',
    }),

    post_logout_redirect_uris: Field.textarea({
      label: 'Post-logout Redirect URIs',
      required: false,
      description: 'JSON-serialized list of allowed post-logout redirect URIs',
      group: 'Credentials',
    }),

    type: Field.select(['web', 'native', 'user-agent-based', 'public'], {
      label: 'Client Type',
      required: false,
      defaultValue: 'web',
      group: 'Credentials',
    }),

    public: Field.boolean({
      label: 'Public Client',
      required: false,
      description: 'Marks the client as a public (non-confidential) OAuth client',
      group: 'Credentials',
    }),

    require_pkce: Field.boolean({
      label: 'Require PKCE',
      required: false,
      group: 'Credentials',
    }),

    token_endpoint_auth_method: Field.text({
      label: 'Token Endpoint Auth Method',
      required: false,
      maxLength: 64,
      description: 'e.g. client_secret_basic, client_secret_post, none',
      group: 'Credentials',
    }),

    grant_types: Field.textarea({
      label: 'Grant Types',
      required: false,
      description: 'JSON-serialized list of allowed grant types',
      group: 'Credentials',
    }),

    response_types: Field.textarea({
      label: 'Response Types',
      required: false,
      description: 'JSON-serialized list of allowed response types',
      group: 'Credentials',
    }),

    scopes: Field.textarea({
      label: 'Allowed Scopes',
      required: false,
      description: 'JSON-serialized list of scopes the client may request',
      group: 'Credentials',
    }),

    subject_type: Field.text({
      label: 'Subject Type',
      required: false,
      maxLength: 32,
      description: 'OIDC subject type (e.g. public, pairwise)',
      group: 'Credentials',
    }),

    // ── Behaviour flags ──────────────────────────────────────────
    disabled: Field.boolean({
      label: 'Disabled',
      required: false,
      defaultValue: false,
      group: 'Behaviour',
    }),

    skip_consent: Field.boolean({
      label: 'Skip Consent',
      required: false,
      description: 'Treat as a trusted client and bypass the consent screen',
      group: 'Behaviour',
    }),

    enable_end_session: Field.boolean({
      label: 'Enable End Session',
      required: false,
      description: 'Allow the client to call the OIDC end-session endpoint',
      group: 'Behaviour',
    }),

    // ── Software statement (RFC 7591 §2.3) ───────────────────────
    software_id: Field.text({
      label: 'Software ID',
      required: false,
      maxLength: 255,
      group: 'Software',
    }),

    software_version: Field.text({
      label: 'Software Version',
      required: false,
      maxLength: 64,
      group: 'Software',
    }),

    software_statement: Field.textarea({
      label: 'Software Statement',
      required: false,
      description: 'Signed JWT asserting the client metadata (RFC 7591 §2.3)',
      group: 'Software',
    }),

    // ── Ownership / system ───────────────────────────────────────
    user_id: Field.lookup('sys_user', {
      label: 'Owner User',
      required: false,
      description: 'User who registered this application',
      group: 'System',
    }),

    reference_id: Field.text({
      label: 'Reference ID',
      required: false,
      maxLength: 255,
      description: 'Caller-supplied correlation identifier',
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
    { fields: ['client_id'], unique: true },
    { fields: ['user_id'] },
    { fields: ['reference_id'] },
  ],

  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'delete'],
    trash: false,
    mru: false,
  },
});
