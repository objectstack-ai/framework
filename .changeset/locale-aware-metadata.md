---
"@objectstack/client": minor
"@objectstack/client-react": minor
"@objectstack/objectql": patch
"@objectstack/rest": patch
"@objectstack/spec": patch
---

Make metadata labels follow the active UI language without a page refresh (#1319).

The client now carries the active locale on every request (`Accept-Language`,
`setLocale`/`getLocale`), the protocol ETag is locale-aware so cached metadata
no longer collides across languages, and the `client-react` metadata hooks
refetch when the locale changes. The `apps/account` console wires its router
locale through so a language switch relabels server-resolved object/field/view
labels in place instead of leaving the UI half-translated until reload.
