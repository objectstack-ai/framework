import { describe, it, expect } from 'vitest';
import { generateTranslationSkeleton, TRANSLATE_PLACEHOLDER } from './translation-skeleton';
import type { ServiceObject } from '../data/object.zod';

// ────────────────────────────────────────────────────────────────────────────
// Test fixture — minimal ServiceObject
// ────────────────────────────────────────────────────────────────────────────

const mockObject = {
  name: 'test_obj',
  label: 'Test Object',
  pluralLabel: 'Test Objects',
  fields: {
    title: { type: 'text', label: 'Title' },
    body: { type: 'textarea', label: 'Body', description: 'Main content area' },
    status: {
      type: 'select',
      label: 'Status',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Closed', value: 'closed' },
      ],
    },
    priority: {
      type: 'select',
      label: 'Priority',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Normal', value: 'normal' },
        { label: 'High', value: 'high' },
      ],
    },
    plain: { type: 'number', label: 'Amount' },
  },
} as unknown as ServiceObject;

describe('generateTranslationSkeleton', () => {

  it('should output valid JSON', () => {
    const json = generateTranslationSkeleton(mockObject);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('should include object label and pluralLabel', () => {
    const skeleton = JSON.parse(generateTranslationSkeleton(mockObject));
    expect(skeleton.label).toContain(TRANSLATE_PLACEHOLDER);
    expect(skeleton.label).toContain('Test Object');
    expect(skeleton.pluralLabel).toContain('Test Objects');
  });

  it('should include all field keys', () => {
    const skeleton = JSON.parse(generateTranslationSkeleton(mockObject));
    const fieldKeys = Object.keys(skeleton.fields);
    expect(fieldKeys).toEqual(['title', 'body', 'status', 'priority', 'plain']);
  });

  it('should add help placeholder for fields with description', () => {
    const skeleton = JSON.parse(generateTranslationSkeleton(mockObject));
    expect(skeleton.fields.body.help).toContain(TRANSLATE_PLACEHOLDER);
    expect(skeleton.fields.body.help).toContain('Main content area');
    // Field without description should not have help
    expect(skeleton.fields.title.help).toBeUndefined();
  });

  it('should include options map for select fields', () => {
    const skeleton = JSON.parse(generateTranslationSkeleton(mockObject));
    expect(skeleton.fields.status.options).toEqual({
      open: `${TRANSLATE_PLACEHOLDER}: "Open"`,
      closed: `${TRANSLATE_PLACEHOLDER}: "Closed"`,
    });
    expect(skeleton.fields.priority.options).toEqual({
      low: `${TRANSLATE_PLACEHOLDER}: "Low"`,
      normal: `${TRANSLATE_PLACEHOLDER}: "Normal"`,
      high: `${TRANSLATE_PLACEHOLDER}: "High"`,
    });
  });

  it('should not include options for non-select fields', () => {
    const skeleton = JSON.parse(generateTranslationSkeleton(mockObject));
    expect(skeleton.fields.title.options).toBeUndefined();
    expect(skeleton.fields.plain.options).toBeUndefined();
  });

  it('should handle object without pluralLabel', () => {
    const objWithoutPlural = {
      ...mockObject,
      pluralLabel: undefined,
    } as unknown as ServiceObject;
    const skeleton = JSON.parse(generateTranslationSkeleton(objWithoutPlural));
    expect(skeleton.pluralLabel).toBeUndefined();
  });
});
