---
'@objectstack/observability': minor
'@objectstack/plugin-hono-server': minor
---

Observability: per-request performance timing surfaced via the `Server-Timing` response header ("perf-tuning mode").

`@objectstack/observability` gains a tiny, dependency-free `PerfTiming` collector plus an `AsyncLocalStorage`-backed ambient API (`runWithPerfTiming` / `currentPerfTiming` and the no-op-when-disabled free functions `measureServerTiming` / `startServerTiming` / `recordServerTiming`) and a spec-compliant `formatServerTiming` serializer that sanitizes names to tokens and quotes/escapes descriptions (no header injection).

The Hono server plugin can now emit `Server-Timing` per request. It is **off by default** — the header discloses internal phase durations, which is a backend-fingerprinting surface — and opt-in via `new HonoServerPlugin({ serverTiming: true })` or `OS_SERVER_TIMING=true` (so it works through the default `os serve`). When enabled, every response carries `total` (measured by an outer middleware that brackets the whole request) plus the adapter-contributed `parse` and `handler` sub-phases; any code on the request's async call chain can add its own phases via the ambient API. When disabled, the timing call sites are zero-overhead no-ops.
