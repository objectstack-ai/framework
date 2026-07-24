// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * #3450 — a flow string template that embeds an OBJECT-valued token (most
 * notably the engine's `$error` = `{nodeId, message, ...}`) must never render
 * as the useless `[object Object]`. Embedded object/array tokens are JSON-
 * serialized so the text stays legible and still carries the message.
 */
import { describe, it, expect } from 'vitest';
import { interpolateString, stringifyForTemplate } from './template.js';

const ctx = {} as any;
const errObj = { nodeId: 'create_contact', message: 'crm_contact is required' };
const vars = new Map<string, unknown>([
  ['$error', errObj],
  ['count', 3],
  ['flag', true],
]);

describe('stringifyForTemplate (#3450)', () => {
  it('serializes objects and arrays as JSON, never [object Object]', () => {
    expect(stringifyForTemplate(errObj)).toBe(JSON.stringify(errObj));
    expect(stringifyForTemplate(errObj)).not.toBe('[object Object]');
    expect(stringifyForTemplate([1, 2])).toBe('[1,2]');
  });

  it('passes primitives through and renders null/undefined as empty', () => {
    expect(stringifyForTemplate('hi')).toBe('hi');
    expect(stringifyForTemplate(3)).toBe('3');
    expect(stringifyForTemplate(true)).toBe('true');
    expect(stringifyForTemplate(null)).toBe('');
    expect(stringifyForTemplate(undefined)).toBe('');
  });

  it('falls back without throwing on a circular object', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => stringifyForTemplate(circular)).not.toThrow();
  });
});

describe('interpolateString with object tokens (#3450)', () => {
  it('renders an embedded $error object as readable JSON, not [object Object]', () => {
    const out = interpolateString('Conversion failed: {$error}', vars, ctx) as string;
    expect(out).not.toContain('[object Object]');
    expect(out).toContain('crm_contact is required');
    expect(out).toBe(`Conversion failed: ${JSON.stringify(errObj)}`);
  });

  it('still resolves the dotted path to just the message string', () => {
    expect(interpolateString('Failed: {$error.message}', vars, ctx)).toBe('Failed: crm_contact is required');
  });

  it('preserves the raw object for a sole token (type preserved)', () => {
    // A single-token template returns the raw value so typed config fields keep
    // their type; only EMBEDDED substitution coerces to text.
    expect(interpolateString('{$error}', vars, ctx)).toEqual(errObj);
  });

  it('leaves primitive embedded tokens unchanged', () => {
    expect(interpolateString('n={count};f={flag}', vars, ctx)).toBe('n=3;f=true');
  });
});
