---
"@objectstack/spec": minor
"@objectstack/runtime": minor
"@objectstack/rest": minor
---

Resolve the tenant default currency onto ExecutionContext.

Adds `ExecutionContext.currency` (ISO 4217) and resolves it from the
`localization.currency` setting alongside `timezone`/`locale` — in both the
runtime `resolveExecutionContext` and the REST mirror. This is the foundation
for the documented "applied when a currency field omits its own" fallback: the
tenant default is now carried on every request context, so analytics enrichment,
formatters, and renderers can resolve a measure/field currency down to the org
default instead of hard-coding it. Undefined when no tenant default is
configured (consumers then render a plain number).
