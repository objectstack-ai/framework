// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import { SysMetadataRepository } from './sys-metadata-repository.js';

/**
 * ADR-0033 — `listDrafts` surfaces pending DRAFT rows (what an AI authored but
 * a human hasn't published). Unlike `list()` (hard-scoped to state='active'),
 * it reads state='draft' and can narrow by packageId, so the console's
 * "pending changes" view and a just-built app package aren't shown as empty.
 */
const ROWS = [
  { type: 'object', name: 'course', state: 'draft', package_id: 'app.edu', organization_id: null, updated_at: 't1', updated_by: 'ai' },
  { type: 'object', name: 'student', state: 'draft', package_id: 'app.edu', organization_id: null, updated_at: 't2', updated_by: 'ai' },
  { type: 'object', name: 'legacy', state: 'draft', package_id: null, organization_id: null, updated_at: 't3' },
  { type: 'view', name: 'course_list', state: 'draft', package_id: 'app.edu', organization_id: null, updated_at: 't5', updated_by: 'ai' },
  { type: 'object', name: 'live', state: 'active', package_id: 'app.edu', organization_id: null, updated_at: 't4' },
];

function makeRepo(rows = ROWS) {
  // Minimal engine whose find() does equality-only WHERE matching.
  const find = vi.fn(async (_table: string, q: any) => {
    const where = q?.where ?? {};
    return rows.filter((r) => Object.entries(where).every(([k, v]) => (r as any)[k] === v));
  });
  const engine = { find } as any;
  const repo = new SysMetadataRepository({ engine, organizationId: null, orgLabel: 'env' });
  return { repo, find };
}

describe('SysMetadataRepository.listDrafts (ADR-0033)', () => {
  it('returns only draft rows, projected with packageId (active rows excluded)', async () => {
    const { repo } = makeRepo();
    const out = await repo.listDrafts();
    expect(out.map((d) => d.name).sort()).toEqual(['course', 'course_list', 'legacy', 'student']);
    expect(out.find((d) => d.name === 'live')).toBeUndefined();
    expect(out.find((d) => d.name === 'course')).toMatchObject({
      type: 'object',
      packageId: 'app.edu',
      updatedAt: 't1',
      updatedBy: 'ai',
    });
    // legacy draft (no package) surfaces with packageId null
    expect(out.find((d) => d.name === 'legacy')).toMatchObject({ packageId: null });
  });

  it('filters by packageId', async () => {
    const { repo } = makeRepo();
    const out = await repo.listDrafts({ packageId: 'app.edu' });
    expect(out.map((d) => d.name).sort()).toEqual(['course', 'course_list', 'student']);
  });

  it('filters by type', async () => {
    const { repo } = makeRepo();
    const out = await repo.listDrafts({ type: 'view' });
    expect(out.map((d) => d.name)).toEqual(['course_list']);
  });

  it('queries state=draft scoped to org, threading type + packageId into WHERE', async () => {
    const { repo, find } = makeRepo();
    await repo.listDrafts({ type: 'object', packageId: 'app.edu' });
    expect(find).toHaveBeenCalledWith('sys_metadata', {
      where: { organization_id: null, state: 'draft', type: 'object', package_id: 'app.edu' },
    });
  });
});
