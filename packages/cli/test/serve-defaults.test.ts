import { describe, expect, it } from 'vitest';
import Serve from '../src/commands/serve.js';

describe('serve: ALWAYS_ON_CAPABILITIES default slate', () => {
  // ALWAYS_ON_CAPABILITIES is the fail-closed allowlist of platform services
  // that are injected into every app's `requires` at runtime. The six
  // foundational capabilities must always lead the slate in this precedence
  // order; the list may grow beyond them (e.g. `sharing`) without churning
  // this assertion, so we pin the prefix rather than the whole array.
  it('leads with the six foundational capabilities in stable order', () => {
    expect(Serve.ALWAYS_ON_CAPABILITIES.slice(0, 6)).toEqual([
      'queue', 'job', 'cache', 'settings', 'email', 'storage',
    ]);
  });

  it('contains no duplicates', () => {
    expect(Serve.ALWAYS_ON_CAPABILITIES).toHaveLength(
      new Set(Serve.ALWAYS_ON_CAPABILITIES).size,
    );
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
