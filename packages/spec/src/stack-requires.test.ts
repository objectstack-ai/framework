import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineStack } from './stack.zod';

// framework#3265 — defineStack canonicalizes deprecated `requires` spellings at
// the PRODUCER (authoring time) and validates tokens against the platform
// capability vocabulary: deprecated aliases are rewritten with a warning, an
// unknown token is a hard error (no runtime provides it → declared ≠ enforced).

afterEach(() => {
  vi.restoreAllMocks();
});

describe('defineStack requires canonicalization (#3265)', () => {
  it('rewrites deprecated aliases to canonical kebab tokens with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stack = defineStack({ requires: ['ai', 'aiStudio', 'automation'] });
    expect(stack.requires).toEqual(['ai', 'ai-studio', 'automation']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("'aiStudio' is a deprecated spelling");
    expect(warn.mock.calls[0][0]).toContain("'ai-studio'");
  });

  it('canonical declarations pass through untouched and warning-free', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stack = defineStack({ requires: ['ai', 'ai-studio', 'hierarchy-security', 'governance'] });
    expect(stack.requires).toEqual(['ai', 'ai-studio', 'hierarchy-security', 'governance']);
    expect(warn).not.toHaveBeenCalled();
  });

  it('THROWS on an unknown token (a typo no runtime provides), naming it', () => {
    expect(() => defineStack({ requires: ['automations'] })).toThrowError(
      /capability validation failed[\s\S]*'automations' is not a known platform capability/,
    );
  });

  it('reports every distinct unknown token but not known ones', () => {
    let msg = '';
    try {
      defineStack({ requires: ['ai', 'automations', 'analytiks', 'ai'] });
    } catch (e) {
      msg = e instanceof Error ? e.message : String(e);
    }
    expect(msg).toContain("'automations'");
    expect(msg).toContain("'analytiks'");
    expect(msg).toContain('(2 issues)');
    expect(msg).not.toContain("'ai' is not"); // known token isn't flagged
  });

  it('a deprecated alias is NOT treated as unknown — it canonicalizes and passes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => defineStack({ requires: ['aiStudio', 'ai-seat'] })).not.toThrow();
    // aiStudio → ai-studio (warned); ai-seat is already canonical
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('warns once per distinct token, not once per occurrence', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    defineStack({ requires: ['aiStudio', 'aiStudio'] });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('non-strict mode skips canonicalization and warnings by contract', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stack = defineStack({ requires: ['aiStudio'] }, { strict: false });
    expect(stack.requires).toEqual(['aiStudio']);
    expect(warn).not.toHaveBeenCalled();
  });
});
