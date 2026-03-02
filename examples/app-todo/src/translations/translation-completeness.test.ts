// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { Task } from '../objects/task.object';
import { en } from './en';
import { zhCN } from './zh-CN';
import type { TranslationData } from '@objectstack/spec/system';

/**
 * Translation Completeness Test
 *
 * Validates that every field and every select option in the Task object
 * definition has a corresponding translation in each locale.
 */

const fieldNames = Object.keys(Task.fields);

const selectFields = Object.entries(Task.fields)
  .filter(([, f]) => Array.isArray(f.options) && f.options.length > 0)
  .map(([name, f]) => ({
    name,
    values: f.options!.map((o: { value: string }) => o.value),
  }));

describe.each([
  ['en', en],
  ['zh-CN', zhCN],
] as [string, TranslationData][])('%s translation completeness', (locale, t) => {

  it('should have task object translation', () => {
    expect(t.objects?.task).toBeDefined();
    expect(t.objects?.task?.label).toBeTruthy();
  });

  it.each(fieldNames)('field: %s', (name) => {
    expect(
      t.objects?.task?.fields?.[name]?.label,
      `[${locale}] Missing label for field "${name}"`,
    ).toBeTruthy();
  });

  it.each(selectFields)('options: $name', ({ name, values }) => {
    for (const v of values) {
      expect(
        t.objects?.task?.fields?.[name]?.options?.[v],
        `[${locale}] Missing option "${v}" for field "${name}"`,
      ).toBeTruthy();
    }
  });
});
