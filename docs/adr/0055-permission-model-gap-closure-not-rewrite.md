# ADR-0055: The permission model evolves by gap-closure against a mainstream baseline, not a rewrite

**Status**: Proposed (2026-06-19)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0049](./0049-no-unenforced-security-properties.md) (enforce-or-remove gate), [ADR-0054](./0054-runtime-proof-for-authorable-surface.md) (prove-it-runs gate)
**Surfaced by**: an audit of master-detail permission semantics — `OWDModel.controlled_by_parent` is declared in the spec yet has **zero runtime consumers**, is **not reachable** through the object's actual `sharingModel` field, and the RLS compiler is relationship-blind. The question it raised: *is the authorization model wrong at the foundation (rewrite), or is it the right shape with enumerable gaps (close them)?*

---

## TL;DR

ObjectStack's authorization model is **already structurally the mainstream (Salesforce-shaped) model**: permission sets + field-level security + predicate row-level security + record ownership + sharing rules + a role/department hierarchy. It is not primitive and its core abstraction is not wrong.

What it has is **enumerable gaps and unenforced declared surface** — most visibly **master-detail "controlled by parent"**: the spec declares `OWDModel.controlled_by_parent` ("Access derived from parent record (Master-Detail)") but nothing reads it, it is not even authorable through the object's real `sharingModel` enum, and the RLS compiler has no relationship traversal. That is exactly the *false compliance* ADR-0049 exists to kill and the *unproven liveness* ADR-0054 exists to expose.

**Decision.** Do **not** rewrite the permission model. Treat a mainstream platform (Salesforce primary, Microsoft Dataverse secondary) as a **conformance checklist**, not a blueprint to rebuild from. Close each gap deliberately through the gates we already built — **ADR-0049 enforce-or-remove** and **ADR-0054 prove-it-runs** — recording every capability's verdict in a living conformance matrix. The first concrete verdict is master-detail `controlled_by_parent`: **implement it (with a dogfood RLS proof) or remove the misleading enum**, and fix the `OWDModel` ↔ `object.sharingModel` inconsistency either way.

---

## Context

### The model is already the right shape

| Capability | Salesforce | Dataverse (Power) | ServiceNow | **ObjectStack today** |
|---|---|---|---|---|
| Object-level CRUD | Profile / PermSet | Security Role | table ACL | ✅ `permission.objects.allow{Create,Read,Edit,Delete}` |
| Field-level security | FLS | Field Security Profile | field ACL | ✅ `permission.fields.{readable,editable}` |
| Row-level security (predicate) | — (via sharing) | BU/owner depth | query ACL | ✅ `permission.rowLevelSecurity.{using,check}` (incl. the #1994 by-id-write pre-image check) |
| Record ownership | owner | user/team-owned | created_by | ✅ owner policy on `created_by` |
| Hierarchy access | role hierarchy | BU hierarchy | groups | ◑ department/role hierarchy (`plugin-sharing` department-graph) |
| Sharing rules (owner / criteria) | ✅ | sharing | — | ◑ `sys_sharing_rule` (owner + criteria) |
| Manual / programmatic grants | manual + Apex share | access team | — | ◑ share-links / grants |
| OWD baseline per object | private…public | org default | — | ◑ `object.sharingModel` = private/read/read_write/full |
| **Master-detail "controlled by parent"** | Controlled by Parent | parent-child BU | — | ❌ **declared-only, unenforced** |
| Teams / groups as principals | account/case teams | owner/access teams | groups | ◑ team principal |

The deltas are specific capability points (`◑`/`❌`), not a wrong foundation (predicate-RLS + permission-sets + sharing-rules + hierarchy *is* the mainstream pattern).

### Verified facts behind the headline gap

- `packages/spec/src/security/sharing.zod.ts` — `OWDModel` enum includes `'controlled_by_parent' // Access derived from parent record (Master-Detail)`.
- `packages/spec/src/data/object.zod.ts` — the object's actual `sharingModel` is a **different, narrower** enum `z.enum(['private','read','read_write','full'])` that **does not include** `controlled_by_parent`. The two are out of sync; the value is not authorable on a real object.
- `controlled_by_parent` has **zero non-spec, non-test runtime consumers** (2 total occurrences, both in spec).
- `packages/plugins/plugin-security/src/rls-compiler.ts` — the compiler recognizes **exactly four forms** (`field = current_user.prop`, `field = 'literal'`, `field IN (current_user.array)`, `1 = 1`); intentionally **no subqueries / joins / relationship traversal**. There is no "resolve the detail's access through its master" path.
- `plugin-sharing`'s only "parent" logic is `sys_department.parent_department_id` (the org/department hierarchy for principal expansion) — unrelated to master-detail record inheritance.

So master-detail today carries **lifecycle only** (cascade delete via `deleteBehavior: cascade`, `$expand`, inline editing) — **not** permission inheritance. A child object's RLS/sharing is evaluated entirely on the child's own fields/owner, independently of the master.

### Why this is gap-closure, not a rewrite

- **Security is the worst subsystem to rewrite for cleanliness.** Every rewrite re-opens holes like #1994 (the by-id-write bypass). The current engine has accumulated hard-won, tested invariants: the by-id-write pre-image check, the org-scoping policy-stripping logic, the fail-closed RLS compiler. A rewrite resets that to zero.
- **The gaps are enumerable** (the matrix above), not systemic. They are debt items, each independently closable.
- **We already built the right tools to close them safely**: ADR-0049 (enforce-or-remove) + ADR-0054 (prove-it-runs) + the liveness ledger. They are designed for exactly this — classify each authorable property honestly, then implement-with-a-proof or remove. That is a ratchet, not a rewrite.

## Decision

1. **No rewrite.** Keep the predicate-RLS + permission-set + sharing-rule + hierarchy engine and its invariants.
2. **Mainstream platform as a conformance checklist, not a blueprint.** Salesforce is the primary reference (closest model + the mental model AI authors arrive with); Dataverse secondary. Use it to decide *which* gaps to close and *which to explicitly decline* — not to rebuild.
3. **Every capability gets a verdict**, recorded in a living conformance matrix and driven through the existing gates:
   - **implement-with-proof** — build it, and (ADR-0054) carry a dogfood RLS proof;
   - **remove** — (ADR-0049) delete the misleading declared surface;
   - **not-do** — record an explicit non-goal with rationale.
4. **First verdicts** (recommended; this ADR's acceptance settles them):

   | Gap | Verdict | Rationale |
   |---|---|---|
   | Master-detail `controlled_by_parent` | **implement-with-proof OR remove** (decide on acceptance) | Table stakes for a relational low-code platform; today it is false compliance. Implementing = detail read/write access resolved through the master + a "can't-read-master ⇒ can't-read/write-detail" dogfood proof. If declined, remove the enum value. |
   | `OWDModel` ↔ `object.sharingModel` inconsistency | **fix either way** | The two enums must converge: either `controlled_by_parent` becomes authorable on `sharingModel`, or the dead value is dropped from `OWDModel`. |
   | Role/department hierarchy access depth | **audit → enforce-or-remove** | Confirm "grant access via hierarchy" actually applies at read/write; classify in the ledger. |
   | `permission.contextVariables` | **remove** | Already ledgered `dead` (rls-compiler never reads it). |
   | ServiceNow-style scripted/per-row ACL scripts | **not-do** | Over-engineering for an AI-authored platform; unpredictable AI output. The four-form fail-closed compiler is the deliberate ceiling. |

5. **Master-detail is the headline.** Its concrete semantic decision (how deep does inheritance go; read-only vs read-write穿透; interaction with the child's own owner policy) may, if it needs more depth than this ADR settles, spin into a child ADR that *builds on* this one — exactly as ADR-0054 builds on ADR-0049.
6. **Enabling harness.** Relationship-derived-access proofs need the verifier to synthesize parent+child record graphs. The related-record **topological synthesis** capability in `@objectstack/verify` (currently it skips objects with required relations) is the prerequisite for those proofs and is sequenced ahead of the master-detail proof.

## Consequences

- **Positive.** The model converges toward mainstream conformance **without** a high-risk security rewrite; every closed gap leaves behind a runtime proof (ADR-0054) or a removed dead surface (ADR-0049); the AI-authoring audience gets predictable, Salesforce-aligned behavior. The conformance matrix becomes the single, honest source of "what authorization actually does."
- **Negative / cost.** Gap-closure is incremental and visible debt sits in the matrix until burned down. Master-detail inheritance is a non-trivial feature (relationship-aware access resolution) whose proof depends on the verifier's topological-synthesis work landing first.

## Non-goals

- **A permission-model rewrite.** Explicitly rejected.
- **Implementing every mainstream feature.** The matrix decides per-capability; some are `not-do` on purpose (e.g. scripted ACLs).
- **Settling master-detail's full semantics here.** This ADR settles the *strategy* and the implement-or-remove *verdict*; deep semantics may move to a child ADR.
- **Client-side enforcement.** Authorization is server-enforced; UI affordances are presentation, out of scope for this gate (consistent with ADR-0054 §Non-goals).
