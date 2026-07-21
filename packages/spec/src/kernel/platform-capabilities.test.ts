import { describe, expect, it } from 'vitest';
import {
  PLATFORM_CAPABILITY_TOKENS,
  isKnownPlatformCapability,
  PLATFORM_CAPABILITY_PROVIDERS,
  classifyRequiredCapability,
} from './platform-capabilities';

// framework#3265 — one capability vocabulary across the standalone serve path
// and cloud's objectos-runtime loader, canonical spelling kebab-case. The
// deprecated `aiStudio`/`aiSeat` aliases were removed in #3308.

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

  it('contains no camelCase legacy spellings (aliases removed, #3308)', () => {
    for (const legacy of ['aiStudio', 'aiSeat']) {
      expect(PLATFORM_CAPABILITY_TOKENS).not.toContain(legacy);
    }
  });
});

describe('isKnownPlatformCapability', () => {
  it('accepts canonical tokens verbatim', () => {
    expect(isKnownPlatformCapability('ai-studio')).toBe(true);
    expect(isKnownPlatformCapability('ai-seat')).toBe(true);
    expect(isKnownPlatformCapability('governance')).toBe(true);
  });

  it('rejects the removed camelCase aliases and typos (no canonicalization, #3308)', () => {
    expect(isKnownPlatformCapability('aiStudio')).toBe(false);
    expect(isKnownPlatformCapability('aiSeat')).toBe(false);
    expect(isKnownPlatformCapability('automations')).toBe(false);
  });
});

// framework#3366 — the provider/edition registry + classifier behind the
// installable-provider preflight.
describe('PLATFORM_CAPABILITY_PROVIDERS', () => {
  it('is frozen and maps exactly the vocabulary tokens', () => {
    expect(Object.isFrozen(PLATFORM_CAPABILITY_PROVIDERS)).toBe(true);
    expect(new Set(Object.keys(PLATFORM_CAPABILITY_PROVIDERS))).toEqual(
      new Set(PLATFORM_CAPABILITY_TOKENS),
    );
  });

  it('every entry has a valid edition; cloud tiers may carry a null package', () => {
    for (const [token, p] of Object.entries(PLATFORM_CAPABILITY_PROVIDERS)) {
      expect(['open', 'enterprise', 'cloud'], `bad edition for '${token}'`).toContain(p.edition);
      if (p.package !== null) expect(p.package.startsWith('@')).toBe(true);
      // A packageless provider only makes sense for a cloud-runtime tier.
      if (p.package === null) expect(p.edition).toBe('cloud');
    }
  });
});

describe('classifyRequiredCapability (#3366)', () => {
  const allInstalled = () => true;
  const noneInstalled = () => false;

  it('installed provider ⇒ ok', () => {
    expect(classifyRequiredCapability('automation', allInstalled).status).toBe('ok');
    expect(classifyRequiredCapability('ai', allInstalled).status).toBe('ok');
  });

  it('absent open-edition provider ⇒ installable (add the dep)', () => {
    const c = classifyRequiredCapability('automation', noneInstalled);
    expect(c.status).toBe('installable');
    expect(c.provider?.package).toBe('@objectstack/service-automation');
  });

  it('absent cloud-only provider ⇒ unavailable (no version to install here)', () => {
    // The headline case: `ai` → @objectstack/service-ai, cloud-only.
    const c = classifyRequiredCapability('ai', noneInstalled);
    expect(c.status).toBe('unavailable');
    expect(c.provider?.edition).toBe('cloud');
  });

  it('a cloud tier with no package is unavailable even when "everything" resolves', () => {
    // `ai-seat`/`governance` have package:null — there is nothing to resolve, so
    // they can never be satisfied under the open edition.
    expect(classifyRequiredCapability('ai-seat', allInstalled).status).toBe('unavailable');
    expect(classifyRequiredCapability('governance', allInstalled).status).toBe('unavailable');
  });

  it('absent enterprise provider ⇒ installable (a licensed package, still addable)', () => {
    const c = classifyRequiredCapability('hierarchy-security', noneInstalled);
    expect(c.status).toBe('installable');
    expect(c.provider?.edition).toBe('enterprise');
  });

  it('an unknown token ⇒ unknown (typo), never a provider miss', () => {
    expect(classifyRequiredCapability('automations', noneInstalled).status).toBe('unknown');
  });

  it('resolution is injected — the classifier itself performs no I/O', () => {
    const seen: string[] = [];
    classifyRequiredCapability('automation', (pkg) => { seen.push(pkg); return true; });
    expect(seen).toEqual(['@objectstack/service-automation']);
  });
});
