// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @objectstack/system-objects
 *
 * Core system object schemas for the ObjectStack platform.
 * All sys_* objects that every kernel service depends on are defined here.
 *
 * Subpath imports available:
 *   @objectstack/system-objects/identity  — user, session, org, team, api-key, ...
 *   @objectstack/system-objects/security  — role, permission-set
 *   @objectstack/system-objects/audit     — audit-log, presence
 *   @objectstack/system-objects/tenant    — project, app, package, ...
 *   @objectstack/system-objects/metadata  — sys_metadata, sys_object, sys_view, ...
 */

export * from './identity/index.js';
export * from './security/index.js';
export * from './audit/index.js';
export * from './tenant/index.js';
export * from './metadata/index.js';
