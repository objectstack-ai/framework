---
"@objectstack/mcp": minor
---

feat(mcp): `validate_expression` tool — validate a CEL expression against a schema before authoring (#1928)

Adds an agent-callable MCP tool that runs the same build-time expression checks
as `objectstack build`, so an AI can validate a formula / predicate / flow
condition **while authoring** instead of shipping one that silently evaluates to
`null`. Given `{ objectName, expression, site? }` it resolves the object's real
schema (field names + types, via the principal-bound `describeObject` bridge)
and returns:

- **errors** — bare field refs (`amount` → `record.amount`), unknown fields
  (with a did-you-mean), unknown functions;
- **warnings** — text/boolean fields misused in arithmetic, date-equality
  pitfalls;
- **inScope** — the fields, stdlib functions, and namespace roots available, so
  the model can self-correct;
- **inferredType** for a `formula` site.

`site` (`formula` | `validation` | `flow_condition` | `template`, default
`formula`) maps to the validator's role + scope — `flow_condition` binds fields
bare, the rest bind `record.<field>`. Read-only, gated by the `data:read` OAuth
scope, and fail-closed on `sys_*` objects like the other schema tools. This is
the authoring-time surface the guardrail series (#1928) always pointed at;
`@objectstack/mcp` gains a `@objectstack/formula` dependency (acyclic; formula is
a leaf).
