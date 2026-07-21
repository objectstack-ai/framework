import { describe, expect, it } from 'vitest';
import { PLATFORM_CAPABILITY_TOKENS, PLATFORM_CAPABILITY_PROVIDERS } from '@objectstack/spec/kernel';
import Serve from '../src/commands/serve.js';

// framework#3265 — drift guard: the serve path's provider registries must stay
// inside the spec-owned platform capability vocabulary, so the standalone
// runtime and cloud's objectos-runtime keep resolving the SAME token set.

describe('serve capability registries vs spec vocabulary (#3265)', () => {
  it('every CAPABILITY_PROVIDERS token is in PLATFORM_CAPABILITY_TOKENS', () => {
    for (const token of Object.keys(Serve.CAPABILITY_PROVIDERS)) {
      expect(PLATFORM_CAPABILITY_TOKENS, `provider token '${token}' missing from spec vocabulary`).toContain(token);
    }
  });

  it('every CAPABILITY_TO_TIER token is in PLATFORM_CAPABILITY_TOKENS', () => {
    for (const token of Object.keys(Serve.CAPABILITY_TO_TIER)) {
      expect(PLATFORM_CAPABILITY_TOKENS, `tier token '${token}' missing from spec vocabulary`).toContain(token);
    }
  });

  it('registries use only canonical spellings — never the removed camelCase aliases (#3308)', () => {
    const legacy = ['aiStudio', 'aiSeat'];
    for (const token of [...Object.keys(Serve.CAPABILITY_PROVIDERS), ...Object.keys(Serve.CAPABILITY_TO_TIER)]) {
      expect(legacy).not.toContain(token);
    }
  });

  it('tier-gated and provider-backed tokens do not overlap (each token has ONE resolution path)', () => {
    const providerTokens = new Set(Object.keys(Serve.CAPABILITY_PROVIDERS));
    for (const tierToken of Object.keys(Serve.CAPABILITY_TO_TIER)) {
      expect(providerTokens.has(tierToken)).toBe(false);
    }
  });

  it('ALWAYS_ON_CAPABILITIES stays inside the vocabulary too', () => {
    for (const token of Serve.ALWAYS_ON_CAPABILITIES) {
      expect(PLATFORM_CAPABILITY_TOKENS).toContain(token);
    }
  });
});

// framework#3366 — the installable-provider registry must classify EVERY
// vocabulary token, and its `open`-edition entries must name the SAME package
// the serve resolver actually loads. Otherwise the preflight and boot could
// disagree about what provides a capability (or what edition it ships in).
describe('PLATFORM_CAPABILITY_PROVIDERS vs vocabulary + serve resolver (#3366)', () => {
  it('classifies every vocabulary token, and adds none outside it (1:1)', () => {
    const providerTokens = Object.keys(PLATFORM_CAPABILITY_PROVIDERS);
    for (const token of PLATFORM_CAPABILITY_TOKENS) {
      expect(providerTokens, `vocabulary token '${token}' has no provider entry`).toContain(token);
    }
    for (const token of providerTokens) {
      expect(PLATFORM_CAPABILITY_TOKENS, `provider token '${token}' missing from vocabulary`).toContain(token);
    }
  });

  it('open-edition service tokens name the SAME package as serve CAPABILITY_PROVIDERS', () => {
    for (const [token, spec] of Object.entries(Serve.CAPABILITY_PROVIDERS)) {
      const provider = PLATFORM_CAPABILITY_PROVIDERS[token];
      expect(provider, `serve provider '${token}' has no registry entry`).toBeTruthy();
      expect(provider.package, `package mismatch for '${token}'`).toBe(spec.pkg);
      expect(provider.edition, `serve-provided '${token}' must be an open-edition provider`).toBe('open');
    }
  });

  it('tier-gated tokens carry a provider entry; ai/ai-studio are cloud-only', () => {
    for (const token of Object.keys(Serve.CAPABILITY_TO_TIER)) {
      expect(PLATFORM_CAPABILITY_PROVIDERS[token], `tier token '${token}' has no provider entry`).toBeTruthy();
    }
    // The bug the issue targets: AI runtime went cloud-only, so under the open
    // edition there is no version to install.
    expect(PLATFORM_CAPABILITY_PROVIDERS.ai.edition).toBe('cloud');
    expect(PLATFORM_CAPABILITY_PROVIDERS['ai-studio'].edition).toBe('cloud');
  });
});
