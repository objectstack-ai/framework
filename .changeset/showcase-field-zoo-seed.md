---
---

chore(showcase): seed the Field Zoo with two specimens exercising every input-able field type (arrays/objects/time/relational/computed all populated), and guard the `warn_over_budget` hook condition with `has()` so a partial rollup update no longer logs a "No such key" warning. The seed doubles as a runtime regression guard for the field-type persistence fixes — a field type that can't store now fails the boot seed instead of shipping silently. Example-app only; no package impact.
