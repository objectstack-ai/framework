// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// Control-Plane objects (environment-per-database model)
export * from './sys-environment.object';
export * from './sys-database-credential.object';
export * from './sys-environment-member.object';

// v4.x deprecation shim — removed in v5.0. See
// docs/adr/0002-environment-database-isolation.md for the migration path.
export * from './sys-tenant-database.object';

// Package installation registry (lives in control plane for now; will move
// into each environment's data plane in v5.0 per ADR-0002).
export * from './sys-package-installation.object';
