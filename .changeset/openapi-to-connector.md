---
"@objectstack/connector-openapi": minor
---

Add `@objectstack/connector-openapi` — generate an ObjectStack connector from a declarative OpenAPI 3.x document (ADR-0023). One operation becomes one connector action; a single generic handler drives a self-contained static-auth HTTP transport (mirroring `@objectstack/connector-rest`). The generated `type: 'api'` connector registers via `engine.registerConnector(def, handlers)` with no new engine surface, and supports an `include` allowlist for trimming large specs.
