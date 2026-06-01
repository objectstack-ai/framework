---
"@objectstack/spec": patch
---

Fix the docs generator (`build-docs.ts`) leaking an unmatched `<` / `{` into generated MDX, which broke the `apps/docs` Turbopack build (e.g. a SemVer range `">=4.0 <5"` in a `.describe()` string was read as the start of a JSX tag). Unmatched openers are now emitted as HTML entities (`&lt;` / `&#123;`); union-variant descriptions also go through the escaper.
