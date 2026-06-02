---
"@objectstack/spec": minor
"@objectstack/service-ai": minor
---

feat(ai): ADR-0033 Phase C — plan-first blueprint authoring

For high-level goals ("build me a project-management system") the metadata assistant now designs before it builds. Adds a `SolutionBlueprintSchema` (`@objectstack/spec/ai`) describing proposed objects, fields, relationships, views, dashboards, and seed data with stated assumptions, plus two tools:

- `propose_blueprint(goal)` — emits a structured blueprint via structured output. **Nothing is persisted**; the agent presents it for conversational confirmation and asks at most 1–2 structure-deciding questions.
- `apply_blueprint(blueprint)` — only after the human approves, batch-drafts every artifact through the Phase A draft path (`protocol.saveMetaItem({mode:'draft'})`), validated per-type and partial-tolerant (a bad item is reported, the rest still draft). Seed data is reported as proposed, not auto-applied (no runtime `dataset` type).

A new `solution_design` skill carries the plan-first instructions and is bound to `metadata_assistant` alongside `metadata_authoring`. The shared draft-write primitive is exported from the metadata tools as `stageDraft` and reused, keeping one draft-write path.
