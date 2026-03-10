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
