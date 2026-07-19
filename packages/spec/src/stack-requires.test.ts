import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineStack } from './stack.zod';

// framework#3265 — defineStack canonicalizes deprecated `requires` spellings at
// the PRODUCER (authoring time) and warn-validates tokens against the platform
// capability vocabulary. Warn-first: unknown tokens must not throw (yet).

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

  it('warns on unknown tokens but does NOT throw (warn-first)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stack = defineStack({ requires: ['automations'] });
    expect(stack.requires).toEqual(['automations']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("'automations' is not a known platform capability");
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
