// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  lintFlowPatterns,
  FLOW_TIME_RELATIVE_ANTIPATTERN,
  FLOW_DOUBLE_BRACE_INTERP,
  FLOW_BARE_DOLLAR_REF,
} from './lint-flow-patterns.js';

const flow = (condition: unknown, triggerType = 'record-after-update') => ({
  flows: [{
    name: 'renewal_alert',
    nodes: [{ id: 'start', type: 'start', config: { objectName: 'contract', triggerType, condition } }],
    edges: [],
  }],
});

describe('lintFlowPatterns — time-relative anti-pattern (#1874)', () => {
  it('flags record-change date-EQUALITY against a time function', () => {
    const fnds = lintFlowPatterns(flow('end_date == daysFromNow(60)'));
    expect(fnds).toHaveLength(1);
    expect(fnds[0].rule).toBe(FLOW_TIME_RELATIVE_ANTIPATTERN);
    expect(fnds[0].where).toContain("renewal_alert");
    expect(fnds[0].hint).toMatch(/schedule/i);
  });

  it('flags the function-on-the-left form too', () => {
    expect(lintFlowPatterns(flow('today() != record.start_date'))).toHaveLength(1);
  });

  it('flags an Expression-envelope condition', () => {
    expect(lintFlowPatterns(flow({ dialect: 'cel', source: 'record.due == daysFromNow(7)' }))).toHaveLength(1);
  });

  describe('does NOT flag (false-positive guards)', () => {
    it('a RANGE comparison (the correct building block)', () => {
      expect(lintFlowPatterns(flow('end_date <= daysFromNow(60)'))).toHaveLength(0);
      expect(lintFlowPatterns(flow('end_date >= daysFromNow(7) && end_date <= daysFromNow(30)'))).toHaveLength(0);
    });
    it('equality on a non-time field', () => {
      expect(lintFlowPatterns(flow('status == "expired"'))).toHaveLength(0);
    });
    it('a SCHEDULE trigger (only record-* triggers are linted)', () => {
      expect(lintFlowPatterns(flow('end_date == daysFromNow(60)', 'schedule'))).toHaveLength(0);
    });
    it('no condition', () => {
      expect(lintFlowPatterns(flow(undefined))).toHaveLength(0);
    });
  });
});

/** A flow with a create_record node carrying `config`. */
const nodeFlow = (config: Record<string, unknown>) => ({
  flows: [{
    name: 'mk',
    nodes: [
      { id: 'start', type: 'start', config: {} },
      { id: 'create', type: 'create_record', config },
    ],
    edges: [],
  }],
});
const rules = (s: any) => lintFlowPatterns(s).map((f) => f.rule);

describe('lintFlowPatterns — wrong interpolation syntax (#1315)', () => {
  it('flags double-brace interpolation in a node value', () => {
    expect(rules(nodeFlow({ objectName: 'm', fields: { body: '{{ai_reply}}' } })))
      .toContain(FLOW_DOUBLE_BRACE_INTERP);
  });
  it('flags a bare $ref.field written as a literal', () => {
    expect(rules(nodeFlow({ objectName: 'm', fields: { ticket: '$source.id' } })))
      .toContain(FLOW_BARE_DOLLAR_REF);
  });
  describe('does NOT flag (false-positive guards)', () => {
    it('correct single-brace interpolation', () => {
      expect(rules(nodeFlow({ objectName: 'm', fields: { body: '{ai_reply}', t: 'Hi {record.name}' } }))).toEqual([]);
    });
    it('a braced $User reference', () => {
      expect(rules(nodeFlow({ objectName: 'm', fields: { owner: '{$User.Id}' } }))).toEqual([]);
    });
    it('a currency literal', () => {
      expect(rules(nodeFlow({ objectName: 'm', fields: { price: '$5.00', label: 'Total $5' } }))).toEqual([]);
    });
    it('a CEL condition (skipped — not a template value)', () => {
      expect(rules({ flows: [{ name: 'd', nodes: [
        { id: 'start', type: 'start', config: {} },
        { id: 'dec', type: 'decision', config: { condition: 'record.amount > 100' } },
      ], edges: [] }] })).toEqual([]);
    });
  });
});
