---
"@objectstack/cloud-connection": minor
---

New package: `@objectstack/cloud-connection` — the open runtime-side client for an ObjectStack cloud control plane (ADR-0008 Phase 2). Carries the marketplace browse proxy, install-local, the `/api/v1/cloud-connection/*` surface (status, RFC 8628 device-code bind, org catalog, installed views, control-plane install), and `RuntimeConfigPlugin` with a `resolvePlanFeatures` policy seam (plan entitlements stay host-side). Canonical sources move here from the cloud distribution's `@objectstack/objectos-runtime`, which now re-exports them.
