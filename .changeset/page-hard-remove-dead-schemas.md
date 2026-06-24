---
"@objectstack/spec": minor
---

chore(spec): hard-remove the dead `blank`/`record_review` page config (enforce-or-remove)

Completes the enforce-or-remove started in framework#2265. The `blank` and
`record_review` page types were already removed from `PageTypeSchema` (no
renderer), their fields marked `@deprecated`, and objectui dropped all
references (objectui#1949). This deletes the now-unreachable surface:

- `BlankPageLayoutSchema`, `BlankPageLayoutItemSchema`, `RecordReviewConfigSchema`
  (and their inferred types `BlankPageLayout`, `BlankPageLayoutItem`,
  `RecordReviewConfig`).
- The `blankLayout` and `recordReview` fields on `PageSchema`.
- `page-builder.zod.ts` (the `blank`-type drag-drop canvas config:
  `PageBuilderConfigSchema` / `CanvasSnapSettingsSchema` / `CanvasZoomSettingsSchema`
  / `ElementPaletteItemSchema` / `InterfaceBuilderConfigSchema` and their types)
  and its `@objectstack/spec/studio` re-exports — nothing consumed them.

The `page` liveness ledger drops to 15 properties (the 2 `dead` entries are gone).
No consumers in framework or objectui (objectui#1949 already merged).

**Version note (kept `minor`, not `major`).** These exports shipped in the
published `10.3.0`, so under ADR-0059 §4 (the freeze contract) a removal would
normally demand a major bump. It is kept `minor` as a deliberate, documented
exception: the removed symbols are config schemas for the renderless
`blank`/`record_review` page types — authoring those already failed at runtime
("Unknown component type"), the frozen `@objectstack/downstream-contract`
fixture never referenced them, and the pre-publish hotcrm live gate guards
against any real consumer break. The `api-surface.json` snapshot is regenerated
alongside this so the removal is acknowledged, not silent.
