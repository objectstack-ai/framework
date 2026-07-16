// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

export { PinyinSearchPlugin } from './pinyin-search-plugin.js';
export type { PinyinSearchPluginOptions } from './pinyin-search-plugin.js';
export {
  bindSearchCompanionHooks,
  backfillSearchCompanion,
  rebuildSearchCompanion,
  PINYIN_SEARCH_HOOK_PACKAGE,
} from './companion-projection.js';
export type {
  CompanionBackfillOptions,
  CompanionBackfillResult,
} from './companion-projection.js';
export { computeSearchCompanionValue } from './pinyin.js';
