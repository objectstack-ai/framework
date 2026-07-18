---
"@objectstack/spec": minor
---

feat(spec)!: remove form-surfaced dead metadata props + correct 3 misclassified-live entries (#2377, ADR-0049)

The next enforce-or-remove slice of #2377. Versioned `minor` per the launch-window
policy (the fixed group makes a `major` promote the whole monorepo).

## Removed (dead, no runtime reader — verified in both framework and objectui)

- **field**: `columnName`, `index`, `referenceFilters`. This empties the field
  dead-prop set. `columnName` also removed its now-moot **ADR-0062 D7** lint
  (`validate-expressions.ts`), the dead `StorageNameMapping.resolveColumnName` /
  `buildColumnMap` / `buildReverseColumnMap` helpers, and closes ADR-0062 R10 —
  external physical-column mapping is `external.columnMap` only.
- **object**: `tags`, `active`, `abstract` — now rejecting tombstones in
  `UNKNOWN_KEY_GUIDANCE`.
- **agent**: `tenantId`.

The removed props are dropped from the authoring forms (`field/object/agent.form.ts`)
and the regenerated metadata-forms i18n bundles.

## Corrected to `live` (the ledger was wrong — readers existed)

- **object `isSystem`** — `plugin-sharing` `effectiveSharingModel` defaults a
  no-`sharingModel` `isSystem` object to public; also read by the security-posture
  lint. KEPT.
- **object `enable.searchable`** — `metadata-protocol` global search (`searchAll`)
  uses `enable.searchable === false` as an opt-out. KEPT.
- **action `type:'form'`** — objectui `ActionRunner.executeForm` routes it to the
  FormView at `/forms/:target`; a build-time lint validates the target. KEPT.

## Deliberately deferred

`object.enable.trash` / `enable.mru` — dead, but inert `default(true)` flags set by
~35 `sys-*.object.ts` files; removing them is high-churn / low-value. Left `dead`
(authorWarn-skipped).

## Migration

- field/agent props: authoring them was already a no-op; they now strip silently.
  `columnName` → the physical column is always the field key (rename the field, or
  use `external.columnMap` for external objects); `index` → declare it in object
  `indexes[]`; `referenceFilters` → `lookupFilters`.
- object `tags`/`active`/`abstract`: `ObjectSchema.create()` now throws a located
  error naming the removal. None gated anything at runtime — remove them.
