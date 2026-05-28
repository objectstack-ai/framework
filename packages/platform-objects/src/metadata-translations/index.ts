// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { TranslationBundle } from '@objectstack/spec/system';
import { enMetadataForms } from '../apps/translations/en.metadata-forms.generated.js';
import { zhCNMetadataForms } from '../apps/translations/zh-CN.metadata-forms.generated.js';
import { jaJPMetadataForms } from '../apps/translations/ja-JP.metadata-forms.generated.js';
import { esESMetadataForms } from '../apps/translations/es-ES.metadata-forms.generated.js';

/**
 * `MetadataFormsTranslations`
 *
 * Platform-default i18n bundle for the metadata-type configuration forms
 * (object / field / agent / flow / view / …) shipped from `@objectstack/spec`.
 *
 * Single source of truth: the `*.metadata-forms.generated.ts` files in
 * `apps/translations/`. Edit the generated files directly — they are
 * hand-editable. Re-running
 *
 *   pnpm --filter @objectstack/platform-objects i18n:extract
 *
 * preserves existing translations (via `--merge`) and only fills newly
 * added schema keys per `--fill=default`.
 */
export const MetadataFormsTranslations: TranslationBundle = {
  en: { metadataForms: enMetadataForms },
  'zh-CN': { metadataForms: zhCNMetadataForms },
  'ja-JP': { metadataForms: jaJPMetadataForms },
  'es-ES': { metadataForms: esESMetadataForms },
};
