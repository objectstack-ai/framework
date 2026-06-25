---
"@objectstack/rest": patch
---

fix(rest): register static data-action routes before the greedy `:object/:id` matcher

The REST router matches first-registered-wins with no specificity sorting, but
`registerDataActionEndpoints` (which holds `GET /data/:object/export`) ran AFTER
`registerCrudEndpoints` (which holds the greedy `GET /data/:object/:id`). A
request to `GET /data/<object>/export` was therefore captured by `:object/:id` —
`"export"` treated as a record id — returning `404 RECORD_NOT_FOUND` instead of
streaming the export. The data-action registration now runs first, mirroring the
existing `/meta/:type/:name/references`-before-`/meta/:type/:name` convention.
Reordering is safe both ways: `registerDataActionEndpoints` contains no greedy
2-segment `:object/:id` routes, so it cannot shadow any CRUD literal. A
regression test asserts the export route registers ahead of the get-by-id route.
