---
"@objectstack/spec": minor
"@objectstack/service-automation": minor
---

feat(automation): object-form screen-flow steps

A `screen` node that declares `config.objectName` now renders the named object's
FULL create/edit form (including inline master-detail child grids) instead of a
flat field list. The node emits an `object-form` `ScreenSpec`
(`kind`/`objectName`/`mode`/`recordId`/`defaults`/`idVariable`); the client
renders the real ObjectForm, persists the record (and its children, atomically),
and resumes the run with the saved id bound to `idVariable` so a later step can
reference it — e.g. a lead-conversion wizard: a full Customer step, then a full
Opportunity-with-line-items step.

- **spec**: `ScreenSpec` gains `kind`/`objectName`/`mode`/`recordId`/`defaults`/`idVariable`.
- **service-automation**: the `screen` executor emits object-form specs and now
  interpolates `title`/`description`/field `defaultValue`/object-form `defaults`
  against live flow variables (the engine does not pre-interpolate node config).
