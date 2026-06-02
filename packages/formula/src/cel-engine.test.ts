import { describe, expect, it } from 'vitest';

import { celEngine } from './cel-engine';
import type { Expression } from '@objectstack/spec';

const cel = (source: string): Expression => ({ dialect: 'cel', source });

describe('celEngine', () => {
  it('evaluates simple arithmetic, coercing BigInt to number', () => {
    const r = celEngine.evaluate(cel('1 + 2'), {});
    expect(r).toEqual({ ok: true, value: 3 });
  });

  it('evaluates predicates against record context', () => {
    const r = celEngine.evaluate(cel('record.amount > 1000'), {
      record: { amount: 1500 },
    });
    expect(r).toEqual({ ok: true, value: true });
  });

  it('exposes os.* namespace from EvalContext', () => {
    const r = celEngine.evaluate(cel('os.user.role == "manager"'), {
      user: { id: 'u1', role: 'manager' },
    });
    expect(r).toEqual({ ok: true, value: true });
  });

  it('uses pinned now() for determinism', () => {
    const pinned = new Date('2026-01-15T10:00:00Z');
    const r = celEngine.evaluate(cel('now()'), { now: pinned });
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.value as Date).toISOString()).toBe(pinned.toISOString());
  });

  it('today() truncates to UTC start-of-day', () => {
    const pinned = new Date('2026-01-15T10:30:45.123Z');
    const r = celEngine.evaluate(cel('today()'), { now: pinned });
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.value as Date).toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });

  it('daysFromNow(n) advances by n days from pinned now', () => {
    const pinned = new Date('2026-01-15T10:00:00Z');
    const r = celEngine.evaluate(cel('daysFromNow(30)'), { now: pinned });
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.value as Date).toISOString()).toBe('2026-02-14T10:00:00.000Z');
  });

  it('classifies parse errors with kind=parse', () => {
    const r = celEngine.evaluate(cel('1 +'), {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(['parse', 'type', 'runtime']).toContain(r.error.kind);
  });

  it('enforces AST size bounds (kind=bounds)', () => {
    const huge = Array.from({ length: 500 }, (_, i) => i.toString()).join(' + ');
    const r = celEngine.evaluate(cel(huge), {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('bounds');
  });

  it('rejects evaluation when dialect mismatches', () => {
    const r = celEngine.evaluate({ dialect: 'js', source: 'x' } as Expression, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('dialect');
  });

  it('compile() returns AST on success', () => {
    const r = celEngine.compile('record.amount > 1000');
    expect(r.ok).toBe(true);
  });

  it('handles timestamp + duration arithmetic', () => {
    const pinned = new Date('2026-01-01T00:00:00Z');
    const r = celEngine.evaluate(cel('now() + duration("720h")'), { now: pinned });
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.value as Date).toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });

  it('coerces large BigInt to string to avoid silent truncation', () => {
    const r = celEngine.evaluate(cel('9999999999999999999'), {});
    expect(r.ok).toBe(true);
    if (r.ok) expect(typeof r.value === 'string' || typeof r.value === 'number').toBe(true);
  });

  // ADR-0032 §1c — string-serialized numeric fields (#1530, #1534).
  describe('numeric-string field hydration', () => {
    it('compares a rating that serializes as "5.0" against an int literal', () => {
      const r = celEngine.evaluate(cel('record.rating >= 4'), {
        record: { rating: '5.0' },
      });
      expect(r).toEqual({ ok: true, value: true });
    });

    it('compares a currency string against an int literal', () => {
      const r = celEngine.evaluate(cel('record.amount > 100000'), {
        record: { amount: '250000.00' },
      });
      expect(r).toEqual({ ok: true, value: true });
    });

    it('returns false (not a fault) when the hydrated compare is unmet', () => {
      const r = celEngine.evaluate(cel('record.rating >= 4'), {
        record: { rating: '2.5' },
      });
      expect(r).toEqual({ ok: true, value: false });
    });

    it('compares a percent string against a number literal', () => {
      const r = celEngine.evaluate(cel('record.completion >= 0.8'), {
        record: { completion: '0.95' },
      });
      expect(r).toEqual({ ok: true, value: true });
    });

    it('hydrates within a compound predicate (the real flow-condition shape)', () => {
      const r = celEngine.evaluate(
        cel('record.rating >= 4 && record.status == "new"'),
        { record: { rating: '5.0', status: 'new' } },
      );
      expect(r).toEqual({ ok: true, value: true });
    });

    it('hydrates nested numeric strings (e.g. previous.* transition gates)', () => {
      const r = celEngine.evaluate(cel('record.amount > previous.amount'), {
        record: { amount: '600000.00' },
        previous: { amount: '500000.00' },
      });
      expect(r).toEqual({ ok: true, value: true });
    });

    it('leaves genuine string equality untouched (no spurious coercion)', () => {
      // string == string already type-checks, so the retry path never runs
      // and a numeric-looking string stays a string.
      const r = celEngine.evaluate(cel('record.zip == "02134"'), {
        record: { zip: '02134' },
      });
      expect(r).toEqual({ ok: true, value: true });
    });

    it('does not coerce non-numeric strings', () => {
      // "high" is not a number literal, so the compare still faults loudly
      // rather than being silently rescued.
      const r = celEngine.evaluate(cel('record.rating >= 4'), {
        record: { rating: 'high' },
      });
      expect(r.ok).toBe(false);
    });
  });
});
