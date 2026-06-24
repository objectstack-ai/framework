---
"@objectstack/spec": patch
---

fix(spec): don't require `slots` on slotted pages

`PageSchema`'s superRefine rejected any `kind: 'slotted'` page that didn't
provide a `slots` map — but a slotted page with no overrides is valid: every
slot falls through to the synthesized default layout, the natural starting
point before you add overrides. Requiring `slots` up front made the Studio
"New Page" form a dead-end the moment you picked "slotted" (the form can't
author a slot map), the same trap as the old required `regions`.
