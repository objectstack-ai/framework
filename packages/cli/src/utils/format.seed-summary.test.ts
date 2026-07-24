// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { printServerReady, type ServerReadyOptions } from './format.js';

/**
 * #3415 — the boot banner is the ONE place a developer reliably sees seed
 * outcomes (SeedLoader's own logs are level-filtered and swallowed by the
 * serve boot-quiet window). Assert the Seeds line prints, screams on
 * rejections, and stays silent when nothing was seeded.
 */
describe('printServerReady seed summary (#3415)', () => {
  const base: ServerReadyOptions = {
    port: 3000,
    configFile: 'objectstack.config.ts',
    isDev: true,
    pluginCount: 1,
  };
  let lines: string[];
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    lines = [];
    spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      lines.push(args.join(' '));
    });
  });
  afterEach(() => spy.mockRestore());

  const seedLines = () => lines.filter((l) => l.includes('Seeds:'));

  it('prints a quiet one-liner for a clean seed', () => {
    printServerReady({ ...base, seeds: { inserted: 42, updated: 6, skipped: 3, rejected: 0 } });
    expect(seedLines()).toHaveLength(1);
    expect(seedLines()[0]).toContain('42 inserted');
    expect(seedLines()[0]).toContain('6 updated');
    expect(seedLines()[0]).not.toContain('REJECTED');
  });

  it('screams when records were rejected', () => {
    printServerReady({ ...base, seeds: { inserted: 24, updated: 0, skipped: 0, rejected: 14 } });
    expect(seedLines()).toHaveLength(1);
    expect(seedLines()[0]).toContain('14 REJECTED');
    expect(seedLines()[0]).toContain('OS_LOG_LEVEL=info');
  });

  it('stays silent when no summary was collected or nothing ran', () => {
    printServerReady({ ...base });
    printServerReady({ ...base, seeds: { inserted: 0, updated: 0, skipped: 0, rejected: 0 } });
    expect(seedLines()).toHaveLength(0);
  });
});
