# @objectstack/plugin-pinyin-search

## 15.1.0

### Minor Changes

- 1c58abd: Generic pinyin search recall (#2486, ADR-0098): a locale-gated
  `OS_SEARCH_PINYIN_ENABLED` switch (auto-on when the stack configures any
  `zh-*` locale) provisions a hidden `__search` companion column for each
  object's display/name field at compile time, the new
  `@objectstack/plugin-pinyin-search` fills it with full pinyin + initials
  ("张伟" → "zhangwei zw") on before-save (plus boot backfill and a
  `rebuildSearchCompanion` reconcile entry), and `$search` ORs the column in at
  query time — so lookup pickers, list quick-search and ⌘K transparently match
  `zhangwei` / `zw` against CJK names. Purely additive: `resolveSearchFields`,
  `searchableFields`, drivers and non-Chinese deployments are untouched; FLS
  restricted / secret / PII fields never feed the companion.

### Patch Changes

- Updated dependencies [7f68068]
- Updated dependencies [86c0aea]
- Updated dependencies [99755b5]
- Updated dependencies [e0b049a]
- Updated dependencies [e9a2885]
- Updated dependencies [464418e]
- Updated dependencies [6613ad0]
- Updated dependencies [a16972b]
- Updated dependencies [1c58abd]
- Updated dependencies [8b27dd7]
  - @objectstack/objectql@15.1.0
  - @objectstack/core@15.1.0
  - @objectstack/types@15.1.0
