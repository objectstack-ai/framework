---
"@objectstack/core": minor
"@objectstack/spec": minor
---

ADR-0095 D2/D3: the authorization kernel now resolves an explicit **posture
ladder** — a monotonic principal tier `PLATFORM_ADMIN > TENANT_ADMIN > MEMBER >
EXTERNAL` — once, in `resolveAuthzContext`, and carries it on
`ResolvedAuthzContext.posture`.

- **D2 — the ladder.** New `@objectstack/core/security` module `posture-ladder.ts`
  reuses the spec `AuthzPosture` enum and pins the rung → row-visibility
  injection-rule mapping (exactly one rule per rung) plus its two ADR-required
  invariants as unit-tested properties: strict nesting (rung *n*'s visible set ⊇
  rung *n−1*'s) and the `EXTERNAL` deny-by-default semantics (explicitly shared
  rows only — OWD baselines and sharing rules never widen it). `EXTERNAL` is
  defined and test-locked now but never resolved: no external principal type
  exists yet (portal/ADR-0093), so the resolver's floor is `MEMBER`.
- **D3 — capability-derived, single track.** The rung derives from held
  **capability grants**, never a better-auth role: `PLATFORM_ADMIN` from the
  unscoped `admin_full_access` grant (the same `viewAllRecords`/`modifyAllRecords`
  evidence the superuser bypass trusts), `TENANT_ADMIN` from the
  `organization_admin` grant. The better-auth `role='admin'` remains only a
  *provisioning source* of those grants (`auto-org-admin-grant.ts`,
  `mapMembershipRole`); no enforcement path reads the raw role, closing the
  #2836 dual-track adjudication class by construction.
- New spec export `ORGANIZATION_ADMIN` (the org-admin capability-grant name),
  alongside the existing `ADMIN_FULL_ACCESS`.

**Behavior-preserving.** Enforcement is unchanged — the per-object Layer 0
exemption and per-side superuser bypass still gate access exactly as before;
`posture` is an additive, derived, explainable field. The `authz-matrix-gate`
unit snapshot and the dogfood authz-conformance matrix stay green. No migration
required.
