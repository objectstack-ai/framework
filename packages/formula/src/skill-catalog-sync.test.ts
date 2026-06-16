import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { CEL_STDLIB_FUNCTIONS } from './validate';

/**
 * Drift-guard (#1928 follow-up): the objectstack-formula authoring skill is what
 * the AI author reads to know which CEL functions exist. It MUST stay in sync
 * with the runtime catalog — a function advertised in the catalog but missing
 * from the skill means the AI never reaches for it; one in the skill but not the
 * catalog means the AI calls a function that faults the build. This pins the
 * skill ↔ `CEL_STDLIB_FUNCTIONS` mapping so neither drifts silently again
 * (mirrors the runtime drift-guard in cel-engine.test.ts).
 */
describe('objectstack-formula skill ↔ CEL_STDLIB_FUNCTIONS', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const skillPath = resolve(here, '../../../skills/objectstack-formula/SKILL.md');
  const skill = readFileSync(skillPath, 'utf8');

  it('documents every advertised stdlib function', () => {
    // A function is "documented" if its name appears as `` `name(` `` (a call
    // form) anywhere in the skill — robust to table layout / grouping changes.
    const missing = CEL_STDLIB_FUNCTIONS.filter((fn) => !skill.includes(`\`${fn}(`));
    expect(
      missing,
      `These CEL_STDLIB_FUNCTIONS are not documented in skills/objectstack-formula/SKILL.md:\n` +
        `${missing.join(', ')}\nAdd them to the stdlib table so AI authors know they exist.`,
    ).toEqual([]);
  });
});
