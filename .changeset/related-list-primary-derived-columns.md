---
"@objectstack/spec": minor
---

Detail-page related lists: `relatedList: 'primary'` prominence + optional related-list columns (#2579).

`Field.relatedList` on a child's `lookup`/`master_detail` FK becomes a tri-state
`boolean | 'primary'`. `'primary'` marks a CORE relationship — a prominence hint
(ADR-0085), not a layout switch — that the detail page promotes to its own tab,
while non-primary children collapse into a single shared "Related" tab.
`false`/`true` keep their meaning (suppress / show in the derived default), so
the change is additive and opt-in per relationship (no primary anywhere → the
detail page is byte-for-byte the legacy stacked default).

`RecordRelatedListProps.columns` becomes optional: when omitted the related list
derives its columns from the child object's `highlightFields` / default list
columns — a related list is just another surface that lists that object.
Required → optional is back-compat.

Renderer + derivation changes ship in objectui: `relatedList: 'primary'` → own
tab; one related list per eligible FK (a child that references the parent
through several relationships now surfaces each, previously only the first);
self-referential relationships (hierarchies) surface a "child" list; and the
lookup-picker default columns are unified onto the same `highlightFields`
source so a picker and a related list of the same object agree with zero
per-surface config.
