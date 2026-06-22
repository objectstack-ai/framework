---
"@objectstack/platform-objects": minor
"@objectstack/plugin-sharing": minor
---

Add `sys_user.primary_business_unit_id` projection (ADR-0057 addendum D12).

Adds a denormalised `primary_business_unit_id` lookup to `sys_user`, maintained
by plugin-sharing as a projection of `sys_business_unit_member.is_primary`
(insert/update/delete hooks + a boot-time backfill). This makes "pick people by
business unit" — the Dataverse *filtered lookup* / ServiceNow *reference
qualifier* interaction — expressible as a plain `where: { primary_business_unit_id: X }`
(and thus as a `lookupFilters` picker filter) with **zero** query-engine change,
without traversing the membership junction. `sys_business_unit_member` remains
the effective-dated, matrix-friendly source of truth; the new column is a
maintained projection, not a second source. Home is plugin-sharing (always
loaded, owns the BU graph) rather than plugin-org-scoping, so the projection
works in single-tenant deployments too. Picker filtering by BU is therefore an
**open** (non-enterprise) capability — only hierarchy *rollup* stays paid.
