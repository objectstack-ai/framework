---
'@objectstack/spec': patch
---

docs(spec): `readonly` is server-enforced on UPDATE, not a UI-only affordance (#3003)

The `readonly` field property was described as "Read-only in UI", which #3003
proved to be exactly how integrators read it — approval/status/amount columns
protected only by `readonly: true` were forged with a direct REST `PATCH`,
self-approving a multi-stage approval on the released 15.0.0. Since #2948 the
engine strips caller-supplied writes to statically-readonly fields from every
non-system UPDATE (single-id and multi-row, symmetric with `readonlyWhen`;
INSERT may still seed the column). The schema description and the field
liveness ledger now state the server-side contract, and a dogfood conformance
proof (`showcase-static-readonly.dogfood.test.ts` + an authz-matrix row) pins
it end-to-end so it cannot silently regress to renderer-only.
