// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ServiceObject } from '../data/object.zod';
import { ObjectTranslationNodeSchema } from './translation.zod';
import { TRANSLATE_PLACEHOLDER } from './translation-skeleton';

/**
 * Translation Completeness Validator
 *
 * Validates that a translation object is complete and consistent
 * with the source object definition. Checks five dimensions:
 *
 * 1. **Zod structure** — Valid against `ObjectTranslationNodeSchema`
 * 2. **Missing fields** — Source fields not present in translation
 * 3. **Extra fields** — Translation keys not present in source
 * 4. **Option completeness** — Select field options fully covered
 * 5. **Placeholder residue** — No `__TRANSLATE__` placeholders left
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates translation completeness against an object definition.
 *
 * @param objectDef - The source ServiceObject definition
 * @param translation - The translation data to validate (unknown shape)
 * @returns Validation result with `valid` flag and error messages
 *
 * @example
 * ```typescript
 * const result = validateTranslationCompleteness(Task, zhTask);
 * if (!result.valid) {
 *   console.error(result.errors);
 * }
 * ```
 */
export function validateTranslationCompleteness(
  objectDef: ServiceObject,
  translation: unknown,
): ValidationResult {
  const errors: string[] = [];

  // ── 1. Zod structure validation ──────────────────────────────────────
  const parseResult = ObjectTranslationNodeSchema.safeParse(translation);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push(`schema: ${issue.path.join('.')}: ${issue.message}`);
    }
    return { valid: false, errors };
  }

  const data = parseResult.data;
  const sourceFieldNames = Object.keys(objectDef.fields);
  const translatedFieldNames = Object.keys(data.fields ?? {});

  // ── 2. Missing fields ────────────────────────────────────────────────
  for (const name of sourceFieldNames) {
    if (!translatedFieldNames.includes(name)) {
      errors.push(`missing field: ${name}`);
    }
  }

  // ── 3. Extra fields ─────────────────────────────────────────────────
  for (const name of translatedFieldNames) {
    if (!sourceFieldNames.includes(name)) {
      errors.push(`extra field: ${name}`);
    }
  }

  // ── 4. Option completeness ───────────────────────────────────────────
  for (const [fieldName, fieldDef] of Object.entries(objectDef.fields)) {
    if (!fieldDef.options || fieldDef.options.length === 0) continue;

    const fieldTranslation = data.fields?.[fieldName];
    if (!fieldTranslation) continue; // already reported as missing

    const translatedOptions = fieldTranslation.options ?? {};
    const sourceValues = fieldDef.options.map(o => o.value);
    const translatedValues = Object.keys(translatedOptions);

    for (const value of sourceValues) {
      if (!translatedValues.includes(value)) {
        errors.push(`missing option: fields.${fieldName}.options.${value}`);
      }
    }

    for (const value of translatedValues) {
      if (!sourceValues.includes(value)) {
        errors.push(`extra option: fields.${fieldName}.options.${value}`);
      }
    }
  }

  // ── 5. Placeholder residue ───────────────────────────────────────────
  checkPlaceholderResidue(data, '', errors);

  return { valid: errors.length === 0, errors };
}

/**
 * Recursively checks for `__TRANSLATE__` placeholder residue in values.
 */
function checkPlaceholderResidue(
  obj: unknown,
  path: string,
  errors: string[],
): void {
  if (typeof obj === 'string') {
    if (obj.includes(TRANSLATE_PLACEHOLDER)) {
      errors.push(`placeholder residue: ${path}`);
    }
    return;
  }
  if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      checkPlaceholderResidue(value, path ? `${path}.${key}` : key, errors);
    }
  }
}
