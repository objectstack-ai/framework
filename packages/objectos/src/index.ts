// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @objectstack/objectos
 *
 * ObjectOS - System Runtime Object Definitions
 *
 * This package contains the core system object definitions that form
 * the foundation of the ObjectStack platform. These objects represent
 * the metadata layer itself (objects, views, flows, agents, etc.) as
 * queryable data.
 *
 * ## Architecture
 * - Protocol Layer: `@objectstack/spec` — Zod schemas (ObjectSchema, ViewSchema)
 * - Runtime Layer: `@objectstack/objectos` — Concrete system objects (SysObject, SysView)
 * - Service Layer: `@objectstack/metadata` — Metadata management service
 *
 * ## Usage
 * ```typescript
 * import { SystemObjects } from '@objectstack/objectos';
 *
 * // Register all system objects
 * for (const [name, definition] of Object.entries(SystemObjects)) {
 *   await metadataService.register('object', name, definition);
 * }
 * ```
 *
 * ## Design Philosophy
 *
 * ObjectOS follows the "Metadata as Data" pattern:
 * 1. **Dual-Table Architecture**: Metadata stored in both sys_metadata (source) and type-specific tables (queryable)
 * 2. **Object Protocol**: All system objects use the same protocol as business data
 * 3. **Auto-Generated UI**: Studio renders metadata forms/tables using existing view components
 * 4. **Version Control**: Full version history via sys_metadata_history table
 * 5. **Package Management**: Metadata tracked by package ownership
 *
 * @module @objectstack/objectos
 */

export * from './objects';
export * from './registry';
