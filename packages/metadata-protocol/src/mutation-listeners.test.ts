// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Metadata-mutation listener contract (#2588).
 *
 * `onMetadataMutation` is the post-persistence notification every authoring
 * surface funnels through (saveMetaItem / publishMetaItem / deleteMetaItem
 * all emit). Runtime consumers — first: ObjectQLPlugin's authored-hook
 * rebind — subscribe to it instead of each HTTP surface hand-announcing.
 * The end-to-end emit points are exercised by the runtime integration flow;
 * these tests pin the listener contract itself.
 */

import { describe, it, expect, vi } from 'vitest';
import { ObjectStackProtocolImplementation } from './protocol.js';
import type { MetadataMutationEvent } from './protocol.js';

function makeProtocol() {
  // The listener plumbing never touches the engine.
  return new ObjectStackProtocolImplementation({} as any);
}

const evt = (over: Partial<MetadataMutationEvent> = {}): MetadataMutationEvent => ({
  type: 'hook',
  name: 'rebind_probe_hook',
  state: 'active',
  organizationId: null,
  ...over,
});

describe('ObjectStackProtocolImplementation.onMetadataMutation', () => {
  it('notifies subscribed listeners with the event', () => {
    const p = makeProtocol();
    const seen: MetadataMutationEvent[] = [];
    p.onMetadataMutation((e) => seen.push(e));

    (p as any).emitMetadataMutation(evt());
    (p as any).emitMetadataMutation(evt({ state: 'deleted' }));

    expect(seen.map((e) => e.state)).toEqual(['active', 'deleted']);
    expect(seen[0].type).toBe('hook');
    expect(seen[0].name).toBe('rebind_probe_hook');
  });

  it('returns an unsubscribe function that stops delivery', () => {
    const p = makeProtocol();
    const listener = vi.fn();
    const unsubscribe = p.onMetadataMutation(listener);

    (p as any).emitMetadataMutation(evt());
    unsubscribe();
    (p as any).emitMetadataMutation(evt());

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('isolates a throwing listener — remaining listeners still run', () => {
    const p = makeProtocol();
    const after = vi.fn();
    p.onMetadataMutation(() => { throw new Error('boom'); });
    p.onMetadataMutation(after);

    expect(() => (p as any).emitMetadataMutation(evt())).not.toThrow();
    expect(after).toHaveBeenCalledTimes(1);
  });
});

// ADR-0094 — the AWAITED per-type projector seam. Unlike the listeners above
// (fire-and-forget), a registered projector runs inside the metadata write and
// its outcome is surfaced as `projectionApplied`. These tests pin the seam's
// contract (dispatch, plural normalization, replace-on-reregister, failure
// isolation); the save/publish/delete invocation points are exercised by the
// plugin-security projection suite against a mock protocol.
describe('ObjectStackProtocolImplementation.registerMutationProjector (ADR-0094)', () => {
  it('runs the registered projector for its type and reports success', async () => {
    const p = makeProtocol();
    const seen: any[] = [];
    p.registerMutationProjector('permission', async (e) => { seen.push(e); });

    const out = await (p as any).runMutationProjector(evt({ type: 'permission', body: { name: 'x' } }));
    expect(out).toEqual({ success: true });
    expect(seen).toHaveLength(1);
    expect(seen[0].type).toBe('permission');
    expect(seen[0].body).toEqual({ name: 'x' });
  });

  it('returns undefined when no projector is registered for the type', async () => {
    const p = makeProtocol();
    p.registerMutationProjector('permission', async () => {});
    expect(await (p as any).runMutationProjector(evt({ type: 'view' }))).toBeUndefined();
  });

  it('normalizes plural type names on registration', async () => {
    const p = makeProtocol();
    const projector = vi.fn(async () => {});
    p.registerMutationProjector('permissions', projector);
    await (p as any).runMutationProjector(evt({ type: 'permission' }));
    expect(projector).toHaveBeenCalledTimes(1);
  });

  it('a second registration replaces the first (idempotent re-init)', async () => {
    const p = makeProtocol();
    const first = vi.fn(async () => {});
    const second = vi.fn(async () => {});
    p.registerMutationProjector('permission', first);
    p.registerMutationProjector('permission', second);
    await (p as any).runMutationProjector(evt({ type: 'permission' }));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('a throwing projector is surfaced as { success:false, error }, never thrown', async () => {
    const p = makeProtocol();
    p.registerMutationProjector('permission', async () => { throw new Error('projection boom'); });
    const out = await (p as any).runMutationProjector(evt({ type: 'permission' }));
    expect(out).toEqual({ success: false, error: 'projection boom' });
  });
});

// ADR-0094 D5 / framework#2898 — the per-type authoring gate seam. Run inside
// saveMetaItem before persistence; a returned rejection becomes a thrown Error
// carrying code/status. A gate that itself throws is fail-open (logged).
describe('ObjectStackProtocolImplementation.registerAuthoringGate (ADR-0094 D5)', () => {
  const gateArgs = (over: Record<string, unknown> = {}) => ({
    type: 'permission', name: 'crm_rep', item: {}, organizationId: null, packageId: null, mode: 'publish' as const, ...over,
  });

  it('no-ops when no gate is registered for the type', async () => {
    const p = makeProtocol();
    await expect((p as any).runAuthoringGate(gateArgs())).resolves.toBeUndefined();
  });

  it('throws a structured Error when the gate rejects', async () => {
    const p = makeProtocol();
    p.registerAuthoringGate('permission', async () => ({ code: 'package_owned', status: 403, message: 'nope' }));
    await expect((p as any).runAuthoringGate(gateArgs())).rejects.toMatchObject({ message: 'nope', code: 'package_owned', status: 403 });
  });

  it('passes when the gate returns null/void', async () => {
    const p = makeProtocol();
    p.registerAuthoringGate('permission', async () => null);
    await expect((p as any).runAuthoringGate(gateArgs())).resolves.toBeUndefined();
  });

  it('normalizes plural type names and passes the singular type to the gate', async () => {
    const p = makeProtocol();
    let seenType = '';
    p.registerAuthoringGate('permissions', async (a: any) => { seenType = a.type; return null; });
    await (p as any).runAuthoringGate(gateArgs({ type: 'permission' }));
    expect(seenType).toBe('permission');
  });

  it('is FAIL-OPEN when the gate throws (allows the save, logged)', async () => {
    const p = makeProtocol();
    p.registerAuthoringGate('permission', async () => { throw new Error('lookup down'); });
    await expect((p as any).runAuthoringGate(gateArgs())).resolves.toBeUndefined();
  });
});
