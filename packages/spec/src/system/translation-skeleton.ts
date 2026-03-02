// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ServiceObject } from '../data/object.zod';

/**
 * Translation Skeleton Generator
 *
 * Generates an AI-friendly JSON "fill-in-the-blank" template from an object
 * definition. The output contains `__TRANSLATE__` placeholders for every
 * translatable string, ensuring AI/human translators cannot accidentally
 * add or omit fields.
 *
 * @example
 * ```typescript
 * import { generateTranslationSkeleton } from '@objectstack/spec/system';
 * import { Task } from './objects/task.object';
 *
 * const skeleton = generateTranslationSkeleton(Task);
 * // → JSON string with __TRANSLATE__ placeholders for all 18 fields
 * ```
 */

/** Placeholder prefix used in skeleton output */
export const TRANSLATE_PLACEHOLDER = '__TRANSLATE__';

/**
 * Generates a translation skeleton JSON string from an object definition.
 *
 * The skeleton includes:
 * - Object-level `label` and `pluralLabel`
 * - Every field with a `label` placeholder
 * - `help` placeholder for fields that have a `description`
 * - `options` map for select/multiselect fields with all option values
 *
 * @param objectDef - A parsed ServiceObject definition
 * @returns A formatted JSON string with `__TRANSLATE__` placeholders
 */
export function generateTranslationSkeleton(objectDef: ServiceObject): string {
  const skeleton: Record<string, unknown> = {
    label: `${TRANSLATE_PLACEHOLDER}: "${objectDef.label}"`,
  };

  if (objectDef.pluralLabel) {
    skeleton.pluralLabel = `${TRANSLATE_PLACEHOLDER}: "${objectDef.pluralLabel}"`;
  }

  const fieldsObj: Record<string, Record<string, unknown>> = {};

  for (const [fieldName, fieldDef] of Object.entries(objectDef.fields)) {
    const fieldEntry: Record<string, unknown> = {
      label: `${TRANSLATE_PLACEHOLDER}: "${fieldDef.label ?? fieldName}"`,
    };

    // Add help placeholder for fields with a description
    if (fieldDef.description) {
      fieldEntry.help = `${TRANSLATE_PLACEHOLDER}: "${fieldDef.description}"`;
    }

    // Add options map for select/multiselect fields
    if (fieldDef.options && fieldDef.options.length > 0) {
      const optionsMap: Record<string, string> = {};
      for (const opt of fieldDef.options) {
        optionsMap[opt.value] = `${TRANSLATE_PLACEHOLDER}: "${opt.label}"`;
      }
      fieldEntry.options = optionsMap;
    }

    fieldsObj[fieldName] = fieldEntry;
  }

  skeleton.fields = fieldsObj;

  return JSON.stringify(skeleton, null, 2);
}
