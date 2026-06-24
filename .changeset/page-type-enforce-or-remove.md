---
"@objectstack/spec": minor
---

fix(spec): remove unrendered roadmap page types from PageTypeSchema (enforce-or-remove)

`PageTypeSchema` advertised six page types that never shipped a renderer —
`dashboard`, `form`, `record_detail`, `record_review`, `overview`, `blank`.
Authoring one passed schema validation but broke at runtime ("Unknown component
type"), a false affordance that's especially dangerous when templates are
AI-authored. Per ADR-0049 (enforce-or-remove), the enum is now the *live* set
(`record`, `home`, `app`, `utility`, `list`) — authoring a removed type now
fails fast at parse instead of silently at render. The removed types are tracked
in the new `PAGE_TYPE_ROADMAP` export and re-enter the enum only when a renderer
ships. A `page-type-liveness` gate test asserts the enum never re-grows a
roadmap type.

The `recordReview`/`blankLayout` config schemas and fields are retained but
`@deprecated` (their page types are no longer authorizable) to avoid breaking
downstream imports; they will be removed in a coordinated follow-up. The
`variables` page field is documented `@experimental` — its state container is
wired but no consumer reads/writes it end-to-end yet.
