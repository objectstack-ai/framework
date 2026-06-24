---
'@objectstack/spec': minor
---

Add authoritative create seeds for agent / tool / skill / email_template / permission

Extends the spec-derived create-shape contract to the AI and integration metadata types. Each now has an authoritative minimal create seed (validated against its schema), so the Studio designer / CLI / API derive their create defaults from the spec via `/meta/types` — closing the "designer emits a minimal shape the spec rejects → create→save 422" gap for these types too (agent needs `role`+`instructions`, tool needs `description`+`parameters`, skill needs `tools`, email_template needs `subject`+`bodyHtml`, permission needs `objects`). `trigger` has no spec schema and is intentionally not seeded.
