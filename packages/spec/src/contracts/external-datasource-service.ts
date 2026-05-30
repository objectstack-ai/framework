// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * IExternalDatasourceService — External Datasource Federation contract
 * (ADR-0015 §4.5, §6).
 *
 * The service that turns a federated datasource (`schemaMode !== 'managed'`)
 * into something the rest of ObjectStack can use: it lists remote tables,
 * drafts `Object` definitions from them, and validates declared objects
 * against the live remote schema. Implemented in
 * `@objectstack/service-external-datasource` on top of the driver's
 * introspection capability; consumed by the CLI, the boot-validation plugin
 * (Gate 2), and the REST layer.
 */

import type { SchemaDiffEntry } from '../shared/external-errors';

/**
 * A remote table discovered via introspection, filtered by the datasource's
 * `external.allowedSchemas`.
 */
export interface RemoteTable {
  /** Remote schema/database qualifier, when the dialect has one. */
  schema?: string;
  /** Remote table/view name. */
  name: string;
  /** Number of columns. */
  columnCount: number;
  /** Approximate row count, when the driver can supply it cheaply. */
  rowCountEstimate?: number;
}

/**
 * Options controlling how a remote table is turned into an `Object` draft.
 */
export interface GenerateDraftOpts {
  /** Restrict to a single remote schema. */
  remoteSchema?: string;
  /** Remote column → local field name overrides. */
  rename?: Record<string, string>;
  /** Override primary-key detection. */
  primaryKey?: string[];
  /** Only include these remote columns. */
  includeColumns?: string[];
  /** Exclude these remote columns. */
  excludeColumns?: string[];
}

/**
 * A generated `Object` draft: both the structured definition and a ready-to-
 * write `*.object.ts` source string (with `// REVIEW:` markers on lossy
 * column mappings).
 */
export interface ObjectDraft {
  /** Suggested object name (snake_case), derived from the remote table. */
  name: string;
  /** The datasource this object is bound to. */
  datasource: string;
  /** The structured object definition (parseable by `ObjectSchema`). */
  definition: Record<string, unknown>;
  /** Rendered TypeScript source for an `*.object.ts` file. */
  source: string;
  /** Columns whose mapping is lossy or unknown, surfaced for human review. */
  review: Array<{ column: string; remoteType: string; note: string }>;
}

/** Per-object validation outcome. */
export interface SchemaValidationResult {
  ok: boolean;
  datasource: string;
  object: string;
  diffs: SchemaDiffEntry[];
}

/** Aggregate validation outcome across many federated objects. */
export interface SchemaValidationReport {
  ok: boolean;
  results: SchemaValidationResult[];
}

/**
 * External datasource service contract.
 *
 * All methods are keyed by ObjectStack identifiers (`datasource` / object
 * `name`), never by live connections — credential resolution and driver
 * acquisition are the implementation's concern.
 */
export interface IExternalDatasourceService {
  /**
   * List remote tables on a federated datasource, filtered by
   * `external.allowedSchemas`.
   */
  listRemoteTables(datasource: string, opts?: { schema?: string }): Promise<RemoteTable[]>;

  /**
   * Generate an `Object` draft (structured + `*.object.ts` source) from a
   * remote table, using the type-compat matrix to map columns to field types.
   */
  generateObjectDraft(
    datasource: string,
    remoteName: string,
    opts?: GenerateDraftOpts,
  ): Promise<ObjectDraft>;

  /**
   * Refresh and persist the cached remote schema snapshot
   * (`external_catalog`). Returns the snapshot. (Persistence lands with the
   * `external_catalog` metadata type.)
   */
  refreshCatalog(datasource: string): Promise<unknown>;

  /** Validate one federated object against the live remote table. */
  validateObject(objectName: string): Promise<SchemaValidationResult>;

  /** Validate every federated object, parallelised per datasource. */
  validateAll(): Promise<SchemaValidationReport>;
}
