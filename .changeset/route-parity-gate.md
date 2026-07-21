---
---

Add a route-parity e2e gate (`declared === enforced` for HTTP routes, #3369). It boots the real hono app the way `os serve` mounts it (hono server + dispatcher plugin, services provisioned), reads `/api/v1/discovery`, and asserts every advertised / dispatcher-registered route is reachable — never 404/405/501 — for an anonymous AND an admin principal, and that discovery is service-aware in both directions (no dead advertisement). Also documents (comment-only) why the dispatcher advertises `routes.mcp` on the `isMcpServerEnabled()` flag rather than gating on service presence (the #2698 auto-load lockstep). Test + comment only; no runtime code changes, so this releases nothing.
