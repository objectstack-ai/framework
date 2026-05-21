// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { TranslationBundle } from '@objectstack/spec/system';
import { en } from './en.js';
import { zhCN } from './zh-CN.js';
import { jaJP } from './ja-JP.js';
import { esES } from './es-ES.js';

/**
 * Setup App — Internationalization (i18n)
 *
 * Mirrors the CRM example's `per_locale` convention: each language lives
 * in its own file (`en.ts`, `zh-CN.ts`, `ja-JP.ts`, `es-ES.ts`) and is
 * assembled into a single `TranslationBundle` here.
 *
 * Loaded into the kernel's i18n service by `plugin-auth` during
 * `kernel:ready` (auth is the natural registration point for the Setup
 * App — see `auth-plugin.ts`).
 *
 * Supported locales: en, zh-CN, ja-JP, es-ES.
 */
export const SetupAppTranslations: TranslationBundle = {
  en,
  'zh-CN': zhCN,
  'ja-JP': jaJP,
  'es-ES': esES,
};
