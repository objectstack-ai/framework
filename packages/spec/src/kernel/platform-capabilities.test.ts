import { describe, expect, it } from 'vitest';
import {
  PLATFORM_CAPABILITY_TOKENS,
  DEPRECATED_PLATFORM_CAPABILITY_ALIASES,
  canonicalizePlatformCapability,
  isKnownPlatformCapability,
} from './platform-capabilities';

// framework#3265 — one capability vocabulary across the standalone serve path
// and cloud's objectos-runtime loader, canonical spelling kebab-case.

describe('PLATFORM_CAPABILITY_TOKENS', () => {
  it('is frozen and duplicate-free', () => {
    expect(Object.isFrozen(PLATFORM_CAPABILITY_TOKENS)).toBe(true);
    expect(new Set(PLATFORM_CAPABILITY_TOKENS).size).toBe(PLATFORM_CAPABILITY_TOKENS.length);
  });

  it('every token is canonical lower-case kebab-case', () => {
    for (const t of PLATFORM_CAPABILITY_TOKENS) {
      expect(t).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('contains the tier-gated and headline service tokens', () => {
    for (const t of ['ai', 'ai-studio', 'automation', 'analytics', 'pinyin-search', 'hierarchy-security']) {
      expect(PLATFORM_CAPABILITY_TOKENS).toContain(t);
    }
  });

  it('contains no deprecated spellings', () => {
    for (const legacy of Object.keys(DEPRECATED_PLATFORM_CAPABILITY_ALIASES)) {
      expect(PLATFORM_CAPABILITY_TOKENS).not.toContain(legacy);
    }
  });
});

describe('DEPRECATED_PLATFORM_CAPABILITY_ALIASES / canonicalizePlatformCapability', () => {
  it('maps every alias onto a token that exists in the vocabulary', () => {
    for (const canonical of Object.values(DEPRECATED_PLATFORM_CAPABILITY_ALIASES)) {
      expect(PLATFORM_CAPABILITY_TOKENS).toContain(canonical);
    }
  });

  it('canonicalizes the legacy cloud spellings', () => {
    expect(canonicalizePlatformCapability('aiStudio')).toBe('ai-studio');
    expect(canonicalizePlatformCapability('aiSeat')).toBe('ai-seat');
  });

  it('is identity for canonical and unknown tokens', () => {
    expect(canonicalizePlatformCapability('ai-studio')).toBe('ai-studio');
    expect(canonicalizePlatformCapability('automation')).toBe('automation');
    expect(canonicalizePlatformCapability('not-a-capability')).toBe('not-a-capability');
  });
});

describe('isKnownPlatformCapability', () => {
  it('accepts canonical tokens and deprecated aliases, rejects unknowns', () => {
    expect(isKnownPlatformCapability('ai-studio')).toBe(true);
    expect(isKnownPlatformCapability('aiStudio')).toBe(true);
    expect(isKnownPlatformCapability('governance')).toBe(true);
    expect(isKnownPlatformCapability('automations')).toBe(false);
  });
});
