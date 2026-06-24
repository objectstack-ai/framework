---
'@objectstack/spec': patch
---

Promote `PageSchema.variables` from @experimental to live (ADR-0049)

Page-local state is now wired end-to-end (runtime in objectui#1957: page
variables are injected into the visible/CEL expression context as `page.<var>`,
and `element:record_picker` writes a variable via its `source` binding). The
spec docs are updated to describe the now-live behaviour and the binding
direction, and the liveness ledger entry is flipped `experimental → live`.
