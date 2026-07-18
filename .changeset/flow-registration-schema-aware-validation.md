---
"@objectstack/service-automation": minor
---

feat(automation): schema-aware flow-condition validation at registration (#1928)

`registerFlow` now runs the same schema-aware condition checks as
`objectstack build` — so a flow registered dynamically (via the API / Studio,
bypassing the build lint) still gets the guardrail. When the host wires an
object-schema resolver, a flow condition that references an unknown field,
likely-typos a field name, or does arithmetic/ordering on a text/boolean field
against a number is surfaced as an **advisory warning** (logged), pointing at
the object's real schema.

- New `AutomationEngine.setObjectSchemaResolver(resolver)` bridge (mirrors
  `setFunctionResolver`); `AutomationServicePlugin` wires it to
  `objectql.registry.getObject` in `start()`, before the flow pull, so
  registry-sourced flows are covered too.
- **Strictly additive / zero regression**: the fatal set is unchanged (syntax,
  brace-in-CEL, unknown-function still throw); everything the schema pass adds is
  logged, never thrown, and the whole thing is a no-op when no resolver is wired.
  Flow conditions bind fields flat, so the check runs in `flattened` scope
  (flow variables stay `dyn` and are never flagged; equality is runtime-safe).

Builds on the tier-4 type-soundness check in `@objectstack/formula` /
`@objectstack/lint` (#1928).
