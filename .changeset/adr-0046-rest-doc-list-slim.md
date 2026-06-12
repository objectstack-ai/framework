---
"@objectstack/rest": patch
---

ADR-0046: `GET /meta/doc` list responses omit `content` by default (`?include=content` opts back in; `GET /meta/doc/:name` always returns the full body). The runtime dispatcher's `/metadata/doc` route already slims docs (#1789) — this applies the same rule on the REST `/meta/:type` route the console actually reads, keeping unbounded manuals off the list surface.
