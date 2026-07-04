---
"@objectstack/spec": patch
"@objectstack/objectql": patch
"@objectstack/metadata": patch
---

Surface view-key collisions during view container expansion instead of renaming silently.

`expandViewContainer` keeps its backward-compatible rename behaviour (`<object>.<key>` →
`<object>.<key>_2` on collision) but now stamps a machine-readable
`_diagnostics.warnings` entry on the renamed `ExpandedViewItem`, explaining that
references targeting the requested name (form action targets, navigation `viewName`s)
will resolve to the *other* view. Both flattening loaders — the ObjectQL engine and the
MetadataPlugin — log these warnings at boot so the collision is visible instead of
manifesting as a form action opening a list view (#2554).
