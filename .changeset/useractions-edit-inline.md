---
'@objectstack/spec': patch
---

feat(spec): add `userActions.editInline` toggle for inline record editing

`UserActionsConfigSchema` — the shared toggle set behind both a view's toolbar
and a page's `interfaceConfig.userActions` — gains `editInline: boolean`
(default `false`, alongside `addRecordForm`). The runtime already honors it
(objectui `InterfaceListPage` reads `userActions.editInline` → `inlineEdit`),
and the metadata-admin "Interface (list pages)" panel — which auto-renders
these booleans as checkboxes — now exposes an "Edit Inline" toggle. When on,
cells edit with the field's type-aware widget (the same control the form uses).
A list stays read-only unless the author opts in.
