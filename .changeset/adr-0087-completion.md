---
'@objectstack/spec': minor
'@objectstack/cli': minor
'@objectstack/runtime': minor
'@objectstack/service-package': minor
'create-objectstack': minor
---

feat(protocol): complete ADR-0087 — load-seam handshake, chain backfill 12–15, release artifacts (#2643)

Closes the remaining ADR-0087 gaps (see the ADR's as-built Addendum):

- **P0 load seams (D1).** The protocol handshake now runs on the boot-time
  durable-package rehydration path (`@objectstack/service-package` refuses an
  incompatible `sys_packages` row with the structured `OS_PROTOCOL_INCOMPATIBLE`
  diagnostic and keeps booting) and on `AppPlugin` for code-defined stacks
  (fail-fast before the manifest is decomposed). `objectstack lint` gains
  `protocol/missing-engines-range` (warning + fix-it) and the
  `create-objectstack` blank template stamps `engines: { protocol: '^<major>' }`
  (re-stamped at version time by `scripts/sync-template-versions.mjs`) — the
  two ends of the grandfathering ratchet.
- **Chain backfill (D2/D3).** `MetadataConversion.retiredFromLoadPath`
  implements the load-window's second half (retired entries replay only via
  `migrate meta` / fixture CI). Steps 12–15 land: the `api.requireAuth` flip
  (semantic), the ADR-0090 wave (3 retired conversions + 5 semantic TODOs), the
  `BookAudience` rename (retired conversion), and the ADR-0089 visibility
  unification (`visibleOn`/`visibility` → `visibleWhen` as LIVE load-window
  conversions) + the `.strict()` flip (semantic). The protocol-11
  `compactLayout` → `highlightFields` rename is backfilled as a retired step-11
  conversion. `migrate meta --from 10` now reaches protocol 15.
- **Release artifacts (D4).** `spec-changes.json` is generated from the
  registries (`gen:spec-changes`, CI drift-checked), ships in the npm artifact
  together with `api-surface.json`, and is attached to each `@objectstack/spec`
  GitHub Release with `added[]`/`removed[]` filled from the api-surface diff
  against the previously published release. The upgrade guide
  (`docs/protocol-upgrade-guide.md`) is generated from the same registries and
  CI drift-checked — a projection that cannot drift.
