---
"@objectstack/formula": minor
"@objectstack/service-automation": minor
"@objectstack/service-ai": minor
"@objectstack/cli": minor
"@objectstack/spec": patch
---

ADR-0032 (phase 1): validate-by-default expression layer — no silent failure.

Kills the #1491 class where a malformed predicate (e.g. the `{record.x}`
template-brace-in-CEL mistake) silently evaluated to `false` and made a flow
"fire" with no effect:

- **service-automation**: flow `evaluateCondition` no longer swallows CEL
  failures to `false` — it throws an attributed, corrective error; and
  `registerFlow` now parse-validates every predicate (start/decision/edge
  condition) at registration, failing loudly with the offending location +
  source + the fix.
- **formula**: new shared validator — `validateExpression(role, src, schema?)`,
  `introspectScope`, `CEL_STDLIB_FUNCTIONS` — with schema-aware field-existence
  + did-you-mean. The `{{ }}` template engine gains a formatter whitelist
  (`currency`/`number`/`percent`/`date`/`datetime`/`truncate`/`upper`/`lower`/
  `default`/…) with defined value→string semantics; arbitrary logic in holes is
  rejected. Plain `{{ path }}` stays back-compatible.
- **cli**: `objectstack compile` validates every flow / validation-rule /
  field-formula predicate against the resolved object schema and fails the
  build with located, corrective messages.
- **service-ai**: new agent-callable `validate_expression` tool so authoring
  agents self-correct before committing.
- **spec**: fix the `FlowSchema` JSDoc example that taught the bad
  `condition: "{amount} < 500"` single-brace form.
