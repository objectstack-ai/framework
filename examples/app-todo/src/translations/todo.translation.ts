// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineTranslationBundle } from '@objectstack/spec/system';
import { en } from './en';
import { zhCN } from './zh-CN';
import { jaJP } from './ja-JP';

/**
 * Todo App — Internationalization (i18n)
 *
 * Demonstrates **per-locale file splitting** convention:
 * each language is defined in its own file (`en.ts`, `zh-CN.ts`, `ja-JP.ts`)
 * and assembled into a single `TranslationBundle` here.
 *
 * For large projects with many objects, use `per_namespace` organization
 * to further split each locale into per-object files (see i18n-standard docs).
 *
 * Supported locales: en (English), zh-CN (Chinese), ja-JP (Japanese)
 */
export const TodoTranslations = defineTranslationBundle({
  en,
  'zh-CN': zhCN,
  'ja-JP': jaJP,
});
