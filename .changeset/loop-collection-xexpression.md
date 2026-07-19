---
"@objectstack/spec": patch
"@objectstack/service-automation": patch
---

feat(automation): mark the loop `collection` config field as an interpolate() template so designer forms render it correctly (#3304)

The flow designer generates a node's config form from its published
`configSchema` (ADR-0018). A string property can now carry an `xExpression:
'expression' | 'template'` marker — riding the same Zod `.meta()` → JSON-Schema
channel as `xRef` / `xEnumDeprecated` — that declares whether the string is bare
CEL or an `interpolate()` single-brace `{var}` template.

The `loop` node's `collection` (e.g. `{tasks}`) is a template, so it is now
marked `xExpression: 'template'` on both the canonical `LoopConfigSchema` and the
shipped descriptor's `configSchema` literal (service-automation loop-node).
Without the marker the designer rendered `collection` as plain text online while
the offline hardcoded form rendered it as a mono expression editor, and the CEL
brace-trap false-flagged `{tasks}` as a malformed condition. The marker closes
that divergence — objectui #2670 Phase 3 (#2699) already consumes it.

Additive and backward-compatible: an unknown `xExpression` value is ignored by
the designer, and runtime behavior is unchanged. Filling the same marker in on
the remaining node types (map/decision/script and the node types that publish no
`configSchema` yet) is tracked as follow-up in #3304.
