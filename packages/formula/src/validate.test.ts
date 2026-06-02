import { describe, it, expect } from 'vitest';
import { validateExpression, introspectScope, expectedDialect } from './validate';

describe('validateExpression (ADR-0032)', () => {
  describe('predicates (CEL)', () => {
    it('accepts a valid bare-CEL predicate', () => {
      const r = validateExpression('predicate', 'record.rating >= 4');
      expect(r.ok).toBe(true);
      expect(r.errors).toHaveLength(0);
    });

    it('rejects the #1491 brace-in-CEL form with a corrective message', () => {
      const r = validateExpression('predicate', '{record.rating} >= 4');
      expect(r.ok).toBe(false);
      expect(r.errors[0].message).toMatch(/map literal|bare reference|template brace/i);
      expect(r.errors[0].message).toContain('record.rating');
      expect(r.errors[0].source).toBe('{record.rating} >= 4');
    });

    it('rejects a CEL envelope placed in a template-only role', () => {
      const r = validateExpression('template', { dialect: 'cel', source: 'record.x' });
      expect(r.ok).toBe(false);
    });

    it('accepts an empty/absent expression (no-op)', () => {
      expect(validateExpression('predicate', '').ok).toBe(true);
      expect(validateExpression('predicate', null).ok).toBe(true);
    });
  });

  describe('templates', () => {
    it('accepts a valid {{ path }} template', () => {
      const r = validateExpression('template', 'Hot lead: {{ record.full_name }}');
      expect(r.ok).toBe(true);
    });

    it('flags single-brace {x} in a template and suggests {{ }}', () => {
      const r = validateExpression('template', 'Hi {record.name}');
      expect(r.ok).toBe(false);
      expect(r.errors[0].message).toMatch(/\{\{ record\.name \}\}|double braces/);
    });
  });

  describe('schema-aware field existence (v1)', () => {
    it('flags an unknown record field with a did-you-mean', () => {
      const r = validateExpression('predicate', 'record.raitng >= 4', { objectName: 'crm_lead', fields: ['rating', 'status'] });
      expect(r.ok).toBe(false);
      expect(r.errors[0].message).toMatch(/unknown field `raitng`/);
      expect(r.errors[0].message).toMatch(/did you mean `rating`/);
    });

    it('passes when fields exist', () => {
      const r = validateExpression('predicate', 'record.rating >= 4 && record.status == "new"', { fields: ['rating', 'status'] });
      expect(r.ok).toBe(true);
    });

    it('skips field checks when no schema is provided', () => {
      expect(validateExpression('predicate', 'record.anything > 1').ok).toBe(true);
    });
  });

  describe('introspection', () => {
    it('reports the dialect + scope for a field role', () => {
      expect(expectedDialect('predicate')).toBe('cel');
      expect(expectedDialect('template')).toBe('template');
      const scope = introspectScope('predicate', { fields: ['rating'] });
      expect(scope.dialect).toBe('cel');
      expect(scope.fields).toContain('rating');
      expect(scope.roots).toContain('record');
      expect(scope.functions).toContain('daysFromNow');
    });
  });
});
