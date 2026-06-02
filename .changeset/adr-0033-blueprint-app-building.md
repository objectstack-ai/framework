---
"@objectstack/spec": minor
"@objectstack/service-ai": minor
---

feat(ai): blueprint app-building — propose/draft the navigation app, not just the data model

The plan-first blueprint (ADR-0033 §4) now also designs the **app** (the navigation shell end users open in the App Launcher), so "build me a project-management application" yields an openable app — not just its objects, views, and dashboards.

- `SolutionBlueprintSchema` (`@objectstack/spec/ai`) gains an optional `app: { name, label?, icon?, nav? }`, where each nav entry targets a created object or dashboard. `nav` may be omitted to auto-surface every object (then dashboard).
- `apply_blueprint` expands the app into an `AppSchema` body (single-level `navigation` of object/dashboard items) and drafts it last — through the same draft-gated, per-type-validated `stageDraft` path as everything else. It never sets `isDefault`.
- `propose_blueprint` now asks the agent to include the app and reports `counts.app`.

Still draft-gated: nothing is live until the human publishes. Scope is basic app-building (one app, flat nav); areas/groups/mobile-nav remain author-it-later via `update_metadata`.
