---
"@objectstack/objectql": patch
---

Enforce array shape for multi-value fields in the write pipeline (#2552). Lone scalars sent at a `multiselect` / `checkboxes` / `tags` field — or at a `select` / `radio` / `lookup` / `user` / `file` / `image` field flagged `multiple: true` — are now normalized into single-element arrays before validation instead of being stored verbatim (which silently corrupted the column shape), un-wrappable shapes are rejected with a new `invalid_type` validation code, and a legal array at a `select`+`multiple` field is no longer mis-rejected as `invalid_option`.
