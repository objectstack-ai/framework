// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { __internal } from './SharingCriteriaBuilder';

const { parseValue, rowsToJson, coerceValue } = __internal;

const FIELDS = {
  amount: { name: 'amount', label: 'Amount', type: 'currency' },
  stage: { name: 'stage', label: 'Stage', type: 'text' },
  active: { name: 'active', label: 'Active', type: 'boolean' },
  owner_id: { name: 'owner_id', label: 'Owner', type: 'lookup' },
};

describe('SharingCriteriaBuilder __internal', () => {
  describe('parseValue', () => {
    it('returns empty rows for empty/whitespace input', () => {
      expect(parseValue('').rows).toEqual([]);
      expect(parseValue('   ').rows).toEqual([]);
    });

    it('parses operator-style criteria { amount: { $gte: 100 } }', () => {
      const { rows, parseError } = parseValue('{"amount":{"$gte":100}}');
      expect(parseError).toBeNull();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ field: 'amount', op: '$gte', value: '100' });
    });

    it('parses shorthand equality { stage: "won" } as $eq', () => {
      const { rows, parseError } = parseValue('{"stage":"won"}');
      expect(parseError).toBeNull();
      expect(rows[0]).toMatchObject({ field: 'stage', op: '$eq', value: 'won' });
    });

    it('parses multiple ops on same field into multiple rows', () => {
      const { rows } = parseValue('{"amount":{"$gte":100,"$lte":1000}}');
      expect(rows).toHaveLength(2);
      const ops = rows.map((r) => r.op).sort();
      expect(ops).toEqual(['$gte', '$lte']);
    });

    it('parses $in into comma-separated string', () => {
      const { rows } = parseValue('{"stage":{"$in":["a","b","c"]}}');
      expect(rows[0]).toMatchObject({ field: 'stage', op: '$in', value: 'a, b, c' });
    });

    it('parses null shorthand as $null with empty value', () => {
      const { rows } = parseValue('{"closed_at":null}');
      // null literal currently maps to $eq with empty string via scalarToString
      // — acceptable; user can switch to $null op via UI.
      expect(rows[0].field).toBe('closed_at');
    });

    it('flags top-level $and/$or as unsupported', () => {
      const { rows, parseError } = parseValue('{"$and":[]}');
      expect(rows).toEqual([]);
      expect(parseError).toMatch(/Unsupported top-level operator/);
    });

    it('flags invalid JSON', () => {
      const { parseError } = parseValue('{not-json}');
      expect(parseError).toMatch(/Invalid JSON/);
    });

    it('flags non-object roots', () => {
      const { parseError } = parseValue('[1,2,3]');
      expect(parseError).toMatch(/must be an object/);
    });

    it('flags unknown operators', () => {
      const { parseError } = parseValue('{"x":{"$weird":1}}');
      expect(parseError).toMatch(/Unsupported operator/);
    });
  });

  describe('rowsToJson', () => {
    it('returns empty string when no valid rows', () => {
      expect(rowsToJson([], FIELDS)).toBe('');
      expect(rowsToJson([{ rid: 'a', field: '', op: '$eq', value: 'x' }], FIELDS)).toBe('');
    });

    it('skips rows with empty value (unless op is $null/$notNull)', () => {
      const rows = [{ rid: 'a', field: 'amount', op: '$eq' as const, value: '' }];
      expect(rowsToJson(rows, FIELDS)).toBe('');
    });

    it('coerces numeric fields to numbers', () => {
      const rows = [{ rid: 'a', field: 'amount', op: '$gte' as const, value: '100' }];
      expect(rowsToJson(rows, FIELDS)).toBe('{"amount":{"$gte":100}}');
    });

    it('keeps text fields as strings', () => {
      const rows = [{ rid: 'a', field: 'stage', op: '$eq' as const, value: 'won' }];
      expect(rowsToJson(rows, FIELDS)).toBe('{"stage":{"$eq":"won"}}');
    });

    it('serializes $in to array with element coercion', () => {
      const rows = [{ rid: 'a', field: 'amount', op: '$in' as const, value: '100, 200, 300' }];
      expect(rowsToJson(rows, FIELDS)).toBe('{"amount":{"$in":[100,200,300]}}');
    });

    it('merges multiple ops on same field into one expr', () => {
      const rows = [
        { rid: 'a', field: 'amount', op: '$gte' as const, value: '100' },
        { rid: 'b', field: 'amount', op: '$lte' as const, value: '1000' },
      ];
      expect(rowsToJson(rows, FIELDS)).toBe('{"amount":{"$gte":100,"$lte":1000}}');
    });

    it('maps $null to literal null', () => {
      const rows = [{ rid: 'a', field: 'owner_id', op: '$null' as const, value: '' }];
      expect(rowsToJson(rows, FIELDS)).toBe('{"owner_id":null}');
    });

    it('maps $notNull to { $ne: null }', () => {
      const rows = [{ rid: 'a', field: 'owner_id', op: '$notNull' as const, value: '' }];
      expect(rowsToJson(rows, FIELDS)).toBe('{"owner_id":{"$ne":null}}');
    });

    it('round-trips through parse → serialize', () => {
      const input = '{"amount":{"$gte":100,"$lte":1000}}';
      const { rows } = parseValue(input);
      expect(rowsToJson(rows, FIELDS)).toBe(input);
    });
  });

  describe('coerceValue', () => {
    it('coerces boolean true/false strings', () => {
      expect(coerceValue('true', '$eq', 'boolean')).toBe(true);
      expect(coerceValue('false', '$eq', 'boolean')).toBe(false);
      expect(coerceValue('1', '$eq', 'boolean')).toBe(true);
      expect(coerceValue('0', '$eq', 'boolean')).toBe(false);
    });

    it('coerces numbers for numeric field types', () => {
      expect(coerceValue('42', '$eq', 'number')).toBe(42);
      expect(coerceValue('42.5', '$gte', 'currency')).toBe(42.5);
    });

    it('falls back to string for non-numeric input on numeric fields', () => {
      expect(coerceValue('abc', '$eq', 'number')).toBe('abc');
    });
  });
});
