---
"@objectstack/spec": minor
---

Complete the FormView protocol with the form-presentation options the ObjectForm
component already accepts (conformance follow-up). FormViewSchema gains optional
`layout`, `columns`, `title`, `description`, `defaultTab`, `tabPosition`,
`allowSkip`, `showStepIndicator`, `splitDirection`, `splitSize`, `splitResizable`,
`drawerSide`, `drawerWidth`, `modalSize` — the per-`type` (tabbed/wizard/split/
drawer/modal) presentation config. The spec↔frontend conformance check went from
14 frontend-only → 0 for object-form; the react-tier contract now sources these
from the spec (with descriptions) instead of a hand-authored overlay.
