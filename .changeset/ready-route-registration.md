---
"@objectstack/runtime": patch
---

fix(runtime): mount `GET /ready` so the readiness probe is reachable over HTTP

The dispatcher's `/ready` branch (seam #2) was only reachable when calling
`dispatch()` directly — no `server.get('${prefix}/ready')` registration existed,
so a real server returned the Hono not-found 404 before the handler ran (the same
class of bug as `/mcp` and `/keys`). `/ready` is now mounted alongside `/health`,
returning 200 while the kernel is `running` and 503 while it is booting or
draining — the contract the EE multi-node rolling-restart drain gate polls
(cloud ADR-0018). Adds a registration assertion plus an integration test that
hits the endpoint through a real HTTP server.
