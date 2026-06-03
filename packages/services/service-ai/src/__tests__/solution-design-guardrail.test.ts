// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { SOLUTION_DESIGN_SKILL } from '../skills/solution-design-skill.js';

/**
 * Regression guard for the "don't model a process as data" rule. The default
 * behaviour was that asking the agent to "design expense reimbursement" made it
 * invent an `approval_record` TABLE instead of a flow. The fix lives in the
 * skill instructions (and the propose_blueprint generation prompt): status is a
 * select field, an approval process is a FLOW, and the agent proactively drafts
 * that flow instead of waiting to be asked. These assertions keep that guidance
 * from silently regressing.
 */
describe('solution_design — process/state guardrail', () => {
  const text = SOLUTION_DESIGN_SKILL.instructions.toLowerCase();

  it('tells the agent NOT to model a process/approval as a table', () => {
    expect(text).toContain('do not model a process as data');
    expect(text).toMatch(/never create objects for approvals/);
    expect(text).toMatch(/is a flow, not a table/);
  });

  it('tells the agent to model status as a select field', () => {
    expect(text).toMatch(/status\b.*\bselect\b|\bselect\b.*\bstatus/);
  });

  it('tells the agent to proactively draft the approval flow (not wait to be asked)', () => {
    expect(text).toContain('get_metadata_schema');
    expect(text).toMatch(/create_metadata\(type:'flow'/);
    expect(text).toMatch(/do not wait for the user to ask/);
  });

  it('still drives the plan-first propose -> apply flow', () => {
    expect(SOLUTION_DESIGN_SKILL.tools).toEqual(['propose_blueprint', 'apply_blueprint']);
  });
});
