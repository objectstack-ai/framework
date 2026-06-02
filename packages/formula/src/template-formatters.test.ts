import { describe, it, expect } from 'vitest';
import { templateEngine, TEMPLATE_FORMATTERS } from './template-engine';

function render(source: string, record: Record<string, unknown>): string {
  const r = templateEngine.evaluate<string>({ dialect: 'template', source }, { record, extra: { locale: 'en-US' } });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('template formatters (ADR-0032 §3)', () => {
  it('keeps plain {{ path }} back-compatible (identity stringify)', () => {
    expect(render('Hi {{ record.name }}', { name: 'Jane' })).toBe('Hi Jane');
  });

  it('currency (default USD + explicit code)', () => {
    expect(render('{{ record.amt | currency }}', { amt: 1234.5 })).toBe('$1,234.50');
    expect(render('{{ record.amt | currency:EUR }}', { amt: 1000 })).toContain('1,000');
  });

  it('number with fixed decimals', () => {
    expect(render('{{ record.n | number:2 }}', { n: 1234.5 })).toBe('1,234.50');
  });

  it('percent (ratio → %)', () => {
    expect(render('{{ record.r | percent }}', { r: 0.42 })).toBe('42%');
    expect(render('{{ record.r | percent:1 }}', { r: 0.425 })).toBe('42.5%');
  });

  it('date:iso', () => {
    expect(render('{{ record.d | date:iso }}', { d: '2026-06-02T10:00:00Z' })).toBe('2026-06-02');
  });

  it('truncate + upper + default', () => {
    expect(render('{{ record.s | truncate:5 }}', { s: 'abcdefgh' })).toBe('abcd…');
    expect(render('{{ record.s | upper }}', { s: 'hi' })).toBe('HI');
    expect(render("{{ record.missing | default:'N/A' }}", {})).toBe('N/A');
  });

  it('rejects arbitrary logic in a hole (not a path+formatter)', () => {
    const r = templateEngine.compile('{{ record.a > 5 ? "x" : "y" }}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/field path with an optional formatter|arbitrary logic/);
  });

  it('rejects an unknown formatter', () => {
    const r = templateEngine.compile('{{ record.a | bogus }}');
    expect(r.ok).toBe(false);
  });

  it('exposes the formatter catalog', () => {
    expect(TEMPLATE_FORMATTERS).toEqual(
      expect.arrayContaining(['currency', 'number', 'percent', 'date', 'datetime', 'truncate', 'upper', 'lower', 'default']),
    );
  });
});
