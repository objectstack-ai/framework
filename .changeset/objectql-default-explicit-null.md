---
"@objectstack/objectql": patch
---

fix(objectql): apply field `defaultValue` when a field is explicitly `null` on insert, not only when omitted (#2706)

`applyFieldDefaults` previously skipped any field whose value was not
`undefined`, so a form that serialized an unpicked control as `null` (rather
than omitting it) fell through and stored `null` — the `current_user` token and
static defaults never filled in. Both an omitted field and an explicit `null`
now count as "no value supplied" and receive the default. This runs on the
insert path only, so a deliberate "set to null" on update is untouched; an
explicit empty string `''` is still respected as a real value.
