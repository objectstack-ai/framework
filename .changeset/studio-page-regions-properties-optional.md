---
"@objectstack/spec": patch
---

fix(spec): make page `regions` and component `properties` optional

`PageSchema.regions` and `PageComponentSchema.properties` were required, which
made it impossible to create record/home/app pages in the Studio editor: the
New Page form has no region editor, and the create-form seeds a record page's
default layout from `buildDefaultPageSchema`, whose nodes carry props at the top
level — so every seeded block tripped `regions.N.components.M.properties:
expected record`. Both are now `.optional().default(...)`; an empty full page
falls back to the synthesized default layout, slotted pages compose via `slots`,
list pages ignore regions, and prop-less components (record:activity,
element:divider) no longer need `properties: {}`.
