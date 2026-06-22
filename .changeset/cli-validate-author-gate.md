---
"@objectstack/cli": minor
"create-objectstack": minor
---

Make `os validate` the author-time verification gate and steer scaffolds toward it.

- **`os validate`** now runs the same CEL/predicate gate as `os build`/`os compile`
  (ADR-0032): every `visible`/`disabled`/`requiredWhen`/validation/flow/sharing
  predicate is checked for CEL syntax and `record.<field>` existence on the target
  object. It already ran the protocol schema and widget-binding checks; the
  expression gate closes the gap so a bare field ref (`done` instead of
  `record.done`) — which silently hides an action on every record at runtime
  (#2183/#2185) — fails validation instead of shipping. `os validate` is now a
  read-only superset of the build's checks (no artifact emitted).
- **`create-objectstack`** now emits an `AGENTS.md` (and `.github/copilot-instructions.md`)
  into every generated project instructing coding agents to run `npm run validate`
  after editing metadata, aligns the blank template's `dev`/`start` scripts with the
  example apps (`objectstack dev`/`objectstack start`), and sharpens the post-create
  "Next steps" output.
