---
'@objectstack/rest': patch
'@objectstack/service-cluster-redis': patch
---

perf(rest): cache hostname→environment resolution; document cluster pub/sub durability (P1-4, P1-5)

- **rest (P1-4):** `resolveByHostname()` ran on every unscoped request — a
  control-plane lookup (typically a DB query) in the hot path. `RestServer` now
  caches `hostname → environmentId` in-memory with a 30s TTL across all three
  resolution sites, caching negative results too so unknown hosts don't hammer the
  registry. Registry errors are not cached, so a transient blip self-heals.
- **service-cluster-redis (P1-5):** recorded the durability contract for
  `metadata.changed` in `pubsub.ts`. Redis pub/sub is at-most-once **by design**;
  the event is a cache-invalidation hint only — the durable source of truth is the
  transactional `sys_metadata` (+ `sys_metadata_history`) write, so a missed event
  causes a stale cache until the next reload, never data loss. No code change to
  the delivery semantics; risk accepted and documented.
