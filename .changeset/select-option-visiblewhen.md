---
'@objectstack/spec': minor
---

Add `SelectOption.visibleWhen` — a per-option CEL visibility predicate for
`select`/`multiselect`/`radio` fields. The option is offered only when the
predicate is TRUE, evaluated against the live record + `current_user` (same
binding environment as a field-level `visibleWhen`). This expresses cascading /
dependent options (`record.country == 'cn'`) and role/context gating
(`'admin' in current_user.roles`) without a bespoke dependent-picklist matrix.

`Field.dependsOn`'s description is generalized to be mechanism-neutral: it
declares the sibling field(s) a field's available values depend on (gating +
re-evaluation), for both lookups (candidate query scoping) and selects
(per-option `visibleWhen` gating). The `{field,param}` form remains lookup-only.

Serializable and shared by `Field.options` and view `FormField.options`.
Client-side hiding is UX only — authorization-gated option values must also be
rejected server-side by the rule-validator.
