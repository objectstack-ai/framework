---
"@objectstack/objectql": patch
---

fix(objectql): surface the human validation message in `ValidationError.message`, not a `field (code)` digest

When an object-level validation rule (ADR-0020 `validations[]`) rejected a
save, the console toast showed the generic English string
`Validation failed for 1 field(s): _record (rule_violation)` instead of the
rule author's own `message` (often localized, e.g. 最小水深不能大于最大水深。).

The author's message was always transported in `ValidationError.fields[].message`
through the whole chain (rule-validator → REST envelope `fields[]` → client SDK
`error.details`), but every generic UI surface displays the top-level
`Error.message`, which only contained the `field (code)` pairs.

Fix at the single choke point — the `ValidationError` constructor now builds its
top-level message from the per-field human messages (joined with `; `), falling
back to `field (code)` only when a field error has no message. Machine-readable
`code` and `fields[]` are unchanged, so programmatic consumers and the REST
envelope shape are unaffected; every client (console toast, CLI, SDK callers)
now sees the author-written message with no client-side change needed.
