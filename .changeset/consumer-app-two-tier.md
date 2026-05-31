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
- `defineStack()` now enforces **at most one App per package**: a package with
  `manifest.type === 'app'` may not define more than one app — the banned "suite
  contains apps" shape throws with a clear fix (fold into one app with multiple
  tabs, or split into separate packages). Zero apps is allowed; non-`app`
  package types are unconstrained. Non-breaking for existing stacks.

The package `type` enum is unchanged; the additions are non-breaking. No
runtime/registry/execution changes.
