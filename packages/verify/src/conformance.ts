// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Conformance ledger — the reusable platform pattern (ADR-0060).
 *
 * A "conformance ledger" classifies every declarable property of a surface into
 * exactly one honest state — `enforced` / `experimental` / `removed` (ADR-0049) —
 * names the runtime site that enforces it, and (for high-risk) references a proof.
 * The platform hand-wrote this twice (ADR-0056 D10 authz matrix, ADR-0058 D7
 * expression surface) before promoting the shared invariants here.
 *
 * `checkLedger` returns a list of problems (empty = sound) so the helper carries
 * no test-runner dependency — callers assert `toEqual([])`. The optional
 * `discover` enables the **ratchet**: re-derive the real surface from source and
 * fail when a declaration is unclassified (the #1887 / declared-but-unenforced
 * class) or a `covers` entry is stale.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type ConformanceState = 'enforced' | 'experimental' | 'removed';

export interface ConformanceRow {
  /** Stable unique id. */
  id: string;
  /** One-line human summary. */
  summary: string;
  /** The declaration site this row classifies (free-form; e.g. `file:field`). */
  surface?: string;
  /** Exactly one honest state (ADR-0049). */
  state: ConformanceState;
  /** Runtime enforcement site — REQUIRED when `state === 'enforced'`. */
  enforcement?: string;
  /** Proof path (resolved against {@link CheckLedgerOptions.proofRoot}); file must exist. */
  proof?: string;
  /** Ratchet keys this row accounts for (matched against `discover()`). */
  covers?: string[];
  /** Rationale — REQUIRED when `state !== 'enforced'`. */
  note?: string;
  /** Per-surface extras (dialect, mode, fail-policy, …) — not checked here. */
  meta?: Record<string, unknown>;
}

export interface CheckLedgerOptions {
  /** Directory each row's `proof` is resolved against. */
  proofRoot: string;
  /** Re-derive the real surface from source; enables the ratchet. */
  discover?: () => Iterable<string>;
  /** Row ids that MUST carry a proof. */
  highRisk?: string[];
  /** When true, EVERY enforced row must carry a proof (default: only high-risk). */
  proofRequiredForEnforced?: boolean;
}

const VALID_STATES: ReadonlySet<string> = new Set(['enforced', 'experimental', 'removed']);

/**
 * Assert a conformance ledger's shared invariants. Returns a list of problem
 * strings; an empty array means the ledger is sound.
 */
export function checkLedger(rows: readonly ConformanceRow[], opts: CheckLedgerOptions): string[] {
  const problems: string[] = [];

  // Unique ids.
  const seenIds = new Set<string>();
  for (const r of rows) {
    if (seenIds.has(r.id)) problems.push(`duplicate id: ${r.id}`);
    seenIds.add(r.id);
  }

  for (const r of rows) {
    if (!VALID_STATES.has(r.state)) problems.push(`${r.id}: invalid state '${r.state}'`);
    if (!r.summary) problems.push(`${r.id}: missing summary`);
    if (r.state === 'enforced' && !r.enforcement) problems.push(`${r.id}: enforced but names no enforcement site`);
    if (r.state !== 'enforced' && !r.note) problems.push(`${r.id}: ${r.state} but carries no note (honest rationale)`);
    if (r.proof && !existsSync(join(opts.proofRoot, r.proof))) problems.push(`${r.id}: proof missing on disk: ${r.proof}`);
    if (opts.proofRequiredForEnforced && r.state === 'enforced' && !r.proof) problems.push(`${r.id}: enforced but carries no proof`);
  }

  // High-risk rows must carry a proof.
  for (const id of opts.highRisk ?? []) {
    const r = rows.find((x) => x.id === id);
    if (!r) problems.push(`high-risk id not in ledger: ${id}`);
    else if (!r.proof) problems.push(`high-risk ${id} must carry a proof`);
  }

  // `covers`: each surface classified by exactly one row.
  const covered = new Map<string, string>();
  for (const r of rows) {
    for (const c of r.covers ?? []) {
      const prev = covered.get(c);
      if (prev) problems.push(`surface "${c}" classified by more than one row (${prev}, ${r.id})`);
      else covered.set(c, r.id);
    }
  }

  // The ratchet: every discovered surface is covered; no stale covers.
  if (opts.discover) {
    const discovered = new Set(opts.discover());
    for (const s of discovered) {
      if (!covered.has(s)) problems.push(`UNCLASSIFIED surface — add a ledger row (ADR-0060): ${s}`);
    }
    for (const c of covered.keys()) {
      if (!discovered.has(c)) problems.push(`STALE covers — surface no longer in source: ${c}`);
    }
  }

  return problems;
}
