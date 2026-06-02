// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Logger } from '@objectstack/spec/contracts';
import type { SuspendedRun, SuspendedRunStore } from './engine.js';

/**
 * Durable persistence for suspended flow runs (ADR-0019).
 *
 * The engine keeps an in-memory map of paused runs; that map is lost on a
 * process restart (e.g. a hibernating Cloudflare Worker), so a run that paused
 * at an `approval` / `wait` / `screen` node can never be resumed afterwards.
 * A {@link SuspendedRunStore} backs the in-memory map with durable storage so a
 * cold-booted kernel can rehydrate and continue.
 *
 * Two implementations ship here:
 *   - {@link InMemorySuspendedRunStore} — a Map (the default behaviour, for
 *     tests / dev). It JSON round-trips on save/load so it faithfully exercises
 *     the serialization boundary a DB store imposes.
 *   - {@link ObjectStoreSuspendedRunStore} — persists to the `sys_automation_run`
 *     object via the ObjectQL engine, for production / serverless hosts.
 */

const TABLE = 'sys_automation_run';
const SYSTEM_CTX = { isSystem: true, roles: [], permissions: [] } as const;

/** Deep clone via JSON so a stored snapshot can't alias live engine state. */
function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Parse a JSON column that may already be an object (some drivers auto-parse). */
function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return raw as T;
}

/**
 * In-memory {@link SuspendedRunStore}. Snapshots are JSON-cloned on the way in
 * and out, matching the serialize/deserialize boundary of a DB-backed store —
 * so a unit test can share one instance across two engine instances to simulate
 * a process restart (suspend on engine A, resume on engine B).
 */
export class InMemorySuspendedRunStore implements SuspendedRunStore {
  private readonly runs = new Map<string, SuspendedRun>();

  async save(run: SuspendedRun): Promise<void> {
    this.runs.set(run.runId, jsonClone(run));
  }

  async load(runId: string): Promise<SuspendedRun | null> {
    const run = this.runs.get(runId);
    return run ? jsonClone(run) : null;
  }

  async delete(runId: string): Promise<void> {
    this.runs.delete(runId);
  }

  async list(): Promise<SuspendedRun[]> {
    return [...this.runs.values()].map(jsonClone);
  }
}

/**
 * Minimal ObjectQL engine surface the {@link ObjectStoreSuspendedRunStore} uses.
 * Matches the find/insert/update/delete shape exposed by the `objectql` service
 * (and mirrors `ApprovalEngine` in plugin-approvals).
 */
export interface SuspendedRunStoreEngine {
  find(object: string, options?: any): Promise<any[]>;
  insert(object: string, data: any, options?: any): Promise<any>;
  update(object: string, data: any, options?: any): Promise<any>;
  delete?(object: string, options?: any): Promise<any>;
}

interface MinimalLogger {
  warn?: Logger['warn'];
  debug?: Logger['debug'];
}

/**
 * Durable {@link SuspendedRunStore} backed by the `sys_automation_run` object.
 *
 * Persists the resumable run state (`variables` / `steps` / `context` / `screen`)
 * JSON-serialized, so the engine's `Map`-based variable context round-trips. The
 * row is keyed by `runId` and removed on terminal completion; only live pauses
 * are stored. All access uses a system context — these are infrastructure rows,
 * not tenant data subject to RLS (the tenant is captured in `organization_id`
 * for scoping/observability).
 */
export class ObjectStoreSuspendedRunStore implements SuspendedRunStore {
  constructor(
    private readonly engine: SuspendedRunStoreEngine,
    private readonly logger?: MinimalLogger,
  ) {}

  async save(run: SuspendedRun): Promise<void> {
    const now = new Date().toISOString();
    const row = this.serialize(run);
    // Upsert: a re-suspend (the run paused again at a downstream node) updates
    // the existing row rather than inserting a duplicate.
    const existing = await this.engine.find(TABLE, {
      where: { id: run.runId }, limit: 1, context: SYSTEM_CTX,
    });
    if (Array.isArray(existing) && existing[0]) {
      await this.engine.update(
        TABLE,
        { ...row, updated_at: now },
        { where: { id: run.runId }, context: SYSTEM_CTX },
      );
    } else {
      await this.engine.insert(
        TABLE,
        { ...row, created_at: now, updated_at: now },
        { context: SYSTEM_CTX },
      );
    }
  }

  async load(runId: string): Promise<SuspendedRun | null> {
    const rows = await this.engine.find(TABLE, {
      where: { id: runId }, limit: 1, context: SYSTEM_CTX,
    });
    const row = Array.isArray(rows) ? rows[0] : null;
    return row ? this.deserialize(row) : null;
  }

  async delete(runId: string): Promise<void> {
    if (typeof this.engine.delete !== 'function') {
      this.logger?.warn?.(
        `[automation] ObjectStoreSuspendedRunStore: engine has no delete(); suspended run '${runId}' row not removed`,
      );
      return;
    }
    await this.engine.delete(TABLE, { where: { id: runId }, context: SYSTEM_CTX });
  }

  async list(): Promise<SuspendedRun[]> {
    const rows = await this.engine.find(TABLE, {
      where: { status: 'paused' }, limit: 1000, context: SYSTEM_CTX,
    });
    return (Array.isArray(rows) ? rows : []).map(r => this.deserialize(r));
  }

  /** Flatten a run into a `sys_automation_run` row (state columns JSON-encoded). */
  private serialize(run: SuspendedRun): Record<string, unknown> {
    const ctx = (run.context ?? {}) as Record<string, unknown>;
    const org = ctx.organizationId ?? ctx.tenantId ?? null;
    return {
      id: run.runId,
      organization_id: org,
      flow_name: run.flowName,
      flow_version: run.flowVersion ?? null,
      node_id: run.nodeId,
      status: 'paused',
      correlation: run.correlation ?? null,
      user_id: ctx.userId ?? null,
      variables_json: JSON.stringify(run.variables ?? {}),
      steps_json: JSON.stringify(run.steps ?? []),
      context_json: JSON.stringify(run.context ?? {}),
      screen_json: run.screen ? JSON.stringify(run.screen) : null,
      started_at: run.startedAt,
      start_time: run.startTime ?? null,
    };
  }

  /** Rebuild a run from a `sys_automation_run` row. */
  private deserialize(row: any): SuspendedRun {
    const startedAt = row.started_at ?? new Date().toISOString();
    return {
      runId: String(row.id),
      flowName: String(row.flow_name ?? ''),
      flowVersion: row.flow_version ?? undefined,
      nodeId: String(row.node_id ?? ''),
      variables: parseJson<Record<string, unknown>>(row.variables_json, {}),
      steps: parseJson<SuspendedRun['steps']>(row.steps_json, []),
      context: parseJson<SuspendedRun['context']>(row.context_json, {}),
      startedAt,
      startTime: typeof row.start_time === 'number' ? row.start_time : (Date.parse(startedAt) || Date.now()),
      correlation: row.correlation ?? undefined,
      screen: parseJson<SuspendedRun['screen']>(row.screen_json, undefined as any),
    };
  }
}
