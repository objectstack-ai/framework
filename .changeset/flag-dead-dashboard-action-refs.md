---
"@objectstack/lint": minor
"@objectstack/cli": minor
---

Flag dead action/route references in dashboard header & widget actions (ADR-0049 for references, #3367).

`os validate` / `os build` now run a new `validateDashboardActionRefs` gate over every dashboard `header.actions[]` and widget `actionUrl`:

- `actionType: 'script' | 'modal'` — **error** unless `actionUrl` resolves to a defined action (`stack.actions` or an object's `actions`). `modal` also resolves via the runtime `<verb>_<object>` convention (`create_/new_/add_/edit_/update_` + a real object) and bare object names. A dangling target ships a button that renders and silently does nothing on click — a false affordance, exactly the "declared ≠ enforced" gap ADR-0049 closes, applied to references.
- `actionType: 'url'` — **warning** when a relative in-app path names a `objects/reports/dashboards/pages/views` route whose target does not exist in the stack. External URLs, interpolated (`${…}`) targets, and opaque routes are skipped to keep false positives near zero.
