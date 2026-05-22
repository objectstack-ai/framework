// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ADR-0008 PR-10b — `SysMetadataRepository`.
 *
 * Wraps the existing `sys_metadata` table behind the canonical
 * `MetadataRepository` interface. Implements the *single-row update*
 * semantics that ADR-0005 already ships — append-only event-log
 * persistence is M1 work.
 *
 * What this layer DOES (M0):
 *   - get / put / delete / list against `sys_metadata`
 *   - tenancy scope = `organization_id` (per-org overlays only;
 *     project/branch concepts removed — see ADR-0006 v5 / ADR-0008
 *     branch-removal amendment)
 *   - hash stamping with `hashSpec` (PR-10a guarantees stability)
 *   - watch() implemented via an in-memory event broadcaster fed by
 *     every successful put/delete on THIS instance
 *   - whitelist enforcement: refuses to persist types whose registry
 *     entry has `allowOrgOverride: false` (Prime Directive #8)
 *
 * What this layer does NOT do (deferred to M1):
 *   - durable change log (no append-only `sys_metadata_history` writes yet)
 *   - history() — emits empty AsyncIterable
 *   - hashSpec backfill for legacy rows missing `checksum`
 *
 * What this layer does NOT do (and will not, by design):
 *   - cross-replica push notifications (LISTEN/NOTIFY, pub/sub, etc.).
 *     The watch() contract is scoped to the local repository instance.
 *     Multi-replica deployments are not a supported topology for the
 *     metadata overlay — see ADR-0008 §11.
 *
 * Schema mapping (ADR-0008 PR-10d.2):
 *   Repository concept      sys_metadata column
 *   ─────────────────────── ───────────────────
 *   body                  → metadata           (JSON string)
 *   hash (sha256)         → checksum           (text(64))
 *   monotonic version int → version            (number)
 *   org isolation         → organization_id    (lookup)
 *   actor                 → updated_by         (lookup, optional)
 *
 * Composition: PR-10c will compose
 *   `LayeredRepository([FileSystemRepository, SysMetadataRepository])`
 * and the manager bridge will route reads through that. Until then this
 * file is intentionally NOT wired into any production path — it has its
 * own test surface so we can build confidence before flipping the
 * switch.
 */

import { hashSpec, ConflictError } from '@objectstack/metadata-core';
import type {
  MetadataRepository,
  MetaRef,
  MetadataItem,
  MetadataItemHeader,
  MetadataEvent,
  PutOptions,
  PutResult,
  DeleteOptions,
  DeleteResult,
  ListFilter,
  WatchFilter,
} from '@objectstack/metadata-core';
import { DEFAULT_METADATA_TYPE_REGISTRY } from '@objectstack/spec/kernel';

/**
 * Sub-set of the ObjectQL engine shape we depend on. Kept narrow so
 * tests can stub it with a plain mock.
 */
export interface SysMetadataEngine {
  find(
    table: string,
    options: { where: Record<string, unknown>; limit?: number },
  ): Promise<any[]>;
  findOne(
    table: string,
    options: { where: Record<string, unknown> },
  ): Promise<any | null>;
  insert(table: string, data: Record<string, unknown>): Promise<{ id: string }>;
  update(
    table: string,
    data: Record<string, unknown>,
    options: { where: Record<string, unknown> },
  ): Promise<{ id: string }>;
  delete(
    table: string,
    options: { where: Record<string, unknown> },
  ): Promise<{ deleted: number }>;
}

export interface SysMetadataRepositoryOptions {
  engine: SysMetadataEngine;
  /**
   * Tenancy scope. `null` writes to env-wide overlay rows; a string
   * scopes to one organization (the supported shared-DB tenant model
   * — see ADR-0005 amendment).
   */
  organizationId?: string | null;
  /** Org label embedded in returned MetaRefs. Defaults to organizationId or `"system"`. */
  orgLabel?: string;
}

/** Derived from registry — single source of truth (Prime Directive #8). */
const OVERLAY_ALLOWED_TYPES: ReadonlySet<string> = new Set(
  DEFAULT_METADATA_TYPE_REGISTRY
    .filter((e) => e.allowOrgOverride)
    .map((e) => e.type),
);

export class SysMetadataRepository implements MetadataRepository {
  private readonly engine: SysMetadataEngine;
  private readonly organizationId: string | null;
  private readonly orgLabel: string;

  /**
   * Local seq counter. NOT cross-replica monotonic — that requires the
   * M1 Postgres `SERIAL` column. M0 callers should treat seq as a
   * "best-effort hint" and use `version` (hash) for actual identity.
   */
  private seqCounter = 0;
  private readonly watchers = new Set<(evt: MetadataEvent) => void>();
  private closed = false;

  constructor(opts: SysMetadataRepositoryOptions) {
    this.engine = opts.engine;
    this.organizationId = opts.organizationId ?? null;
    this.orgLabel = opts.orgLabel ?? (opts.organizationId ?? 'system');
  }

  /**
   * Read the current overlay row. Returns null if no row exists —
   * callers (e.g. LayeredRepository) fall through to lower layers.
   */
  async get(ref: MetaRef): Promise<MetadataItem | null> {
    this.assertOpen();
    const row = await this.engine.findOne('sys_metadata', {
      where: this.whereFor(ref),
    });
    if (!row) return null;
    return this.rowToItem(ref, row);
  }

  async put(ref: MetaRef, spec: unknown, opts: PutOptions): Promise<PutResult> {
    this.assertOpen();
    this.assertAllowed(ref.type);

    const body = (spec ?? {}) as Record<string, unknown>;
    const version = hashSpec(body);

    // Optimistic locking against current HEAD hash.
    const existing = await this.engine.findOne('sys_metadata', {
      where: this.whereFor(ref),
    });
    const existingHash: string | null = existing?.checksum ?? null;
    if (opts.parentVersion !== existingHash) {
      throw new ConflictError(this.fullRef(ref), opts.parentVersion, existingHash);
    }

    // No-op short-circuit: identical body → no write, no event.
    if (existing && existingHash === version) {
      const item = this.rowToItem(ref, existing);
      return { version, seq: item.seq, item };
    }

    this.seqCounter += 1;
    const seq = this.seqCounter;
    const now = new Date().toISOString();

    const rowData: Record<string, unknown> = {
      type: ref.type,
      name: ref.name,
      organization_id: this.organizationId,
      metadata: JSON.stringify(body),
      checksum: version,
      state: 'active',
      version: (existing?.version ?? 0) + 1,
      updated_at: now,
    };
    if (!existing) rowData.created_at = now;

    if (existing) {
      // Update by primary key — real ObjectQL.update rejects multi-row
      // where-clauses without `options.multi=true`. The overlay invariant
      // (unique active row per (type,name,org)) means existing.id is
      // unambiguous when we reach this branch.
      const existingId = (existing as { id?: string }).id;
      if (existingId === undefined) {
        throw new Error(
          `SysMetadataRepository.put: existing row for ${ref.type}/${ref.name} has no id column`,
        );
      }
      await this.engine.update('sys_metadata', rowData, {
        where: { id: existingId },
      });
    } else {
      await this.engine.insert('sys_metadata', rowData);
    }

    const item: MetadataItem = {
      ref: this.fullRef(ref),
      body,
      hash: version,
      parentHash: existingHash,
      authoredBy: opts.actor,
      authoredAt: now,
      message: opts.message,
      seq,
    };

    this.broadcast({
      seq,
      op: existing ? 'update' : 'create',
      ref: this.fullRef(ref),
      hash: version,
      parentHash: existingHash,
      actor: opts.actor,
      message: opts.message,
      ts: now,
      source: opts.source ?? 'sys-metadata-repo',
    });

    return { version, seq, item };
  }

  async delete(ref: MetaRef, opts: DeleteOptions): Promise<DeleteResult> {
    this.assertOpen();
    this.assertAllowed(ref.type);

    const existing = await this.engine.findOne('sys_metadata', {
      where: this.whereFor(ref),
    });
    if (!existing) {
      // Idempotent: deleting an absent row is treated as a conflict
      // (actual HEAD is null but caller supplied a non-null parentVersion).
      throw new ConflictError(this.fullRef(ref), opts.parentVersion, null);
    }
    const existingHash: string | null = existing.checksum ?? null;
    if (opts.parentVersion !== existingHash) {
      throw new ConflictError(this.fullRef(ref), opts.parentVersion, existingHash);
    }

    const existingId = (existing as { id?: string }).id;
    if (existingId === undefined) {
      throw new Error(
        `SysMetadataRepository.delete: existing row for ${ref.type}/${ref.name} has no id column`,
      );
    }
    await this.engine.delete('sys_metadata', { where: { id: existingId } });

    this.seqCounter += 1;
    const seq = this.seqCounter;
    const now = new Date().toISOString();

    this.broadcast({
      seq,
      op: 'delete',
      ref: this.fullRef(ref),
      hash: null,
      parentHash: existingHash,
      actor: opts.actor,
      message: opts.message,
      ts: now,
      source: opts.source ?? 'sys-metadata-repo',
    });

    return { seq };
  }

  async *list(filter: ListFilter): AsyncIterable<MetadataItemHeader> {
    this.assertOpen();
    const where: Record<string, unknown> = {
      organization_id: this.organizationId,
      state: 'active',
    };
    if (filter.type) where.type = filter.type;
    const rows = await this.engine.find('sys_metadata', {
      where,
      limit: filter.limit,
    });
    for (const row of rows) {
      if (filter.nameContains && !String(row.name).includes(filter.nameContains)) continue;
      const item = this.rowToItem(
        { ...this.fullRef({ type: row.type, name: row.name } as MetaRef) },
        row,
      );
      // Strip body for the header projection.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { body, ...header } = item;
      yield header;
    }
  }

  /**
   * M0: per-item history is not retained (single-row updates). Returns
   * an empty iterable so callers can treat the result uniformly with
   * PostgresRepository in M1.
   */
  async *history(): AsyncIterable<MetadataEvent> {
    /* intentionally empty in M0 */
  }

  /**
   * Live event stream. Fires for every successful put/delete on THIS
   * instance — cross-replica fan-out is M1. Manual AsyncIterator (not
   * an async generator) so we can deterministically tear down via
   * `iter.return()`, matching the pattern used by InMemoryRepository.
   */
  watch(filter: WatchFilter, since?: number): AsyncIterable<MetadataEvent> {
    const self = this;
    return {
      [Symbol.asyncIterator]: () => {
        const queue: MetadataEvent[] = [];
        let pendingResolve: ((r: IteratorResult<MetadataEvent>) => void) | null = null;
        let stopped = false;

        const dispatch = (evt: MetadataEvent) => {
          if (stopped) return;
          if (!self.matchesFilter(evt, filter)) return;
          if (since !== undefined && evt.seq <= since) return;
          if (pendingResolve) {
            const r = pendingResolve;
            pendingResolve = null;
            r({ value: evt, done: false });
          } else {
            queue.push(evt);
          }
        };
        self.watchers.add(dispatch);

        return {
          next(): Promise<IteratorResult<MetadataEvent>> {
            if (stopped) return Promise.resolve({ value: undefined as any, done: true });
            const buffered = queue.shift();
            if (buffered) return Promise.resolve({ value: buffered, done: false });
            return new Promise((resolve) => {
              pendingResolve = resolve;
            });
          },
          return(): Promise<IteratorResult<MetadataEvent>> {
            stopped = true;
            self.watchers.delete(dispatch);
            if (pendingResolve) {
              const r = pendingResolve;
              pendingResolve = null;
              r({ value: undefined as any, done: true });
            }
            return Promise.resolve({ value: undefined as any, done: true });
          },
        };
      },
    };
  }

  /** Shut down all watch iterators. */
  close(): void {
    this.closed = true;
    // Drain watchers — each one's `return()` removes itself.
    const snapshot = Array.from(this.watchers);
    for (const w of snapshot) {
      try {
        w({
          seq: -1,
          op: 'delete',
          ref: { org: '', type: 'view', name: '_close' } as MetaRef,
          hash: null,
          parentHash: null,
          actor: 'system',
          ts: new Date().toISOString(),
          source: 'sys-metadata-repo-close',
        });
      } catch { /* noop */ }
    }
    this.watchers.clear();
  }

  // ── helpers ─────────────────────────────────────────────────────────

  private assertOpen(): void {
    if (this.closed) throw new Error('SysMetadataRepository is closed');
  }

  private assertAllowed(type: string): void {
    if (!OVERLAY_ALLOWED_TYPES.has(type)) {
      const err: any = new Error(
        `[not_overridable] '${type}' is not allowOrgOverride in the registry. ` +
        `Allowed: ${Array.from(OVERLAY_ALLOWED_TYPES).join(', ')}.`,
      );
      err.code = 'not_overridable';
      err.status = 403;
      throw err;
    }
  }

  private whereFor(ref: Pick<MetaRef, 'type' | 'name'>): Record<string, unknown> {
    return {
      type: ref.type,
      name: ref.name,
      organization_id: this.organizationId,
      state: 'active',
    };
  }

  private fullRef(ref: Pick<MetaRef, 'type' | 'name'>): MetaRef {
    return {
      org: this.orgLabel,
      type: ref.type,
      name: ref.name,
    };
  }

  private rowToItem(ref: Pick<MetaRef, 'type' | 'name'>, row: any): MetadataItem {
    const body: Record<string, unknown> =
      typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {});
    const hash: string = row.checksum ?? hashSpec(body);
    return {
      ref: this.fullRef(ref),
      body,
      hash,
      parentHash: null,
      authoredBy: row.updated_by ?? row.created_by ?? 'unknown',
      authoredAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
      message: undefined,
      seq: this.seqCounter,
    };
  }

  private broadcast(evt: MetadataEvent): void {
    for (const w of Array.from(this.watchers)) {
      try { w(evt); } catch { /* listener errors don't break the repo */ }
    }
  }

  private matchesFilter(evt: MetadataEvent, filter: WatchFilter): boolean {
    if (filter.type && evt.ref.type !== filter.type) return false;
    if (filter.name && evt.ref.name !== filter.name) return false;
    if (filter.org && evt.ref.org !== filter.org) return false;
    return true;
  }
}
