---
'@objectstack/spec': minor
'@objectstack/plugin-security': minor
---

Per-operation object `requiredPermissions` (ADR-0066 ⑤) — an object can now be
read-open / write-gated instead of gating all of CRUD on one capability set.

`Object.requiredPermissions` accepts either the original `string[]` (capabilities
required for **all** operations) **or** a `{ read?, create?, update?, delete? }`
map that gates each operation class independently — mirroring how Salesforce and
Dataverse separate capability by operation. plugin-security enforces the caps for
the request's operation class as the same D3 AND-gate (checked before the CRUD
grant, fail-closed). The mapping folds `transfer`/`restore` into `update` and
`purge` into `delete`, derived from the existing CRUD permission bits so it stays
in lockstep with them.

Backward-compatible: the `string[]` form keeps its gate-every-operation semantics
(normalized into an `all` bucket that unions with the per-operation bucket), so
existing objects are unaffected. The per-operation map's keys are validated
`.strict()`, so a mistyped key (e.g. `reads`) is rejected at author time rather
than silently ignored.
