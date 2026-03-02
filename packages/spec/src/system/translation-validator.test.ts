import { describe, it, expect } from 'vitest';
import { validateTranslationCompleteness } from './translation-validator';
import type { ServiceObject } from '../data/object.zod';

// ────────────────────────────────────────────────────────────────────────────
// Test fixture — minimal ServiceObject
// ────────────────────────────────────────────────────────────────────────────

const mockObject = {
  name: 'widget',
  label: 'Widget',
  fields: {
    title: { type: 'text', label: 'Title' },
    status: {
      type: 'select',
      label: 'Status',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
    },
    priority: {
      type: 'select',
      label: 'Priority',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'High', value: 'high' },
      ],
    },
  },
} as unknown as ServiceObject;

// ────────────────────────────────────────────────────────────────────────────

const completeTranslation = {
  label: 'Widget',
  fields: {
    title: { label: 'Title' },
    status: { label: 'Status', options: { active: 'Active', inactive: 'Inactive' } },
    priority: { label: 'Priority', options: { low: 'Low', high: 'High' } },
  },
};

describe('validateTranslationCompleteness', () => {

  it('should pass for a complete translation', () => {
    const result = validateTranslationCompleteness(mockObject, completeTranslation);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // ── Missing fields ─────────────────────────────────────────────────

  it('should report missing field', () => {
    const incomplete = {
      label: 'Widget',
      fields: {
        // 'title' is missing
        status: { label: 'Status', options: { active: 'Active', inactive: 'Inactive' } },
        priority: { label: 'Priority', options: { low: 'Low', high: 'High' } },
      },
    };
    const result = validateTranslationCompleteness(mockObject, incomplete);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual('missing field: title');
  });

  // ── Extra fields ───────────────────────────────────────────────────

  it('should report extra field', () => {
    const withExtra = {
      label: 'Widget',
      fields: {
        title: { label: 'Title' },
        status: { label: 'Status', options: { active: 'Active', inactive: 'Inactive' } },
        priority: { label: 'Priority', options: { low: 'Low', high: 'High' } },
        ghost: { label: 'Ghost' },
      },
    };
    const result = validateTranslationCompleteness(mockObject, withExtra);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual('extra field: ghost');
  });

  // ── Missing options ────────────────────────────────────────────────

  it('should report missing option', () => {
    const missingOption = {
      label: 'Widget',
      fields: {
        title: { label: 'Title' },
        status: { label: 'Status', options: { active: 'Active' } }, // missing 'inactive'
        priority: { label: 'Priority', options: { low: 'Low', high: 'High' } },
      },
    };
    const result = validateTranslationCompleteness(mockObject, missingOption);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual('missing option: fields.status.options.inactive');
  });

  // ── Extra options ──────────────────────────────────────────────────

  it('should report extra option', () => {
    const extraOption = {
      label: 'Widget',
      fields: {
        title: { label: 'Title' },
        status: {
          label: 'Status',
          options: { active: 'Active', inactive: 'Inactive', unknown: 'Unknown' },
        },
        priority: { label: 'Priority', options: { low: 'Low', high: 'High' } },
      },
    };
    const result = validateTranslationCompleteness(mockObject, extraOption);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual('extra option: fields.status.options.unknown');
  });

  // ── Placeholder residue ────────────────────────────────────────────

  it('should report __TRANSLATE__ placeholder residue', () => {
    const withPlaceholder = {
      label: '__TRANSLATE__: "Widget"',
      fields: {
        title: { label: 'Title' },
        status: { label: 'Status', options: { active: 'Active', inactive: 'Inactive' } },
        priority: { label: 'Priority', options: { low: 'Low', high: 'High' } },
      },
    };
    const result = validateTranslationCompleteness(mockObject, withPlaceholder);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('placeholder residue'))).toBe(true);
  });

  it('should report placeholder residue in nested option values', () => {
    const withOptionPlaceholder = {
      label: 'Widget',
      fields: {
        title: { label: 'Title' },
        status: {
          label: 'Status',
          options: { active: '__TRANSLATE__: "Active"', inactive: 'Inactive' },
        },
        priority: { label: 'Priority', options: { low: 'Low', high: 'High' } },
      },
    };
    const result = validateTranslationCompleteness(mockObject, withOptionPlaceholder);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('placeholder residue'))).toBe(true);
  });

  // ── Zod structure validation ───────────────────────────────────────

  it('should fail for completely invalid input', () => {
    const result = validateTranslationCompleteness(mockObject, 'not an object');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.startsWith('schema:'))).toBe(true);
  });

  it('should fail when label is missing', () => {
    const result = validateTranslationCompleteness(mockObject, {
      fields: { title: { label: 'Title' } },
    });
    expect(result.valid).toBe(false);
  });

  // ── Multiple errors ────────────────────────────────────────────────

  it('should accumulate multiple errors', () => {
    const multipleIssues = {
      label: 'Widget',
      fields: {
        // missing: title
        status: { label: 'Status', options: { active: 'Active' } }, // missing: inactive
        priority: { label: 'Priority', options: { low: 'Low', high: 'High' } },
        extra_field: { label: 'Extra' }, // extra
      },
    };
    const result = validateTranslationCompleteness(mockObject, multipleIssues);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
    expect(result.errors).toContainEqual('missing field: title');
    expect(result.errors).toContainEqual('extra field: extra_field');
    expect(result.errors).toContainEqual('missing option: fields.status.options.inactive');
  });
});
