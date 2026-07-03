---
"@objectstack/platform-objects": patch
---

feat(setup): Packages entry in Setup's Apps group

Package administration (install / inspect / manage) is an operator concern
(ADR-0084: packages are Operate, out of the builder), so it gains a home in the
Setup app: `group_apps` now carries a **Packages** entry bound to the console's
existing `developer:packages` page. Building apps remains a separate journey
(the Home builder cover → `/studio`); this entry is for administration.
