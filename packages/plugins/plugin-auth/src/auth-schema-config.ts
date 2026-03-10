// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { SystemObjectName } from '@objectstack/spec/system';

/**
 * better-auth ↔ ObjectStack Schema Mapping
 *
 * better-auth uses camelCase field names internally (e.g. `emailVerified`, `userId`)
 * while ObjectStack's protocol layer uses snake_case (e.g. `email_verified`, `user_id`).
 *
 * These constants declare the `modelName` and `fields` mappings for each core auth
 * model, following better-auth's official schema customisation API
 * ({@link https://www.better-auth.com/docs/concepts/database}).
 *
 * The mappings serve two purposes:
 * 1. `modelName` — maps the default model name to the ObjectStack protocol name
 *    (e.g. `user` → `sys_user`).
 * 2. `fields`   — maps camelCase field names to their snake_case database column
 *    equivalents. Only fields whose names differ need to be listed; fields that
 *    are already identical (e.g. `email`, `name`, `token`) are omitted.
 *
 * These mappings are consumed by:
 * - The `betterAuth()` configuration in {@link AuthManager} so that
 *   `getAuthTables()` builds the correct schema.
 * - The ObjectQL adapter factory (via `createAdapterFactory`) which uses the
 *   schema to transform data and where-clauses automatically.
 */

// ---------------------------------------------------------------------------
// User model
// ---------------------------------------------------------------------------

/**
 * better-auth `user` model mapping.
 *
 * | camelCase (better-auth) | snake_case (ObjectStack) |
 * |:------------------------|:-------------------------|
 * | emailVerified           | email_verified           |
 * | createdAt               | created_at               |
 * | updatedAt               | updated_at               |
 */
export const AUTH_USER_CONFIG = {
  modelName: SystemObjectName.USER, // 'sys_user'
  fields: {
    emailVerified: 'email_verified',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
} as const;

// ---------------------------------------------------------------------------
// Session model
// ---------------------------------------------------------------------------

/**
 * better-auth `session` model mapping.
 *
 * | camelCase (better-auth) | snake_case (ObjectStack) |
 * |:------------------------|:-------------------------|
 * | userId                  | user_id                  |
 * | expiresAt               | expires_at               |
 * | createdAt               | created_at               |
 * | updatedAt               | updated_at               |
 * | ipAddress               | ip_address               |
 * | userAgent               | user_agent               |
 */
export const AUTH_SESSION_CONFIG = {
  modelName: SystemObjectName.SESSION, // 'sys_session'
  fields: {
    userId: 'user_id',
    expiresAt: 'expires_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    ipAddress: 'ip_address',
    userAgent: 'user_agent',
  },
} as const;

// ---------------------------------------------------------------------------
// Account model
// ---------------------------------------------------------------------------

/**
 * better-auth `account` model mapping.
 *
 * | camelCase (better-auth)   | snake_case (ObjectStack)       |
 * |:--------------------------|:-------------------------------|
 * | userId                    | user_id                        |
 * | providerId                | provider_id                    |
 * | accountId                 | account_id                     |
 * | accessToken               | access_token                   |
 * | refreshToken              | refresh_token                  |
 * | idToken                   | id_token                       |
 * | accessTokenExpiresAt      | access_token_expires_at        |
 * | refreshTokenExpiresAt     | refresh_token_expires_at       |
 * | createdAt                 | created_at                     |
 * | updatedAt                 | updated_at                     |
 */
export const AUTH_ACCOUNT_CONFIG = {
  modelName: SystemObjectName.ACCOUNT, // 'sys_account'
  fields: {
    userId: 'user_id',
    providerId: 'provider_id',
    accountId: 'account_id',
    accessToken: 'access_token',
    refreshToken: 'refresh_token',
    idToken: 'id_token',
    accessTokenExpiresAt: 'access_token_expires_at',
    refreshTokenExpiresAt: 'refresh_token_expires_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
} as const;

// ---------------------------------------------------------------------------
// Verification model
// ---------------------------------------------------------------------------

/**
 * better-auth `verification` model mapping.
 *
 * | camelCase (better-auth) | snake_case (ObjectStack) |
 * |:------------------------|:-------------------------|
 * | expiresAt               | expires_at               |
 * | createdAt               | created_at               |
 * | updatedAt               | updated_at               |
 */
export const AUTH_VERIFICATION_CONFIG = {
  modelName: SystemObjectName.VERIFICATION, // 'sys_verification'
  fields: {
    expiresAt: 'expires_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
} as const;

// ===========================================================================
// Plugin Table Mappings
// ===========================================================================
//
// better-auth plugins (organization, two-factor, etc.) introduce additional
// tables with their own camelCase field names.  The mappings below are passed
// to the plugin's `schema` option so that `createAdapterFactory` transforms
// them to snake_case automatically, just like the core models above.
// ===========================================================================

// ---------------------------------------------------------------------------
// Organization plugin – organization table
// ---------------------------------------------------------------------------

/**
 * better-auth Organization plugin `organization` model mapping.
 *
 * | camelCase (better-auth) | snake_case (ObjectStack) |
 * |:------------------------|:-------------------------|
 * | createdAt               | created_at               |
 * | updatedAt               | updated_at               |
 */
export const AUTH_ORGANIZATION_SCHEMA = {
  modelName: 'sys_organization',
  fields: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
} as const;

// ---------------------------------------------------------------------------
// Organization plugin – member table
// ---------------------------------------------------------------------------

/**
 * better-auth Organization plugin `member` model mapping.
 *
 * | camelCase (better-auth) | snake_case (ObjectStack) |
 * |:------------------------|:-------------------------|
 * | organizationId          | organization_id          |
 * | userId                  | user_id                  |
 * | createdAt               | created_at               |
 */
export const AUTH_MEMBER_SCHEMA = {
  modelName: 'sys_member',
  fields: {
    organizationId: 'organization_id',
    userId: 'user_id',
    createdAt: 'created_at',
  },
} as const;

// ---------------------------------------------------------------------------
// Organization plugin – invitation table
// ---------------------------------------------------------------------------

/**
 * better-auth Organization plugin `invitation` model mapping.
 *
 * | camelCase (better-auth) | snake_case (ObjectStack) |
 * |:------------------------|:-------------------------|
 * | organizationId          | organization_id          |
 * | inviterId               | inviter_id               |
 * | expiresAt               | expires_at               |
 * | createdAt               | created_at               |
 * | teamId                  | team_id                  |
 */
export const AUTH_INVITATION_SCHEMA = {
  modelName: 'sys_invitation',
  fields: {
    organizationId: 'organization_id',
    inviterId: 'inviter_id',
    expiresAt: 'expires_at',
    createdAt: 'created_at',
    teamId: 'team_id',
  },
} as const;

// ---------------------------------------------------------------------------
// Organization plugin – session additional fields
// ---------------------------------------------------------------------------

/**
 * Organization plugin adds `activeOrganizationId` (and optionally
 * `activeTeamId`) to the session model. These field mappings are
 * injected via the organization plugin's `schema.session.fields`.
 */
export const AUTH_ORG_SESSION_FIELDS = {
  activeOrganizationId: 'active_organization_id',
  activeTeamId: 'active_team_id',
} as const;

// ---------------------------------------------------------------------------
// Organization plugin – team table (optional, when teams enabled)
// ---------------------------------------------------------------------------

/**
 * better-auth Organization plugin `team` model mapping.
 *
 * | camelCase (better-auth) | snake_case (ObjectStack) |
 * |:------------------------|:-------------------------|
 * | organizationId          | organization_id          |
 * | createdAt               | created_at               |
 * | updatedAt               | updated_at               |
 */
export const AUTH_TEAM_SCHEMA = {
  modelName: 'sys_team',
  fields: {
    organizationId: 'organization_id',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
} as const;

// ---------------------------------------------------------------------------
// Organization plugin – teamMember table (optional, when teams enabled)
// ---------------------------------------------------------------------------

/**
 * better-auth Organization plugin `teamMember` model mapping.
 *
 * | camelCase (better-auth) | snake_case (ObjectStack) |
 * |:------------------------|:-------------------------|
 * | teamId                  | team_id                  |
 * | userId                  | user_id                  |
 * | createdAt               | created_at               |
 */
export const AUTH_TEAM_MEMBER_SCHEMA = {
  modelName: 'sys_team_member',
  fields: {
    teamId: 'team_id',
    userId: 'user_id',
    createdAt: 'created_at',
  },
} as const;

// ---------------------------------------------------------------------------
// Two-Factor plugin – twoFactor table
// ---------------------------------------------------------------------------

/**
 * better-auth Two-Factor plugin `twoFactor` model mapping.
 *
 * | camelCase (better-auth) | snake_case (ObjectStack) |
 * |:------------------------|:-------------------------|
 * | backupCodes             | backup_codes             |
 * | userId                  | user_id                  |
 */
export const AUTH_TWO_FACTOR_SCHEMA = {
  modelName: 'sys_two_factor',
  fields: {
    backupCodes: 'backup_codes',
    userId: 'user_id',
  },
} as const;

/**
 * Two-Factor plugin adds a `twoFactorEnabled` field to the user model.
 */
export const AUTH_TWO_FACTOR_USER_FIELDS = {
  twoFactorEnabled: 'two_factor_enabled',
} as const;

/**
 * Builds the `schema` option for better-auth's `twoFactor()` plugin.
 *
 * @returns An object suitable for `twoFactor({ schema: … })`
 */
export function buildTwoFactorPluginSchema() {
  return {
    twoFactor: AUTH_TWO_FACTOR_SCHEMA,
    user: {
      fields: AUTH_TWO_FACTOR_USER_FIELDS,
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: build organization plugin schema option
// ---------------------------------------------------------------------------

/**
 * Builds the `schema` option for better-auth's `organization()` plugin.
 *
 * The organization plugin accepts a `schema` sub-option that allows
 * customising model names and field names for each table it manages.
 * This helper assembles the correct snake_case mappings from the
 * individual `AUTH_*_SCHEMA` constants above.
 *
 * @returns An object suitable for `organization({ schema: … })`
 */
export function buildOrganizationPluginSchema() {
  return {
    organization: AUTH_ORGANIZATION_SCHEMA,
    member: AUTH_MEMBER_SCHEMA,
    invitation: AUTH_INVITATION_SCHEMA,
    team: AUTH_TEAM_SCHEMA,
    teamMember: AUTH_TEAM_MEMBER_SCHEMA,
    session: {
      fields: AUTH_ORG_SESSION_FIELDS,
    },
  };
}
