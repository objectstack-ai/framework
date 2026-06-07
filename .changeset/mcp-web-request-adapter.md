---
'@objectstack/runtime': patch
---

fix(runtime): adapt node/Hono req → Web Request for the MCP transport (ADR-0036)

The MCP Streamable HTTP transport needs a Web-standard `Request`, but the
runtime HTTP adapter hands the dispatcher a node/Hono-style req (plain `headers`
object, path-only `url`). `handleMcp` rejected it with 400 ("MCP transport
requires a standard HTTP request") — so the live endpoint was unusable even
once routed + registered. Unit tests passed a real `Request`, hiding it; caught
in staging e2e on `initialize`.

`handleMcp` now reconstructs a Web `Request` (method, absolute URL from
host+path, normalised headers, JSON body from the parsed body) when the inbound
req isn't already Web-standard. Regression tests cover a POST and a GET
node-style req.
