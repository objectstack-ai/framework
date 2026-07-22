---
"@objectstack/spec": patch
---

feat(spec): let an inline `lookup` action param declare its reference target (#3405)

`ActionParamSchema` had no way to name the object an inline record-picker param
should search. Authors reasonably wrote the same key the field schema uses —
`{ name: 'inspector', type: 'lookup', reference: 'sys_user' }` — and the schema
stripped it as an unknown key, without an error. Downstream, the param dialog
saw a picker with no target and degraded it to a "paste the record id (UUID)"
text input. The authored intent was dropped silently and the user was handed a
control that a human cannot reasonably operate.

- Added `reference` to `ActionParamSchema`, spelled to match
  `FieldSchema.reference` so one spelling works in both places. It sits with the
  existing inline widget config (`multiple` / `accept` / `maxSize`), which had
  covered the file/image params but not the picker ones.
- A `lookup` / `master_detail` param declared **inline** with no `reference` is
  now a parse-time error pointing at the missing key, instead of degrading at
  render time. Field-backed params are unaffected: they inherit the target from
  the referenced field's metadata, which is not visible at parse time.
