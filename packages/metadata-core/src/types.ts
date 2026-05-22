// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Metadata Repository types — see ADR-0008 §2.
 *
 * All shapes are defined as Zod schemas so the same definition serves
 * runtime validation and static typing (`z.infer<typeof X>`).
 */

import { z } from 'zod';

// ─── Metadata type registry ───────────────────────────────────────────

/**
 * Canonical metadata type names. Aligned with the `MetadataTypeSchema`
 * enum in `@objectstack/spec/kernel/metadata-plugin.zod.ts`. New types are
 * added here in lockstep with that file.
 */
export const MetadataTypeSchema = z.enum([
  'object',
  'view',
  'page',
  'dashboard',
  'app',
  'flow',
  'workflow',
  'agent',
  'tool',
  'skill',
  'report',
  'translation',
  'role',
  'permission',
  'policy',
  'api',
  'endpoint',
  'datasource',
  'cube',
  'settings',
]).describe('Canonical metadata type name');

export type MetadataType = z.infer<typeof MetadataTypeSchema>;

// ─── MetaRef ──────────────────────────────────────────────────────────

/**
 * Fully-qualified reference to a metadata item. All four scopes are
 * mandatory at the storage layer; higher layers may default `org=system`,
 * `project=<current>`, `branch=main` for convenience.
 *
 * `version` is optional: omit to mean "branch HEAD", supply to pin.
 */
export const MetaRefSchema = z.object({
  org: z.string().min(1).describe('Tenant/org identifier; "system" for built-ins'),
  project: z.string().min(1).describe('Project identifier within the org'),
  branch: z.string().min(1).default('main').describe('Branch name'),
  type: MetadataTypeSchema,
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/).describe('Snake_case machine name'),
  version: z.string().optional().describe('Optional version pin (content hash); omit for HEAD'),
});

export type MetaRef = z.infer<typeof MetaRefSchema>;

/**
 * Construct a stable string key from a MetaRef (excluding `version`,
 * which is mutable). Used as cache keys and log indexes.
 */
export function refKey(ref: Pick<MetaRef, 'org' | 'project' | 'branch' | 'type' | 'name'>): string {
  return `${ref.org}/${ref.project}/${ref.branch}/${ref.type}/${ref.name}`;
}

// ─── Item & header ────────────────────────────────────────────────────

/**
 * Full metadata item as stored / returned by the Repository.
 *
 * `body` is the **canonical, Zod-normalised** spec (with defaults filled
 * in). `hash` is `sha256(canonicalize(body))`. Equal hashes imply equal
 * specs.
 */
export const MetadataItemSchema = z.object({
  ref: MetaRefSchema,
  body: z.record(z.string(), z.unknown()).describe('Canonical Zod-normalised spec'),
  hash: z.string().regex(/^sha256:[0-9a-f]{64}$/).describe('sha256(canonicalize(body))'),
  parentHash: z.string().nullable().describe('Hash this version was derived from; null for first version'),
  authoredBy: z.string().describe('Identity of the writer (user id, "cli", "ai:claude", …)'),
  authoredAt: z.string().describe('ISO-8601 timestamp'),
  message: z.string().optional().describe('Optional commit message'),
  seq: z.number().int().nonnegative().describe('Sequence number this write produced in the branch log'),
  schemaVersion: z.string().optional().describe('Zod schema version that wrote this spec (M3 codemod hook)'),
});

export type MetadataItem = z.infer<typeof MetadataItemSchema>;

/** Lightweight header for listing — `body` omitted. */
export type MetadataItemHeader = Omit<MetadataItem, 'body'>;

// ─── Change log event ─────────────────────────────────────────────────

export const MetadataOpSchema = z.enum(['create', 'update', 'delete', 'rename']);
export type MetadataOp = z.infer<typeof MetadataOpSchema>;

/**
 * The single event payload broadcast by the change log. ADR-0008 §2.4.
 *
 * For `rename`, `previousName` carries the old machine name. For
 * `delete`, `hash` is null. The payload is intentionally small —
 * consumers re-fetch via the cache when they need the full body.
 */
export const MetadataEventSchema = z.object({
  seq: z.number().int().nonnegative(),
  op: MetadataOpSchema,
  ref: MetaRefSchema,
  hash: z.string().nullable(),
  parentHash: z.string().nullable(),
  previousName: z.string().optional().describe('Set on op="rename"'),
  actor: z.string(),
  message: z.string().optional(),
  ts: z.string(),
  source: z.string().describe('Origin label: "fs", "studio", "rest", "ai", "git-import", …'),
});

export type MetadataEvent = z.infer<typeof MetadataEventSchema>;

// ─── Operation options ────────────────────────────────────────────────

export interface PutOptions {
  /**
   * Hash this writer believed was at HEAD. `null` means "creating, expect
   * absence". A mismatch throws ConflictError.
   */
  parentVersion: string | null;
  /** Identity of the writer; mirrored to MetadataEvent.actor. */
  actor: string;
  /** Optional human-readable commit message. */
  message?: string;
  /** Optional label for the change log "source" column. */
  source?: string;
}

export interface PutResult {
  /** New content hash assigned to the spec. */
  version: string;
  /** Sequence number of the emitted MetadataEvent. */
  seq: number;
  /** The committed item (canonicalised). */
  item: MetadataItem;
}

export interface DeleteOptions {
  parentVersion: string;
  actor: string;
  message?: string;
  source?: string;
}

export interface DeleteResult {
  seq: number;
}

export interface ListFilter {
  org?: string;
  project?: string;
  branch?: string;
  type?: MetadataType;
  /** Substring match on `name`; case-sensitive. */
  nameContains?: string;
  /** Pagination cursor; opaque string from a previous response. */
  cursor?: string;
  /** Page size; implementations may clamp. */
  limit?: number;
}

export interface WatchFilter {
  org?: string;
  project?: string;
  branch?: string;
  type?: MetadataType;
  /** When omitted, match all names within the scope. */
  name?: string;
}

export interface HistoryOptions {
  /** Lower bound (exclusive) for pagination. */
  sinceSeq?: number;
  limit?: number;
}

// ─── Branch ops (M2 — surface defined now to avoid churn later) ───────

export interface BranchRef {
  org: string;
  project: string;
  branch: string;
}

export type MergeStrategy = 'last-write-wins' | 'manual-resolve';

export interface MergeResult {
  applied: number;
  conflicts: Array<{
    ref: MetaRef;
    base: string | null;
    incoming: string;
    current: string;
  }>;
}
