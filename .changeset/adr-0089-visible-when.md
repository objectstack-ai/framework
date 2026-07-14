---
"@objectstack/spec": minor
---

ADR-0089: unify the conditional-visibility predicate under one canonical key, `visibleWhen`, across every layer (data field, view form section/field, page component). This aligns visibility with the existing `readonlyWhen` / `requiredWhen` family and the `conditionalRequired → requiredWhen` precedent.

**Canonical key:** `visibleWhen` — a CEL predicate; the element is shown only when it is TRUE. The binding *root* is still set by the layer: runtime record forms and pages bind `record` + `current_user` (pages also expose `page.<var>`); metadata-editing forms (`*.form.ts`) bind `data`.

**Deprecated aliases (still accepted):** the view key `visibleOn` and the page key `visibility` are now `@deprecated`. Both are folded into `visibleWhen` **once, at the schema boundary** (a zod `.transform()`), so consumers only ever read `visibleWhen`. When both a canonical and an alias key are present, the canonical wins.

Migration (L1 — no consumer action required; existing metadata keeps working):

- View form section/field: `visibleOn: "<cel>"` → `visibleWhen: "<cel>"`
- Page component: `visibility: "<cel>"` → `visibleWhen: "<cel>"`
- Data field / field option: already `visibleWhen` — unchanged.

Out of scope (unchanged): the boolean `visible` (Tab on/off), field `hidden`, gallery `visibleFields`, and unrelated `visibility` *enums* (feed / package / environment / agent). Aliases remain for the standard deprecation window and are removed in a future major.
