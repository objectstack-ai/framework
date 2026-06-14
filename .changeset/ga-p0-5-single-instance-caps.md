---
"@objectstack/service-feed": minor
"@objectstack/service-realtime": minor
---

feat(P0-5): default-on memory caps for in-memory feed/realtime (single-instance GA)

Launch-readiness P0-5 is resolved by formally scoping v1 to **single-instance**
(non-HA) and shipping memory backstops so the process-local adapters can't grow
until OOM:

- `InMemoryFeedAdapter` now defaults `maxItems` to `DEFAULT_MAX_FEED_ITEMS`
  (100k) instead of unbounded. `createFeedItem` throws loudly at the cap
  (fail-loud beats a silent OOM kill).
- `InMemoryRealtimeAdapter` now defaults `maxSubscriptions` to
  `DEFAULT_MAX_SUBSCRIPTIONS` (50k).
- Passing `0` is an explicit unbounded opt-out (tests / short-lived processes).
- Both plugin JSDocs now state the non-HA contract; HA (a Redis-backed realtime
  adapter over the existing `RedisPubSub`, and a DB-backed feed adapter) is a
  documented post-GA fast-follow.

**Behaviour change:** a deployment that previously relied on unbounded in-memory
feed/realtime will now hit the cap and receive an error past the ceiling — set
`maxItems: 0` / `maxSubscriptions: 0` to restore the old behaviour, or raise the
number.
