---
"@objectstack/types": patch
---

refactor: single-source the multi-org (`OS_MULTI_ORG_ENABLED`) flag resolution

"Is this deployment multi-org?" was resolved in 10 places across 8 packages
with three subtly different inline expressions:

- the canonical `String(readEnvWithDeprecation('OS_MULTI_ORG_ENABLED',
  'OS_MULTI_TENANT') ?? 'false').toLowerCase() !== 'false'` (objectql registry,
  plugin-dev, runtime app-plugin, cli serve/verify, cloud-connection),
- a redundant `env.OS_MULTI_ORG_ENABLED !== undefined ? … : …` variant in
  plugin-auth (auth-manager `/auth/config` features + `beforeCreateOrganization`
  guard),
- and a bare `process.env.OS_MULTI_ORG_ENABLED ?? process.env.OS_MULTI_TENANT`
  read in the SQL driver's `isMultiTenantMode()` — which skipped the
  `OS_MULTI_TENANT` deprecation warning every other site emits.

Because the SQL driver computed the mode independently of the auth/security
layer, the driver's tenant-audit gate and the rest of the system could in
principle disagree about whether tenant isolation is active.

Introduces `resolveMultiOrgEnabled()` in `@objectstack/types` (next to
`readEnvWithDeprecation`, the natural leaf dependency) as the single source of
truth, and routes all 10 sites through it. `@objectstack/driver-sql` gains a
direct `@objectstack/types` dependency (previously it read `process.env`
directly).

Behaviour is unchanged everywhere except the SQL driver, which now also emits
the one-shot `OS_MULTI_TENANT`-is-deprecated warning — consistent with every
other site. This mirrors the `resolveAuthzContext` single-source pattern in
`@objectstack/core`. Follow-up (not in this change): a lint gate forbidding new
inline reads of these env vars outside the helper.
