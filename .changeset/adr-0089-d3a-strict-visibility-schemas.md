---
"@objectstack/spec": major
---

ADR-0089 D3a: flip `.strict()` on the view form + page component schemas so a mis-layered or stale conditional-visibility key is a **loud parse error** instead of a silent strip.

`FormFieldSchema`, `FormSectionSchema` (`view.zod.ts`) and `PageComponentSchema` (`page.zod.ts`) now reject unknown keys. Previously zod's default strip mode discarded any key these schemas did not declare — including a `visibleWhen` typo, a page-only `visibility` pasted onto a view field (or vice-versa), or a key surviving past its deprecation window — with no diagnostic, shipping inert metadata (ADR-0049 enforce-or-remove, ADR-0078 no-silently-inert).

- **Breaking:** metadata carrying a key not declared by these three schemas now fails validation at parse. A monorepo + examples sweep found a single offender (a test fixture using `id`/`title` on a form section instead of the canonical `name`/`label`); all first-party apps and platform metadata parse clean.
- The deprecated `visibleOn` (view form) / `visibility` (page component) aliases are **declared** keys, so they keep parsing and normalizing to `visibleWhen` — unchanged.
- Rejection messages name the offending key(s) and, when a key looks like the visibility predicate, point the author at the canonical `visibleWhen` (new `strictVisibilityError` zod error map, exported from `shared/visibility`).
