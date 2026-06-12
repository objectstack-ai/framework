# @objectstack/cloud-connection

## 9.3.0

### Minor Changes

- 998c4e4: New package: `@objectstack/cloud-connection` — the open runtime-side client for an ObjectStack cloud control plane (ADR-0008 Phase 2). Carries the marketplace browse proxy, install-local, the `/api/v1/cloud-connection/*` surface (status, RFC 8628 device-code bind, org catalog, installed views, control-plane install), and `RuntimeConfigPlugin` with a `resolvePlanFeatures` policy seam (plan entitlements stay host-side). Canonical sources move here from the cloud distribution's `@objectstack/objectos-runtime`, which now re-exports them.
- b8e4232: Self-hosted binding becomes consumable (cloud ADR-0008 consumption side): `ConnectionCredentialStore` persists the one-time `oscc_` runtime bearer the bind flow returns (0600, env-local); all control-plane forwards fall back to it when no `OS_CLOUD_API_KEY` is set; new `POST /cloud-connection/unbind` revokes + clears; install-local's catalog fetch presents the credential so org/private packages resolve. The binding Setup UI ships WITH the plugin as SDUI metadata (`cloud_connection_settings` page + Setup-nav contribution, ADR-0029 K2) — the console only registers the `cloud-connection:panel` widget.
- 8950204: The Installed Apps page ships as metadata with `MarketplaceInstallLocalPlugin` (cloud ADR-0009 P2a): `marketplace_installed` page (page:header + `marketplace:installed-list` widget) and the Setup nav entry switches to `type:'page'`.
- 17ffc74: `LocalManifestSource` — the install-local disk ledger promoted to a first-class, exported desired-state owner for self-hosted runtimes (cloud ADR-0007 step ⑤). `MarketplaceInstallLocalPlugin` now delegates all ledger reads/writes to it; behavior unchanged. Also exports `InstalledManifestEntry` and `DEFAULT_INSTALLED_PACKAGES_DIR`.
- c802327: Marketplace Setup navigation is now plugin-owned (cloud ADR-0009): `MarketplaceProxyPlugin` carries the "Browse Marketplace" entry and `MarketplaceInstallLocalPlugin` carries "Installed Apps" — no plugin mounted (e.g. `OS_CLOUD_URL=off`), no entry, no dead page. The two entries are removed from `@objectstack/platform-objects`' setup-nav contributions (ADR-0029 K2 ownership handoff).

### Patch Changes

- Updated dependencies [3219191]
- Updated dependencies [290f631]
- Updated dependencies [50b7b47]
- Updated dependencies [f15d6f6]
- Updated dependencies [f8684ea]
  - @objectstack/spec@9.3.0
  - @objectstack/core@9.3.0
  - @objectstack/runtime@9.3.0
  - @objectstack/types@9.3.0
