---
"@objectstack/cli": minor
---

ADR-0048 follow-up: `os lint` now emits a `naming/namespace-prefix` **warning** when a bare-named UI/automation item is not namespace-prefixed. This shifts the cross-package collision detection (ADR-0048, runtime `MetadataCollisionError`) left to authoring time — a soft nudge to prefix `app`/`page`/`dashboard`/`flow`/`action`/`report`/`dataset` names with the package namespace, so a clash with another package is unlikely to ever reach install.

Warning-only and never fatal (only errors fail the lint). An app named after the namespace (ADR-0019 single-app convention, e.g. `crm`) and `sys_`-reserved names are exempt; objects (already prefix-enforced as an error) and object-derived views are untouched.
