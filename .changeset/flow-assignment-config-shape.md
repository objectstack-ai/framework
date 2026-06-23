---
"@objectstack/service-automation": patch
---

fix(automation): honor the `assignments` wrapper shape on assignment nodes

The built-in `assignment` node executor set each TOP-LEVEL `config` key as a flow
variable. But the surfaces that author these nodes all emit an `assignments`
wrapper instead:

- Studio's visual Assignment editor → `config: { assignments: { <var>: <value> } }`
- bundled example flows (app-crm, showcase) → `config: { assignments: [{ variable, value }] }`

So a node designed in Studio (or any of the shipped examples) silently set a
single variable literally named `assignments` to the whole map/array and never
set the intended variables — it passed build and no-oped at run time, leaving
every downstream reference unresolved.

The executor now normalizes all three shapes (`assignments` map, `assignments`
array of `{ variable | name | key, value }`, and the legacy flat
`{ <var>: <value> }`) and interpolates `{var}` templates in the values, matching
the CRUD / screen nodes. Adds `logic-nodes.test.ts` covering each shape as a
regression guard.
