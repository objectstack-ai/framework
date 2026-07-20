---
"@objectstack/service-automation": patch
---

feat(automation): publish configSchemas for the keyValue-capable nodes (flow designer parity, #3304)

The `assignment`, `create_record` / `update_record` / `delete_record` /
`get_record`, and `screen` nodes shipped no `configSchema`, so the flow designer
had no server-driven form for them. Each descriptor now carries one that mirrors
the objectui hardcoded field group field-for-field: object references as `xRef`,
the screen repeater's `visibleWhen` as `xExpression: 'expression'`, and the
free-form maps (`fields` / `filter` / `assignments` / `defaults`) as JSON-Schema
open objects (`additionalProperties: true`, no fixed `properties`) — the shape
the designer's schema adapter renders with its flat keyValue editor. Values stay
fully permissive because real metadata carries operator objects (`{"$ne": null}`),
`{var}` templates, and non-string literals.

Deliberately still schemaless (no online/offline divergence exists for a node
with no configSchema, and a partial schema would drop editors): `decision`
(virtual Target column derived from edges), `wait` (top-level `waitEventConfig`),
`script` (actionType-conditional form), `subflow` (top-level `timeoutMs`).

Additive and backward-compatible: descriptor metadata only, no runtime behavior
change. Requires an objectui with the keyValue schema mapping (objectui #2708)
for the maps to render as structured editors; older designers keep their
hardcoded forms.
