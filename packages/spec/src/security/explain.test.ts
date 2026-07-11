// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Contract lock for the public explain / access-matrix schemas (ADR-0090 D6).
 *
 * These schemas are the wire contract that downstream consumers depend on —
 * notably the ADR-0091 **L3** enterprise product (cloud `security-enterprise`:
 * recertification review UX, evidence export, break-glass attribution) reads
 * `ExplainDecision.layers[].contributors[]` and `AccessMatrixEntry` directly.
 *
 * `api-surface.json` already locks the export NAMES (a removed export fails the
 * lint gate); this file locks the FIELD SHAPE (a removed/renamed field, a
 * dropped enum member, or a changed default). Together they make explain a
 * stable contract cloud can consume without drift fear. Any break here is a
 * deliberate, reviewable protocol change — bump the protocol major with it.
 */

import { describe, it, expect } from 'vitest';
import {
  ExplainOperationSchema,
  ExplainLayerSchema,
  ExplainRequestSchema,
  ExplainDecisionSchema,
  AccessMatrixEntrySchema,
  AccessMatrixSchema,
} from './explain.zod';

describe('ExplainOperationSchema — the operation vocabulary is fixed', () => {
  it('accepts exactly the seven CRUD + lifecycle operations', () => {
    for (const op of ['read', 'create', 'update', 'delete', 'transfer', 'restore', 'purge']) {
      expect(ExplainOperationSchema.parse(op)).toBe(op);
    }
  });
  it('rejects an unknown operation', () => {
    expect(() => ExplainOperationSchema.parse('list')).toThrow();
  });
});

describe('ExplainLayerSchema — the nine-layer pipeline + contributor shape', () => {
  const LAYERS = [
    'principal', 'required_permissions', 'object_crud', 'fls',
    'owd_baseline', 'depth', 'sharing', 'vama_bypass', 'rls',
  ];
  it('locks the nine layer ids, in order', () => {
    for (const layer of LAYERS) {
      expect(ExplainLayerSchema.parse({ layer, verdict: 'neutral', detail: 'x' }).layer).toBe(layer);
    }
    expect(() => ExplainLayerSchema.parse({ layer: 'tenant', verdict: 'neutral', detail: 'x' })).toThrow();
  });

  it('locks the six verdicts', () => {
    for (const verdict of ['grants', 'denies', 'narrows', 'widens', 'neutral', 'not_applicable']) {
      expect(ExplainLayerSchema.parse({ layer: 'rls', verdict, detail: 'x' }).verdict).toBe(verdict);
    }
    expect(() => ExplainLayerSchema.parse({ layer: 'rls', verdict: 'allows', detail: 'x' })).toThrow();
  });

  it('contributors default to [] and carry kind / name / via / state', () => {
    const bare = ExplainLayerSchema.parse({ layer: 'principal', verdict: 'neutral', detail: 'x' });
    expect(bare.contributors).toEqual([]);

    const full = ExplainLayerSchema.parse({
      layer: 'principal',
      verdict: 'neutral',
      detail: 'x',
      contributors: [
        { kind: 'position', name: 'approver', via: 'delegation from u_boss until 2026-08-01', state: 'active' },
        { kind: 'permission_set', name: 'approve_set', via: 'position:approver' },
        { kind: 'position', name: 'payroll_approver', via: 'held until 2026-07-01 — expired', state: 'expired' },
        { kind: 'system', name: 'platform_admin' },
      ],
    });
    expect(full.contributors.map((c) => c.kind)).toEqual(['position', 'permission_set', 'position', 'system']);
    // [ADR-0091 D2] the lifecycle state member L3 reads for the "expired" report
    expect(full.contributors[2].state).toBe('expired');
    expect(full.contributors[1].state).toBeUndefined();
  });

  it('rejects an unknown contributor kind or lifecycle state', () => {
    expect(() => ExplainLayerSchema.parse({
      layer: 'principal', verdict: 'neutral', detail: 'x',
      contributors: [{ kind: 'role', name: 'x' }],
    })).toThrow();
    expect(() => ExplainLayerSchema.parse({
      layer: 'principal', verdict: 'neutral', detail: 'x',
      contributors: [{ kind: 'position', name: 'x', state: 'suspended' }],
    })).toThrow();
  });
});

describe('ExplainRequestSchema — the request contract', () => {
  it('requires object + operation; userId optional', () => {
    expect(ExplainRequestSchema.parse({ object: 'leave_request', operation: 'read' })).toMatchObject({
      object: 'leave_request', operation: 'read',
    });
    expect(ExplainRequestSchema.parse({ object: 'x', operation: 'update', userId: 'u2' }).userId).toBe('u2');
    expect(() => ExplainRequestSchema.parse({ operation: 'read' })).toThrow();
  });
});

describe('ExplainDecisionSchema — the full decision report L3 consumes', () => {
  it('round-trips a representative decision with every field L3 reads', () => {
    const decision = {
      allowed: true,
      object: 'leave_request',
      operation: 'read',
      principal: {
        userId: 'u2',
        positions: ['approver', 'everyone'],
        permissionSets: ['approve_set', 'member_default'],
        principalKind: 'human',
        onBehalfOf: { userId: 'u9' },
      },
      layers: [
        {
          layer: 'principal', verdict: 'neutral', detail: '…',
          contributors: [{ kind: 'position', name: 'approver', via: 'delegation from u_boss until 2026-08-01', state: 'active' }],
        },
        { layer: 'rls', verdict: 'narrows', detail: '…', contributors: [] },
      ],
      readFilter: { owner: 'u2' },
    };
    const parsed = ExplainDecisionSchema.parse(decision);
    expect(parsed.allowed).toBe(true);
    expect(parsed.principal.userId).toBe('u2');
    expect(parsed.principal.positions).toContain('approver');
    expect(parsed.principal.permissionSets).toContain('approve_set');
    expect(parsed.principal.principalKind).toBe('human');
    expect(parsed.principal.onBehalfOf).toEqual({ userId: 'u9' });
    expect(parsed.layers).toHaveLength(2);
    expect(parsed.readFilter).toEqual({ owner: 'u2' });
  });

  it('principal.userId is nullable (anonymous), positions/permissionSets default to []', () => {
    const parsed = ExplainDecisionSchema.parse({
      allowed: false, object: 'x', operation: 'read',
      principal: { userId: null },
      layers: [],
    });
    expect(parsed.principal.userId).toBeNull();
    expect(parsed.principal.positions).toEqual([]);
    expect(parsed.principal.permissionSets).toEqual([]);
  });

  it('rejects an unknown principalKind', () => {
    expect(() => ExplainDecisionSchema.parse({
      allowed: true, object: 'x', operation: 'read',
      principal: { userId: 'u', principalKind: 'robot' }, layers: [],
    })).toThrow();
  });
});

describe('AccessMatrix schemas — the authoring-time companion', () => {
  it('AccessMatrixEntry locks the crud bits + super-user bypass + scopes + sharingModel', () => {
    const entry = AccessMatrixEntrySchema.parse({
      permissionSet: 'crm_admin', object: 'crm_lead',
      create: true, read: true, edit: true, delete: false,
      viewAllRecords: true, modifyAllRecords: false,
      readScope: 'unit_and_below', writeScope: 'own', sharingModel: 'private',
    });
    expect(entry).toMatchObject({
      permissionSet: 'crm_admin', object: 'crm_lead',
      create: true, read: true, edit: true, delete: false,
      viewAllRecords: true, modifyAllRecords: false,
      readScope: 'unit_and_below', writeScope: 'own', sharingModel: 'private',
    });
  });

  it('the crud + bypass bits are REQUIRED (a missing bit is a contract break)', () => {
    expect(() => AccessMatrixEntrySchema.parse({
      permissionSet: 'x', object: 'y', create: true, read: true, edit: true, delete: true,
      viewAllRecords: true, /* modifyAllRecords missing */
    })).toThrow();
  });

  it('AccessMatrix defaults version=1 and entries=[]', () => {
    expect(AccessMatrixSchema.parse({})).toEqual({ version: 1, entries: [] });
    expect(() => AccessMatrixSchema.parse({ version: 2 })).toThrow();
  });
});
