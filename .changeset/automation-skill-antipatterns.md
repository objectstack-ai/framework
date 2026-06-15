---
---

docs(skill): add "valid-but-silently-wrong" anti-patterns to the automation authoring skill

Documentation-only — no package change. Adds this season's flow authoring
anti-patterns (the ones that pass build but fail at runtime, and that the new
build lints now catch) to `skills/objectstack-automation` Common Pitfalls, so the
AI author writes them right at the source: single-brace value interpolation
(#1315), `create_record` outputVariable holds the record / `{var.id}` (#1873),
time-relative rules as schedule+range not record-change date-equality (#1874),
`script` nodes must name a callable (#1870), conditions are bare CEL / stdlib only
(#1877).
