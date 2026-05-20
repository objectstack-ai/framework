import { describe, expect, it } from 'vitest';
import Serve from '../src/commands/serve.js';

describe('serve: ALWAYS_ON_CAPABILITIES default slate', () => {
  it('exposes the six foundational capabilities in stable order', () => {
    expect(Serve.ALWAYS_ON_CAPABILITIES).toEqual([
      'queue', 'job', 'cache', 'settings', 'email', 'storage',
    ]);
  });

  it('is frozen so accidental mutation throws', () => {
    expect(Object.isFrozen(Serve.ALWAYS_ON_CAPABILITIES)).toBe(true);
  });

  it('minimal preset has none of the always-on caps in its tier list', () => {
    const minimal = Serve.TIER_PRESETS.minimal;
    for (const cap of Serve.ALWAYS_ON_CAPABILITIES) {
      expect(minimal).not.toContain(cap);
    }
    expect(minimal).toEqual(['core']);
  });

  it('default preset does not pre-include the always-on caps (they merge into `requires`, not tier)', () => {
    // ALWAYS_CAPS get injected into per-app `requires` at runtime; the
    // tier preset is the orthogonal "feature tier" axis.
    const def = Serve.TIER_PRESETS.default;
    for (const cap of Serve.ALWAYS_ON_CAPABILITIES) {
      expect(def).not.toContain(cap);
    }
  });
});
