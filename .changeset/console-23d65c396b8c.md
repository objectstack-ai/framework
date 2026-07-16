---
"@objectstack/console": patch
---

Console (objectui) refreshed to `23d65c396b8c`. Frontend changes in this range:

- fix(i18n): drop try/catch-around-hook in createSafeTranslation / useSafeTranslate (#2605)
- fix(app-shell): Studio Access matrix — history opens in-place sheet, breadcrumb stops escaping the pillar (#2599)
- fix(data-objectstack): emit mutation events from batchTransaction/bulk so related lists refresh after master-detail saves (#2607)
- fix(metadata-admin): follow the live app locale, not just navigator.language (#2602)
- feat(detail+fields+components+app-shell): record inline-edit polish (#2572) (#2604)
- fix(app-shell+kanban+list): row-predicate CEL authoring advertises runtime-bound roots; kanban binds host scope (#2571 follow-up) (#2603)
- fix(plugin-list): spec bare-string sort form crashed ListView (#2578 shape-mismatch audit) (#2601)
- fix(app-shell): lock the Access pillar permission matrix in read-only packages (#2570)
- fix(fields): localize relative-date humanize via Intl.RelativeTimeFormat (framework#3040) (#2593)
- fix(components): pin sticky leading cells at measured header widths (#2592)
- fix(app-shell,core): keep error-envelope objects out of toast.error — React #31 page crash (#2579) (#2580)
- feat(flow-designer): pick the target node per branch in the Decision Branches editor (#1942) (#2568)
- fix(core+data-objectstack+app-shell): canonicalize reference/reference_to at the schema chokepoints (#2407) (#2598)
- fix(dashboard-filters): spec-form filter options crashed the dashboard; add guide screenshots (#2578) (#2597)
- fix(fields): PeoplePicker cursor resets only on real result changes (de-flakes keyboard test) (#2594)
- fix(studio): stop force-opening the new-object dialog on empty packages (#2569)
- feat(studio): CEL editor with validate + autocomplete for field conditional rules (#1582) (#2571)
- feat(kanban): default lane field honours the ADR-0085 stageField role (#2596)
- fix(fields+detail): resolve pre-existing rules-of-hooks violations in cell renderers (#2595)

objectui range: `fb35e4828fdb...23d65c396b8c`
