// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Translation Skeleton Protocol Constants
 *
 * Defines the placeholder convention used in AI-friendly translation
 * skeleton templates. Runtime implementations (skeleton generation,
 * validation) belong in implementation packages (CLI, service-i18n, etc.).
 *
 * @example
 * ```json
 * {
 *   "label": "__TRANSLATE__: \"Task\"",
 *   "fields": {
 *     "subject": { "label": "__TRANSLATE__: \"Subject\"" }
 *   }
 * }
 * ```
 */

/** Placeholder prefix used in translation skeleton output */
export const TRANSLATE_PLACEHOLDER = '__TRANSLATE__';
