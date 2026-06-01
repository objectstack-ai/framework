---
"@objectstack/service-messaging": minor
"@objectstack/service-automation": minor
"@objectstack/spec": minor
---

ADR-0018 M3: unified `http` / `notify` executors backed by a generic HTTP outbox.

Promotes a reliable outbound-HTTP delivery outbox into `service-messaging` (the
raw-callout counterpart to the notification outbox) and routes the Flow `http`
node through it — closing the "`http_request` is a bare `fetch()` with no retry"
gap. The five divergent outbound verbs collapse onto canonical `http` / `notify`.

**`@objectstack/service-messaging` (additive):**

- `IHttpOutbox` / `HttpDelivery` generic raw-callout shape
  (`source` / `refId` / `dedupKey` / `label` / `signingSecret`), `SqlHttpOutbox`
  over a new `sys_http_delivery` object, `MemoryHttpOutbox`, `HttpDispatcher`
  (per-partition cluster lock, claim/ack/retry/dead-letter), and a shared
  `sendOnce` + 7-step jittered retry schedule.
- `MessagingService` gains `setHttpOutbox()` / `isHttpDeliveryReady()` /
  `enqueueHttp()`; the plugin wires the outbox + dispatcher at `kernel:ready`.

**`@objectstack/service-automation`:**

- Canonical `http` executor — `durable: true` enqueues onto the messaging HTTP
  outbox (retry/dead-letter); otherwise an inline `fetch()` preserving
  `http_request`'s request/response semantics.
- `engine.registerNodeAlias()` — registers a delegating executor + a
  `deprecated` / `aliasOf` descriptor. `http_request` / `http_call` / `webhook`
  are now deprecated aliases of `http`; existing flows keep running.
- `notify` descriptor marked `needsOutbox` (its delivery is outbox-backed).

**`@objectstack/spec`:** `flow.zod` adds `http` to the builtin node-type seed set.

`plugin-webhooks` cut-over to the shared outbox is a deliberate follow-up.
