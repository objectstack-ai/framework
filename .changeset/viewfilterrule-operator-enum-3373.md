---
"@objectstack/spec": patch
---

fix(spec): enforce the `ViewFilterRule` operator enum with legacy-alias
normalization (#3373)

`ViewFilterRule.operator` was previously an open string, so views could persist
operators the runtime cannot evaluate. The Zod schema now constrains it to the
supported operator enum and normalizes the known legacy aliases to their
canonical form on parse. This is a public spec/api-surface change
(`packages/spec/api-surface.json`) that landed on `main` in #3373 without a
changeset; this backfills it so the fix ships in the next release instead of
being silently stranded.
