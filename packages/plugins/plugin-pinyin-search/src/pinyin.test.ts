// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { computeSearchCompanionValue } from './pinyin.js';

describe('computeSearchCompanionValue (#2486)', () => {
  it('stores full pinyin + initials in one blob ("张伟" → "zhangwei zw")', async () => {
    expect(await computeSearchCompanionValue(['张伟'])).toBe('zhangwei zw');
  });

  it('recalls every documented input shape as a substring of the blob', async () => {
    const blob = (await computeSearchCompanionValue(['张伟']))!;
    for (const typed of ['zhang', 'wei', 'zhangwei', 'zw']) {
      expect(blob.includes(typed)).toBe(true);
    }
  });

  it('handles multi-word and mixed CJK/latin values', async () => {
    const blob = (await computeSearchCompanionValue(['上海分公司']))!;
    expect(blob).toBe('shanghaifengongsi shfgs');

    const mixed = (await computeSearchCompanionValue(['张伟2号']))!;
    expect(mixed.includes('zhangwei2hao')).toBe(true);
  });

  it('returns null for non-CJK / empty / non-string values (companion cleared)', async () => {
    expect(await computeSearchCompanionValue(['Zhang Wei'])).toBe(null);
    expect(await computeSearchCompanionValue([''])).toBe(null);
    expect(await computeSearchCompanionValue([null, undefined, 42])).toBe(null);
    expect(await computeSearchCompanionValue([])).toBe(null);
  });

  it('deduplicates when initials equal the full form (single-char name)', async () => {
    const blob = (await computeSearchCompanionValue(['张']))!;
    expect(blob).toBe('zhang z');
    // no duplicated tokens
    expect(new Set(blob.split(' ')).size).toBe(blob.split(' ').length);
  });
});
