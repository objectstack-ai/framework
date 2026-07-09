// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Narrow ObjectQL engine surface used by job/queue adapters.
 * Keeps the adapter testable without booting a real kernel.
 *
 * IMPORTANT: matches the canonical engine API:
 *   - find: `where:` (NOT `filter:`)
 *   - update: `(table, {id, ...patch}, opts)`
 */
export interface JobEngine {
  find(object: string, options?: any): Promise<any[]>;
  insert(object: string, data: any, options?: any): Promise<any>;
  update(object: string, idOrData: any, dataOrOptions?: any, options?: any): Promise<any>;
  delete(object: string, options?: any): Promise<any>;
}

/** Stamped only in tests to make `now` deterministic. */
export interface JobClock { now(): Date }

export interface JobLogger {
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error?(msg: string, meta?: unknown): void;
}

export const SYSTEM_CTX = { isSystem: true, positions: [], permissions: [] } as const;

export function uid(prefix: string): string {
  const g: any = globalThis as any;
  if (g.crypto?.randomUUID) return `${prefix}_${g.crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(clock?: JobClock): string {
  return (clock?.now() ?? new Date()).toISOString();
}

export function parseJson<T = unknown>(raw: unknown, fallback?: T): T | undefined {
  if (raw == null) return fallback;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as T; } catch { return fallback; }
  }
  if (typeof raw === 'object') return raw as T;
  return fallback;
}
