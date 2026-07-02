---
'@objectstack/spec': minor
'@objectstack/lint': minor
'@objectstack/cli': patch
'@objectstack/platform-objects': patch
---

ADR-0085: object presentation intent is declared as cross-surface semantic
roles, never as per-surface hint blocks.

**@objectstack/spec**

- New top-level `stageField: string | false` — names the object's linear
  lifecycle field (`false` declares the status-like field non-linear and
  suppresses every consumer's stage heuristics). Legitimizes the key the UI
  runtime already read but the schema rejected.
- `compactLayout` → **`highlightFields`** (the value is an ordered field
  list, not a layout; "highlight" is already the renderer-side term of art).
  `compactLayout` stays accepted as a parse-time alias and is preserved on
  output — the ADR-0079 `displayNameField → nameField` pattern.
- `fieldGroups[].collapse: 'none' | 'expanded' | 'collapsed'` replaces
  `defaultExpanded` AND the UI-dialect `collapsible`/`collapsed` boolean pair
  (which had drifted two ways: spec declared a key no renderer read, renderers
  read keys the spec rejected). Old keys map onto the enum at parse and remain
  accepted for one minor.
- `fieldGroups[].visibleOn` removed (no consumer anywhere — ADR-0049
  enforce-or-remove; re-add together with its enforcement when a surface
  evaluates it).
- The `detail: { … }.passthrough()` UI-hints block is **removed**. Every key
  in it was either unauthorable, a proven no-op for spec authors
  (`hideReferenceRail` — the rail is default-off and its enabling key was
  never typed), or a per-page toggle that belongs to an assigned Page. Zero
  authors existed across framework and objectui (evidence in ADR-0085); the
  removal ships as a minor under the documented dead-surface exception
  (PR #2272 precedent).
- New `deriveFieldGroupLayout(def)` in `@objectstack/spec/data` — the single
  source of the fieldGroups rendering semantics (declared order, empty groups
  dropped, ungrouped trailing bucket minus audit/system fields, collapse
  passthrough incl. deprecated aliases). UI renderers consume this instead of
  their two pre-existing near-identical local copies.

**@objectstack/lint / @objectstack/cli**

- New `validateSemanticRoles` (wired into `os lint`): warns on
  `Field.group` → undeclared group, declared-but-unreferenced groups, and
  `stageField`/`highlightFields` entries naming non-existent fields — the
  dangling-pointer shapes that are Zod-valid but silently inert at render
  time (ADR-0078 completeness gate).

**@objectstack/platform-objects**

- All 35 system objects renamed `compactLayout:` → `highlightFields:`
  (behaviour unchanged via the alias).
