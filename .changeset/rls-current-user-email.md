---
"@objectstack/spec": minor
"@objectstack/plugin-security": minor
"@objectstack/runtime": patch
"@objectstack/rest": patch
"@objectstack/example-showcase": patch
---

feat(security): resolve `current_user.email` in RLS owner policies

RLS `using` predicates can now reference **`current_user.email`** — a unique,
human-readable, *seedable* owner anchor (`owner = current_user.email`). Previously
the RLS compiler resolved only `current_user.id` / `organization_id` / `roles` /
`org_user_ids`, so any owner-by-name/email predicate silently compiled to the
deny sentinel (fail-closed → the user saw nothing). Email is sourced for free
from the auth session (with a bounded `sys_user` fallback for the API-key path)
and threaded onto the `ExecutionContext` in both identity resolvers — the REST
data path (`rest-server`) and the dispatcher path (`resolve-execution-context`).

Display `name` is deliberately **not** exposed to RLS: names collide, and a
collision on an ownership predicate is an access-control leak. Only unique
identifiers (`id`, `email`) are resolvable.

This makes owner-scoped row-level security work with seed data (no per-user ids
needed) and, combined with `controlled_by_parent` (ADR-0055), lets a master's
owner scoping flow to its detail records. The example-showcase demonstrates it:
`showcase_invoice` carries an `owner` email + an owner RLS policy, its lines are
controlled-by-parent, and invoices/lines are seeded per owner. It also fixes the
showcase's previously inert owner predicates (they used `==` and `current_user.name`,
neither of which the compiler accepts) to `= current_user.email`.
