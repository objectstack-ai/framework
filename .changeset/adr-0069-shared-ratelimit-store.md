---
"@objectstack/plugin-auth": minor
---

feat(auth): shared cross-node rate-limit + session store via the cache service (ADR-0069 D2)

Multi-node deployments previously rate-limited **per process** — better-auth's
default `rateLimit` store is in-memory, so each node counted independently and
an attacker could rotate nodes to bypass the limit. `AuthPlugin` now wires the
kernel `cache` service as better-auth's `secondaryStorage` and flips
`rateLimit.storage` to `'secondary-storage'`, so rate-limit counters (and the
session cache) are enforced against **one shared store across every node** —
shared iff the cache service is (Redis adapter in a cluster; memory single-node,
where behavior is unchanged). When no cache service is registered the plugin
logs a warning that a multi-node deployment needs a shared cache (ADR-0069
honesty — no silent per-process limiting presented as global).

New `cacheSecondaryStorage(cache)` adapter (`ICacheService` → better-auth
`SecondaryStorage`). Note: the cache has no atomic increment, so under high
concurrency the get→set counter path can slightly over-count — acceptable for a
rate limiter and strictly better than independent per-node counters; a future
cache adapter exposing atomic INCR can add an `increment` method for exact
counting.
