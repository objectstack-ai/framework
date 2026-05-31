---
"@objectstack/spec": minor
---

ADR-0019 — App as the consumer-facing unit. The consumer Marketplace surfaces
exactly one user-visible noun, the App.

- Adds `CONSUMER_INSTALLABLE_TYPES` and `isConsumerInstallable(type)` (the single
  source of truth for "what a consumer can install").
- Constrains `MarketplaceListingSchema.packageType` to `CONSUMER_INSTALLABLE_TYPES`
  (default `app`) so a non-App (driver/server/plugin/…) listing cannot be
  represented — the "consumers see only Apps" guarantee is enforced in the data
  contract, not a forgettable query filter.
- `defineStack()` now enforces **one App per package**: a package with
  `manifest.type === 'app'` must define exactly one app (zero, or the banned
  "suite contains apps" shape, throws with a clear fix). Non-`app` package types
  are unconstrained. Existing examples (app-crm/app-todo/app-showcase) already
  define exactly one app, so this is non-breaking.

The package `type` enum is unchanged; the additions are non-breaking. No
runtime/registry/execution changes.
