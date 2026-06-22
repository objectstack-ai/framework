---
"@objectstack/cli": minor
"@objectstack/formula": patch
---

build: validate UI action `visible` / `disabled` predicates at compile time

Extends the ADR-0032 build-time expression check to cover action `visible` and
`disabled` predicates (stack-level and object-attached), evaluated record-scoped
like validation rules. A record-header / row action's `visible` is evaluated by
`ActionEngine` against `{ record, recordId, objectName, user, … }` with
fail-closed semantics, so a **bare** field reference (`!done` instead of
`!record.done`) throws at runtime and the action is **silently hidden on every
record** — the trap behind the #2183 "Mark Done never hides" debugging hunt.
`os build` now reports it as an error with the corrective `record.<field>`
message instead of letting it ship.

`@objectstack/formula`: `ctx` and `features` are added to the record-scope
namespace roots (alongside the existing `user`, `data`, `context`, …) so the
ambient globals real action predicates use (`record.id == ctx.user.id`,
`features.multiOrgEnabled`) are not false-positives. Verified against the full
monorepo build (every example + platform bundle still compiles clean).
