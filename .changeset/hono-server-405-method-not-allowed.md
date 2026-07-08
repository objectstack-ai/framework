---
'@objectstack/plugin-hono-server': patch
---

Return `405 Method Not Allowed` (with an accurate `Allow` header and a
descriptive body) instead of an opaque `{"error":"Not found"}` 404 when a
request hits a registered path under the wrong HTTP method.

Hono routes a method mismatch to the same `notFound` sink as a genuinely
missing path, so a `POST` to a `PUT`-only route (e.g. the metadata save
endpoint `PUT /api/v1/meta/:type/:name`) gave callers no hint that the path
exists under another verb (#2684). The server now tracks every registered
`(method, pattern)` pair and re-matches the request path in the `notFound`
handler: matching another method yields a 405; matching nothing stays a 404.
This is framework-wide — every registered endpoint benefits. Static/SPA
catch-alls registered straight on the raw Hono app are not tracked and never
produce a spurious 405.
