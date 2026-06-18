// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// Metadata-driven RLS cross-owner proofs — the #1994 invariant.
//
// #1994 ("member edits others' records") was a by-id write that skipped the
// row-level predicate: `driver.update(object, id, …)` builds no AST, so RLS
// never scoped it. The clean, app-agnostic invariant that catches it without
// interpreting each sharing rule:
//
//   A user who CANNOT READ a record must not be able to WRITE it.
//   ("You can't mutate what you can't see.")
//
// Derivation, per object: admin creates a record; a fresh member (no roles or
// grants) tries to read it, then tries to mutate it by id; we re-read as admin
// to see if the row actually changed. If the member couldn't see it yet changed
// it, that's the #1994 class of hole — regardless of the app's sharing config.

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { DogfoodStack } from './harness.js';
import { deriveCrudCases } from './derive.js';

const PROBE_TYPES = new Set(['text', 'textarea', 'string']);
const MUTATION = 'rls-mutated-by-B';

export interface RlsResult {
  object: string;
  status: 'rls-consistent' | 'rls-hole' | 'member-visible' | 'skipped';
  detail?: string;
}

export interface RlsReport {
  app: string;
  results: RlsResult[];
  summary: { objects: number; consistent: number; holes: number; memberVisible: number; skipped: number };
}

export async function runRlsProofs(
  stack: DogfoodStack,
  adminToken: string,
  memberToken: string,
  config: any,
): Promise<RlsReport> {
  const cases = deriveCrudCases(config);
  const results: RlsResult[] = [];

  for (const c of cases) {
    if (c.blocked) { results.push({ object: c.object, status: 'skipped', detail: c.blocked }); continue; }

    // A plain-text field to mutate (avoid email/url/phone — their format checks
    // would reject the probe for a benign reason, masking the RLS signal).
    const probe = (c.asserts ?? []).find((a) => PROBE_TYPES.has(a.type));
    if (!probe) { results.push({ object: c.object, status: 'skipped', detail: 'no plain-text probe field' }); continue; }

    // Admin (owner) creates the record.
    const created = await stack.apiAs(adminToken, 'POST', `/data/${c.object}`, c.body);
    if (created.status >= 300) {
      results.push({ object: c.object, status: 'skipped', detail: `admin create failed (${created.status})` });
      continue;
    }
    const cj = (await created.json()) as any;
    const id = cj?.id ?? cj?.record?.id;
    if (!id) { results.push({ object: c.object, status: 'skipped', detail: 'no id from create' }); continue; }

    // Member B: can they SEE it?
    const bRead = await stack.apiAs(memberToken, 'GET', `/data/${c.object}/${id}`);
    let canRead = false;
    if (bRead.status === 200) {
      const rec = ((await bRead.json()) as any)?.record;
      canRead = !!rec && rec.id === id;
    }

    // Member B: try to MUTATE it by id.
    const bWrite = await stack.apiAs(memberToken, 'PATCH', `/data/${c.object}/${id}`, { [probe.field]: MUTATION });

    // Ground truth: re-read as admin — did the row actually change?
    const after = await stack.apiAs(adminToken, 'GET', `/data/${c.object}/${id}`);
    const afterVal = (((await after.json()) as any)?.record ?? {})[probe.field];
    const changed = afterVal === MUTATION;

    if (canRead) {
      results.push({ object: c.object, status: 'member-visible', detail: 'member can read this object — not a cross-owner scenario (no RLS isolation, or read is granted)' });
    } else if (changed) {
      results.push({
        object: c.object,
        status: 'rls-hole',
        detail: `member B cannot read it (GET ${bRead.status}) yet MUTATED it by id (PATCH ${bWrite.status}) — by-id write bypassed RLS (#1994 class)`,
      });
    } else {
      results.push({
        object: c.object,
        status: 'rls-consistent',
        detail: `member B cannot read (GET ${bRead.status}) and could not mutate (PATCH ${bWrite.status}, row unchanged)`,
      });
    }
  }

  const summary = {
    objects: results.length,
    consistent: results.filter((r) => r.status === 'rls-consistent').length,
    holes: results.filter((r) => r.status === 'rls-hole').length,
    memberVisible: results.filter((r) => r.status === 'member-visible').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
  };
  return { app: config?.manifest?.id ?? 'app', results, summary };
}

export function formatRlsReport(report: RlsReport): string {
  const lines: string[] = [`\n=== objectstack verify (RLS / #1994) — ${report.app} ===`];
  for (const r of report.results) {
    const mark = r.status === 'rls-hole' ? '✗✗' : r.status === 'rls-consistent' ? '✓' : r.status === 'member-visible' ? '·' : '–';
    lines.push(`  ${mark} ${r.object}  [${r.status}] ${r.detail ?? ''}`);
  }
  const s = report.summary;
  lines.push(`  ── ${s.consistent} consistent, ${s.holes} HOLES, ${s.memberVisible} member-visible, ${s.skipped} skipped`);
  return lines.join('\n');
}
