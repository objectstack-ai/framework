// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
    declaresMultiNode,
    assertClusterDriverSafeForTopology,
} from './split-brain-guard.js';

describe('declaresMultiNode', () => {
    it('false when nothing declared', () => {
        expect(declaresMultiNode({})).toBe(false);
    });
    it('true for OS_EXPECT_MULTI_NODE=true (case-insensitive, trimmed)', () => {
        expect(declaresMultiNode({ OS_EXPECT_MULTI_NODE: 'true' })).toBe(true);
        expect(declaresMultiNode({ OS_EXPECT_MULTI_NODE: ' TRUE ' })).toBe(true);
    });
    it('false for OS_EXPECT_MULTI_NODE=false / other', () => {
        expect(declaresMultiNode({ OS_EXPECT_MULTI_NODE: 'false' })).toBe(false);
        expect(declaresMultiNode({ OS_EXPECT_MULTI_NODE: '1' })).toBe(false);
    });
    it('replicas: >1 true, <=1 false, non-numeric false', () => {
        expect(declaresMultiNode({ OS_CLUSTER_REPLICAS: '3' })).toBe(true);
        expect(declaresMultiNode({ OS_CLUSTER_REPLICAS: '1' })).toBe(false);
        expect(declaresMultiNode({ OS_CLUSTER_REPLICAS: '0' })).toBe(false);
        expect(declaresMultiNode({ OS_CLUSTER_REPLICAS: 'abc' })).toBe(false);
    });
});

describe('assertClusterDriverSafeForTopology', () => {
    it('no throw: single-node + memory (the common case)', () => {
        expect(() => assertClusterDriverSafeForTopology('memory', {})).not.toThrow();
    });
    it('no throw: multi-node + remote driver', () => {
        expect(() =>
            assertClusterDriverSafeForTopology('redis', { OS_EXPECT_MULTI_NODE: 'true' }),
        ).not.toThrow();
    });
    it('THROWS: multi-node (OS_EXPECT_MULTI_NODE) + memory', () => {
        expect(() =>
            assertClusterDriverSafeForTopology('memory', { OS_EXPECT_MULTI_NODE: 'true' }),
        ).toThrow(/split-brain/);
    });
    it('THROWS: multi-node (replicas>1) + memory, cites ADR-0010', () => {
        expect(() =>
            assertClusterDriverSafeForTopology('memory', { OS_CLUSTER_REPLICAS: '2' }),
        ).toThrow(/ADR-0010/);
    });
    it('escape hatch: multi-node + memory + OS_ALLOW_MEMORY_CLUSTER_MULTINODE=true', () => {
        expect(() =>
            assertClusterDriverSafeForTopology('memory', {
                OS_EXPECT_MULTI_NODE: 'true',
                OS_ALLOW_MEMORY_CLUSTER_MULTINODE: 'true',
            }),
        ).not.toThrow();
    });
    it('does not guard unknown custom drivers (author responsibility)', () => {
        expect(() =>
            assertClusterDriverSafeForTopology('mycustom', { OS_EXPECT_MULTI_NODE: 'true' }),
        ).not.toThrow();
    });
});
