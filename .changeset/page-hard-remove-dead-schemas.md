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
