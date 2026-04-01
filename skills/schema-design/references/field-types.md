# Schema Design — Field Type Reference

> Auto-derived from `packages/spec/src/data/field.zod.ts` FieldType enum.
> This file is for quick reference only. The Zod source is the single source of truth.

## FieldType Enum (48 types)

| Category | Type | Description |
|:---------|:-----|:------------|
| **Text** | `text` | Single-line text input |
| | `textarea` | Multi-line plain text |
| | `email` | Email with validation |
| | `url` | URL with validation |
| | `phone` | Phone number |
| | `password` | Masked/hashed input |
| **Rich Content** | `markdown` | Markdown editor |
| | `html` | HTML editor |
| | `richtext` | WYSIWYG editor |
| **Numbers** | `number` | Numeric value |
| | `currency` | Monetary amount |
| | `percent` | Percentage value |
| **Date/Time** | `date` | Date only |
| | `datetime` | Date + time |
| | `time` | Time only |
| **Logic** | `boolean` | Checkbox |
| | `toggle` | Toggle switch |
| **Selection** | `select` | Single-choice dropdown |
| | `multiselect` | Multi-choice tags |
| | `radio` | Radio button group |
| | `checkboxes` | Checkbox group |
| **Relational** | `lookup` | Reference to another object |
| | `master_detail` | Parent–child lifecycle |
| | `tree` | Hierarchical reference |
| **Media** | `image` | Image upload |
| | `file` | File attachment |
| | `avatar` | Avatar image |
| | `video` | Video embed |
| | `audio` | Audio embed |
| **Calculated** | `formula` | Computed expression |
| | `summary` | Roll-up aggregation |
| | `autonumber` | Auto-increment |
| **Enhanced** | `location` | GPS coordinates |
| | `address` | Structured address |
| | `code` | Code editor |
| | `json` | JSON data |
| | `color` | Color picker |
| | `rating` | Star rating |
| | `slider` | Numeric slider |
| | `signature` | Digital signature |
| | `qrcode` | QR/Barcode |
| | `progress` | Progress bar |
| | `tags` | Tag list |
| | `vector` | AI/ML embeddings |

## Validation Rule Types

| Type | Purpose |
|:-----|:--------|
| `script` | Formula expression (true = invalid) |
| `unique` | Composite uniqueness |
| `state_machine` | Legal state transitions |
| `format` | Regex or built-in format |
| `cross_field` | Compare multiple fields |
| `json_schema` | Validate JSON against schema |
| `async` | External API validation |
| `custom` | Registered validator function |
| `conditional` | Apply rule when condition met |

## Index Types

| Type | Use Case |
|:-----|:---------|
| `btree` | Default — equality and range |
| `hash` | Exact equality only |
| `fulltext` | Text search |
| `gin` | Array / JSONB containment |
| `gist` | Geospatial / range |
