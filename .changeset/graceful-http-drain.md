---
'@objectstack/plugin-hono-server': patch
---

fix(hono-server): drain in-flight requests on shutdown instead of force-closing (P1-3)

`HonoHttpServer.close()` called `closeAllConnections()`, which terminated active
connections mid-response — so a SIGTERM during a rolling deploy dropped in-flight
requests. It now drains gracefully: `server.close()` stops accepting new
connections and lets active requests finish, `closeIdleConnections()` releases
idle keep-alive sockets so the process exits promptly, and a bounded drain window
(default 10s, configurable, well under the kernel's 60s `shutdownTimeout`)
force-closes only the stragglers so shutdown can't hang.

Note: the kernel already handles SIGINT/SIGTERM/SIGQUIT with an ordered,
timeout-bounded shutdown — this fixes the one place that wasn't draining.
