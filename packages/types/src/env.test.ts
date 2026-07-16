// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  _resetEnvDeprecationWarnings,
  readEnvWithDeprecation,
  resolveAllowDegradedTenancy,
  resolveSearchPinyinEnabled,
} from './env.js';

describe('readEnvWithDeprecation', () => {
  const originalPreferred = process.env.OS_TEST_FOO;
  const originalLegacy = process.env.TEST_FOO;

  afterEach(() => {
    if (originalPreferred === undefined) delete process.env.OS_TEST_FOO;
    else process.env.OS_TEST_FOO = originalPreferred;
    if (originalLegacy === undefined) delete process.env.TEST_FOO;
    else process.env.TEST_FOO = originalLegacy;
    _resetEnvDeprecationWarnings();
    vi.restoreAllMocks();
  });

  it('returns the preferred OS_ value when set and stays silent', () => {
    process.env.OS_TEST_FOO = 'os-value';
    process.env.TEST_FOO = 'legacy-value';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(readEnvWithDeprecation('OS_TEST_FOO', 'TEST_FOO')).toBe('os-value');
    expect(warn).not.toHaveBeenCalled();
  });

  it('falls back to the legacy alias and warns exactly once per process', () => {
    delete process.env.OS_TEST_FOO;
    process.env.TEST_FOO = 'legacy-value';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(readEnvWithDeprecation('OS_TEST_FOO', 'TEST_FOO')).toBe('legacy-value');
    expect(readEnvWithDeprecation('OS_TEST_FOO', 'TEST_FOO')).toBe('legacy-value');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('TEST_FOO');
    expect(String(warn.mock.calls[0][0])).toContain('OS_TEST_FOO');
    expect(String(warn.mock.calls[0][0])).toContain('deprecated');
  });

  it('returns the legacy value without warning when silent is set', () => {
    delete process.env.OS_TEST_FOO;
    process.env.TEST_FOO = 'legacy-value';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(
      readEnvWithDeprecation('OS_TEST_FOO', 'TEST_FOO', { silent: true }),
    ).toBe('legacy-value');
    expect(warn).not.toHaveBeenCalled();
  });

  it('returns undefined and does not warn when neither var is set', () => {
    delete process.env.OS_TEST_FOO;
    delete process.env.TEST_FOO;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(readEnvWithDeprecation('OS_TEST_FOO', 'TEST_FOO')).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it('treats empty string as set (operator opt-in to blank value)', () => {
    process.env.OS_TEST_FOO = '';
    process.env.TEST_FOO = 'legacy-value';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(readEnvWithDeprecation('OS_TEST_FOO', 'TEST_FOO')).toBe('');
    expect(warn).not.toHaveBeenCalled();
  });

  it('checks legacy aliases in order and warns for the matched one', () => {
    const originalAlt = process.env.ALT_TEST_FOO;
    try {
      delete process.env.OS_TEST_FOO;
      delete process.env.TEST_FOO;
      process.env.ALT_TEST_FOO = 'alt-value';
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(
        readEnvWithDeprecation('OS_TEST_FOO', ['TEST_FOO', 'ALT_TEST_FOO']),
      ).toBe('alt-value');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('ALT_TEST_FOO');
    } finally {
      if (originalAlt === undefined) delete process.env.ALT_TEST_FOO;
      else process.env.ALT_TEST_FOO = originalAlt;
    }
  });

  it('first legacy alias wins when multiple are set', () => {
    const originalAlt = process.env.ALT_TEST_FOO;
    try {
      delete process.env.OS_TEST_FOO;
      process.env.TEST_FOO = 'first-legacy';
      process.env.ALT_TEST_FOO = 'second-legacy';
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(
        readEnvWithDeprecation('OS_TEST_FOO', ['TEST_FOO', 'ALT_TEST_FOO']),
      ).toBe('first-legacy');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('TEST_FOO');
    } finally {
      if (originalAlt === undefined) delete process.env.ALT_TEST_FOO;
      else process.env.ALT_TEST_FOO = originalAlt;
    }
  });
});

describe('resolveAllowDegradedTenancy (ADR-0093 D5)', () => {
  const original = process.env.OS_ALLOW_DEGRADED_TENANCY;
  afterEach(() => {
    if (original === undefined) delete process.env.OS_ALLOW_DEGRADED_TENANCY;
    else process.env.OS_ALLOW_DEGRADED_TENANCY = original;
  });

  it('defaults OFF (unset → fail fast)', () => {
    delete process.env.OS_ALLOW_DEGRADED_TENANCY;
    expect(resolveAllowDegradedTenancy()).toBe(false);
  });

  it('accepts truthy opt-in values case-insensitively', () => {
    for (const v of ['1', 'true', 'TRUE', 'on', 'Yes']) {
      process.env.OS_ALLOW_DEGRADED_TENANCY = v;
      expect(resolveAllowDegradedTenancy()).toBe(true);
    }
  });

  it('treats anything else as off', () => {
    for (const v of ['0', 'false', 'off', 'no', '', 'maybe']) {
      process.env.OS_ALLOW_DEGRADED_TENANCY = v;
      expect(resolveAllowDegradedTenancy()).toBe(false);
    }
  });
});

describe('resolveSearchPinyinEnabled (#2486)', () => {
  const original = process.env.OS_SEARCH_PINYIN_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.OS_SEARCH_PINYIN_ENABLED;
    else process.env.OS_SEARCH_PINYIN_ENABLED = original;
  });

  it('defaults OFF with no env and no locales', () => {
    delete process.env.OS_SEARCH_PINYIN_ENABLED;
    expect(resolveSearchPinyinEnabled()).toBe(false);
    expect(resolveSearchPinyinEnabled({ locales: [] })).toBe(false);
    expect(resolveSearchPinyinEnabled({ locales: ['en', 'ja-JP'] })).toBe(false);
  });

  it('derives ON from any configured zh-* locale when env is unset', () => {
    delete process.env.OS_SEARCH_PINYIN_ENABLED;
    for (const locales of [['zh-CN'], ['en', 'zh-TW'], ['zh'], ['ZH-hans'], ['en', 'zh_CN']]) {
      expect(resolveSearchPinyinEnabled({ locales })).toBe(true);
    }
    expect(resolveSearchPinyinEnabled({ locales: ['zhx-nonsense'] })).toBe(false);
  });

  it('explicit env overrides the locale-derived default in both directions', () => {
    process.env.OS_SEARCH_PINYIN_ENABLED = 'false';
    expect(resolveSearchPinyinEnabled({ locales: ['zh-CN'] })).toBe(false);
    process.env.OS_SEARCH_PINYIN_ENABLED = 'true';
    expect(resolveSearchPinyinEnabled({ locales: ['en'] })).toBe(true);
    expect(resolveSearchPinyinEnabled()).toBe(true);
  });

  it('accepts truthy values case-insensitively; anything else is off', () => {
    for (const v of ['1', 'true', 'TRUE', 'on', 'Yes']) {
      process.env.OS_SEARCH_PINYIN_ENABLED = v;
      expect(resolveSearchPinyinEnabled()).toBe(true);
    }
    for (const v of ['0', 'false', 'off', 'no', 'maybe']) {
      process.env.OS_SEARCH_PINYIN_ENABLED = v;
      expect(resolveSearchPinyinEnabled()).toBe(false);
    }
  });
});
