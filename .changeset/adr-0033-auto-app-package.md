---
"@objectstack/service-ai": minor
---

feat(ai): zero-package app building — auto-home a blueprint's app in a writable package

When the AI blueprint flow builds an **app**, it now silently gives that app a writable "home" package (one app ⇒ one `app.<name>` package) and binds every drafted artifact (objects, views, dashboards, the app) to it — so a business user never has to create a "package" to start building (the mainstream AI-builder UX: Power Apps' default solution, Salesforce orgs). Packaging/versioning stays an opt-in, later concern.

- `apply_blueprint` ensures the app package up front (idempotent: reuse if it exists, else create via the runtime `package` service) and threads its `packageId` through every `stageDraft` → `sys_metadata.package_id`. The result envelope gains `package: { id, name, created }`.
- The `package` service is resolved **lazily** (per call, not at plugin-init time) so it works regardless of service-init order and picks up the opt-in `marketplace` capability when present.
- **Best-effort, non-fatal:** if no `package` service is wired, drafting proceeds package-less exactly as before — the build never fails on packaging.

Scope/caveats: this stamps the *legacy* `sys_metadata.package_id` (a real grouping + the foundation for later version/export/promote), not the sealed `sys_package_version` model — full cross-environment promotion and Studio package-selector visibility depend on finishing the runtime package subsystem (ADR-0027), tracked separately. (The showcase example enables the `marketplace` capability to exercise this.)
