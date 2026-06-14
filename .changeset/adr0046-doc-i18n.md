---
"@objectstack/spec": minor
"@objectstack/cli": minor
"@objectstack/rest": minor
"@objectstack/setup": minor
"@objectstack/studio": minor
---

feat(ADR-0046): per-locale documentation content (doc i18n)

Docs can now ship localized bodies. Authors add sibling locale-variant files
`src/docs/<name>.<locale>.md` (e.g. `crm_lead_guide.zh.md`, `..pt-BR.md`) next
to the base `<name>.md`; the base stays the default and the fallback. Flatness is
preserved — variants are flat siblings, not subdirectories.

- **spec**: `DocSchema` gains an optional `translations` map
  (`locale → {label?, description?, content}`) plus `resolveDocLocale(doc, locale)`,
  which collapses a doc to the best-matching locale (exact → primary subtag
  `zh-CN`→`zh` → base) with per-field fallback and strips the `translations` map.
- **cli (collect-docs)**: variant files are folded into the base doc's
  `translations`; orphan/duplicate variants and the v1 MDX/image bans are linted
  on variant content too.
- **rest**: `/meta/doc` (list + single) resolves the request locale from the
  existing `Accept-Language` / `?locale` negotiation, returns one localized body,
  and never ships the `translations` map. Doc detail bypasses the response cache
  so a language switch can't return a stale-locale body.
- **setup / studio**: the built-in overview docs now ship `zh` translations
  (TS-first inline `translations`), so a Chinese console renders Chinese docs.

The console already sends the active UI language as `Accept-Language`, so doc
content localizes on a language switch with no client change.
