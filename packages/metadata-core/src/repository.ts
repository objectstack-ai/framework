// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The `MetadataRepository` interface — single point of pluggability for
 * the metadata storage backend. See ADR-0008 §2.6.
 *
 * Implementations:
 *
 * - `InMemoryRepository` (this package, for tests & edge)
 * - `FileSystemRepository` (`@objectstack/metadata`)
 * - `LayeredRepository` (`@objectstack/metadata`)
 * - `PostgresRepository` (`@objectstack/metadata-postgres`, M1)
 *
 * Implementation contract — what every backend MUST guarantee:
 *
 * 1. **Atomic put.** A successful `put()` either fully applies (item
 *    visible to subsequent `get` AND an event present in the log) or
 *    does not apply at all. No half-states.
 * 2. **Monotonic seq per branch.** `seq` is strictly increasing within
 *    `(org, project, branch)`. Different branches have independent
 *    sequences.
 * 3. **Optimistic locking.** `put` and `delete` throw `ConflictError`
 *    when `parentVersion` does not match the current HEAD.
 * 4. **Canonical hashing.** `item.hash === hashSpec(item.body)` — always.
 * 5. **Event ordering.** Subscribers to `watch()` receive events in
 *    monotonically-increasing `seq` order with no gaps.
 * 6. **Resumability.** `watch(_, since)` MUST replay all events with
 *    `seq > since` before delivering live events.
 * 7. **Tombstones, not holes.** `delete` produces a `delete` event;
 *    `get` returns null but `history` still shows the lineage.
 */

import type {
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
  HistoryOptions,
  BranchRef,
  MergeStrategy,
  MergeResult,
} from './types.js';

export interface MetadataRepository {
  /** Read HEAD or a pinned version. Returns null if absent. */
  get(ref: MetaRef): Promise<MetadataItem | null>;

  /**
   * Write a new version. Atomic.
   * @throws ConflictError if `parentVersion` does not match HEAD.
   * @throws SchemaValidationError if `spec` fails Zod normalisation.
   */
  put(ref: MetaRef, spec: unknown, opts: PutOptions): Promise<PutResult>;

  /**
   * Soft-delete (tombstone). `parentVersion` is required.
   * @throws ConflictError on parent mismatch.
   */
  delete(ref: MetaRef, opts: DeleteOptions): Promise<DeleteResult>;

  /** Enumerate items matching a filter. Implementations may stream. */
  list(filter: ListFilter): AsyncIterable<MetadataItemHeader>;

  /** Per-item history; events in monotonic `seq` order. */
  history(ref: MetaRef, opts?: HistoryOptions): AsyncIterable<MetadataEvent>;

  /**
   * Live event stream. The iterator MUST:
   *
   *   - Replay all events with `seq > since` before yielding any new event.
   *   - Stay open until the consumer breaks the loop.
   *   - Survive transient backend disconnects (implementation's choice
   *     how to resume — Postgres LISTEN reconnect, JSONL tail, etc.).
   */
  watch(filter: WatchFilter, since?: number): AsyncIterable<MetadataEvent>;

  // ── Branch ops are optional in M0/M1 ────────────────────────────────

  /** M2+: create a new branch from an existing one. */
  fork?(from: BranchRef, to: BranchRef): Promise<void>;

  /** M2+: merge a source branch into a destination branch. */
  merge?(
    from: BranchRef,
    to: BranchRef,
    strategy: MergeStrategy,
  ): Promise<MergeResult>;
}

/**
 * Sentinel symbol used by `LayeredRepository` (M0 PR-5) to label which
 * underlying layer emitted an event. Defined here so the contract is
 * shared.
 */
export const LAYER_SOURCE = Symbol.for('objectstack.metadata.layer-source');
