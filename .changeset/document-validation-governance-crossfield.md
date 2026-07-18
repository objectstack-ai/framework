---
"@objectstack/spec": patch
---

Document two validation-rule facts surfaced by the 2026-06 liveness audit (follow-up to #3106 / #3184), and clean up a stale form-schema mirror — no runtime behavior change:

- `label` / `description` / `tags` on validation rules are governance / editor metadata (surfaced to the Studio rule editor and rule listings), not evaluated on the write path. Documented as such on `BaseValidationSchema` rather than removed — they are set by nearly every example rule and feed the `/meta/types` editor form, so they are declared on purpose, not silent no-ops.
- `cross_field` evaluates identically to `script` (same CEL predicate path); only `fields[0]` is read, to target the violation at a field. Documented the overlap on the schema, its `fields` `.describe()`, and the validation docs so authors can choose between them; the variant is kept for the field-targeting affordance and backward compatibility.
- Removed dead form-field entries (`scope`, `caseSensitive`, `url`, `handler`) and the stale `type=unique` hint from the hand-written `HAND_CRAFTED_SCHEMAS['validation']` fallback in `@objectstack/metadata-protocol` — leftovers from the removed `unique`/`async`/`custom` variants.
- Added the missing `beforeDelete` lifecycle-hook pointer to the validation docs' "not a rule type" callout, so delete-time guards aren't stranded now that validation has no `delete` event (#3184).
