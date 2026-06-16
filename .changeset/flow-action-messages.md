---
"@objectstack/spec": minor
"@objectstack/service-automation": minor
---

feat(automation): declarative screen-flow completion/error messages + action `errorMessage`

A screen flow can now declare `successMessage` / `errorMessage` (FlowSchema). The
engine surfaces them on the terminal `AutomationResult` (`successMessage` on
success, `errorMessage` on failure), so the UI flow-runner shows a meaningful
toast instead of a generic "Done" / the raw error — no manual "success screen"
node needed. The CRM convert-lead wizard sets a friendly completion message.

Also exposes `errorMessage` on the UI Action schema. The runtime (ActionRunner)
already honoured it; it just wasn't declarable in the spec — closing a
spec↔runtime gap so authors can set a friendly failure toast.
