# ADR-0014 — `record` Form Field Type

- **Status:** Accepted
- **Date:** 2026-04-17
- **Supersedes:** —
- **Related:** ADR-0005 (Metadata Customization Overlay), Prime Directive #1 (Zod First)

## Context

`Object.fields` is canonically a `Record<string, FieldDef>` (Zod
`z.record(z.string(), FieldSchema)` — see
`packages/spec/src/data/object.zod.ts`). Insertion order is display order,
the key is the field's machine name, and each value is a `FieldDef` whose
internal `name` mirrors the key.

The Studio metadata editor, however, treated `fields` as an **array** all
the way down:

1. Hand-crafted JSON Schema in `packages/objectql/src/protocol.ts`
   declared `{ type: 'array', items: { … } }`.
2. The form spec in `packages/spec/src/data/object.form.ts` declared
   `{ type: 'repeater', widget: 'grid' }`.
3. The `RepeaterField` engine in `SchemaForm.tsx` did
   `Array.isArray(value) ? value : []` — which always evaluated to `[]`
   because the real data is a Record.

Result: the Form tab's Fields panel rendered "No items" on every object,
even though the data was present and rendered correctly in the preview
pane that consumed the same Record directly.

Symmetric audits found this was the **only** Record-vs-array mismatch in
the metadata form layer today, but the structural gap (no first-class
form-field type for `Record<string, X>`) would re-emerge as soon as any
other Record-shaped property became editable (Permission overlays,
Translation bundles, etc.).

## Decision

Introduce **`record`** as a first-class data-field type in the canonical
Zod `FieldType` enum (`packages/spec/src/data/field.zod.ts`).

Because `FormFieldSchema.type` reuses the data `FieldType` enum, this
simultaneously gives form authors a structural type for editing name-keyed
maps. `'record'` joins `'composite'` (object) and `'repeater'` (array) as
the third structural form-field type.

### Form spec shape

```ts
{
  field: 'fields',
  type: 'record',
  widget: 'airtable',                // optional widget renderer
  keyField: {                        // configures the key column
    field: 'name',                   // mirror-into property on each value
    label: 'Name',
    placeholder: 'snake_case_identifier',
    regex: '^[a-z_][a-z0-9_]*$',     // serialised regex source
    immutable: true,                 // key is read-only after creation
  },
  fields: [                          // sub-fields shown per entry (key column excluded)
    { field: 'label', type: 'text' },
    { field: 'type', type: 'select', required: true },
    { field: 'required', type: 'boolean' },
  ],
}
```

### JSON Schema mapping

```jsonc
{
  "type": "object",
  "additionalProperties": {
    "type": "object",
    "properties": { /* item shape */ },
    "required": ["type"]
  }
}
```

This is what `z.toJSONSchema(z.record(z.string(), V))` already produces;
hand-crafted overrides in `protocol.ts` must match.

### Runtime semantics

- Insertion order is display order.
- The key MUST equal the `keyField.field` property on each value (default
  `'name'`). The renderer enforces this on edit and on add.
- Renaming a key rewrites the map with the new key in the same position.
- Removing a key removes the entry.

### Widget dispatch (Studio)

`SchemaForm.tsx` adds a `RecordField` engine alongside `CompositeField`
and `RepeaterField`. Dispatch order for `type: 'record'`:

1. If `widget` is set and `WIDGETS[widget]` is registered, delegate to
   that widget — it receives the raw `Record<string, item>` value and
   owns the entire UI (used by the Airtable-style fields editor).
2. Otherwise, render an inline card list with a dedicated key column +
   per-row sub-fields.

The Airtable-style table is registered under `widget: 'airtable'` and
currently powers Object.fields editing. The renderer is intentionally
reusable: as more Record-shaped properties become editable, they can opt
into the same widget without changes to the dispatcher.

## Alternatives Considered

**B. Add `keyField` to existing `repeater` (REJECTED).** The form-spec
type would still claim "array", silently coercing under the hood. This
hides the canonical shape from every downstream consumer (auto-generated
docs, NL→form helpers, AI tooling) and reintroduces the same protocol
lie we are removing.

**C. Custom widget hack only (REJECTED).** A `widget: 'object-fields-table'`
renderer that quietly accepts a Record while the form spec still claims
`repeater` would patch the visible symptom but not the protocol lie.
Violates Prime Directive #1 (Zod First).

## Consequences

### Positive

- `Object.fields` editing finally matches the canonical data shape.
- Future Record-shaped metadata (Permission.objects/fields,
  Translation.strings, View.listViews/formViews, etc.) has a sanctioned
  path to ship as a form field instead of falling back to raw JSON.
- The hand-crafted JSON Schema in `protocol.ts` no longer lies, which
  removes a class of bug for any consumer (OpenAPI export, AJV
  validation in client SDK, AI agent tools) that reads it directly.

### Negative

- Existing draft data persisted as an array (from before the fix) must
  be migrated to a Record. The widget tolerates both shapes on read,
  emits a Record on write, so the first edit in Studio migrates each
  draft.
- Form authors must now distinguish `repeater` (array) from `record`
  (map) — documented in the field-type reference.

## Migration

- **Spec:** add `'record'` to the FieldType enum, extend `FormFieldSchema`
  with optional `keyField` configuration.
- **`protocol.ts`:** rewrite the hand-crafted `object.properties.fields`
  to `{ type: 'object', additionalProperties: {…} }`.
- **`object.form.ts`:** change the `fields` section from
  `type: 'repeater', widget: 'grid'` to
  `type: 'record', widget: 'airtable', keyField: {…}`.
- **Studio (`SchemaForm.tsx`):** add the `RecordField` engine, infer
  `'record'` from `type === 'record'`, register `'airtable'` widget alias.
- **Drafts:** widget tolerates pre-existing array values on read.

## Open Questions

- When Translation bundles ship a metadata editor, should the per-locale
  string map use this widget (with `widget: 'inline'`) or a richer
  matrix editor? Likely the latter — but the structural type stays the
  same.
