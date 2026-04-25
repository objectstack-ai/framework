// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * system-objects/tenant — Multi-Tenant & Project Management System Objects
 */

export * from './sys-project.object.js';
export * from './sys-project-member.object.js';
export * from './sys-project-credential.object.js';
export * from './sys-app.object.js';
export * from './sys-package.object.js';
export * from './sys-package-version.object.js';
export * from './sys-package-installation.object.js';

// v4.x deprecation shim — removed in v5.0
export * from './sys-tenant-database.object.js';
