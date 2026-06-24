---
'@objectstack/spec': minor
'@objectstack/service-analytics': minor
---

feat(analytics): multi-hop relationship joins for datasets (ADR-0071)

A dataset's `include` and dimension/measure `field` paths may now traverse up to
3 to-one relationship hops (`account.owner.region`), not just one. The compiler
expands each declared path into the ordered join chain (one `cube.join` per path
prefix, aliased dot-free as `account__owner` so it stays a single valid SQL
identifier), and the NativeSQLStrategy emits the chained `LEFT JOIN`s. Per-hop
tenant/RLS read-scope is enforced for EVERY object in the chain — the
alias-driven scope loop already generalizes, so no security path is rewritten.

Restricted to **to-one** (lookup / master_detail) relationships, which never fan
out — aggregates stay correct with no symmetric-aggregate machinery; to-many
traversal is out of scope. Single-hop datasets are byte-for-byte unchanged (the
dot-free alias is a no-op for a single segment). Undeclared paths are still
rejected (ADR-0021 D-C); paths beyond 3 hops are rejected at both parse and
compile time.
