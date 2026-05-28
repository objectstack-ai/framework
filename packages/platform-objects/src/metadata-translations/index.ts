// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { TranslationBundle, TranslationData } from '@objectstack/spec/system';
import { enMetadataForms } from '../apps/translations/en.metadata-forms.generated.js';
import { zhCNMetadataForms } from '../apps/translations/zh-CN.metadata-forms.generated.js';
import { jaJPMetadataForms } from '../apps/translations/ja-JP.metadata-forms.generated.js';
import { esESMetadataForms } from '../apps/translations/es-ES.metadata-forms.generated.js';
import { zhCN as zhCNOverlay } from './zh-CN.js';

/**
 * `MetadataFormsTranslations`
 *
 * Platform-default i18n bundle for the metadata-type configuration forms
 * (object / field / agent / flow / view / …) shipped from `@objectstack/spec`.
 *
 * Composition (per locale):
 *   1. Auto-generated baseline from `os i18n extract`
 *      (source: inline labels on every `*.form.ts` schema + `DEFAULT_METADATA_TYPE_REGISTRY`).
 *   2. Hand-curated overlay (zh-CN only) merged on top — last write wins.
 *
 * Re-run `pnpm --filter @objectstack/platform-objects i18n:extract` whenever
 * a form schema changes; the generated `*.metadata-forms.generated.ts` files
 * are the source of truth for English/Japanese/Spanish and the gap-fill
 * baseline for Simplified Chinese (overrides live in `./zh-CN.ts`).
 */
function mergeData(base: TranslationData, overlay: TranslationData | undefined): TranslationData {
  if (!overlay) return base;
  const out: TranslationData = { ...base };
  const baseMf = base.metadataForms ?? {};
  const overlayMf = overlay.metadataForms ?? {};
  const mergedMf: Record<string, any> = { ...baseMf };
  for (const [type, ov] of Object.entries(overlayMf)) {
    const ex = (mergedMf[type] ?? {}) as any;
    mergedMf[type] = {
      ...ex,
      ...ov,
      sections: { ...(ex.sections ?? {}), ...((ov as any).sections ?? {}) },
      fields: { ...(ex.fields ?? {}), ...((ov as any).fields ?? {}) },
    };
  }
  out.metadataForms = mergedMf;
  return out;
}

export const MetadataFormsTranslations: TranslationBundle = {
  en: { metadataForms: enMetadataForms },
  'zh-CN': mergeData({ metadataForms: zhCNMetadataForms }, zhCNOverlay),
  'ja-JP': { metadataForms: jaJPMetadataForms },
  'es-ES': { metadataForms: esESMetadataForms },
};
