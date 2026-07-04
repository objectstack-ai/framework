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
