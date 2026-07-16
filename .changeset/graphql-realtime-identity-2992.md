---
'@objectstack/runtime': patch
'@objectstack/spec': patch
'@objectstack/service-realtime': patch
---

fix(security): pre-wiring identity admission for the GraphQL and realtime surfaces (#2992, ADR-0096 D4)

Two latent execution surfaces — neither reachable by a client today — would
have fallen open the instant a real transport was wired, because both drop or
lack the caller's identity. Per ADR-0096, the identity story is fixed and
pinned in CI *before* wiring, not after an adversarial review:

- **GraphQL (surface 1 — latent context-drop, now threaded).**
  `handleGraphQL` passed only `{ request }` to `kernel.graphql`, dropping the
  resolved `ExecutionContext` — the moment a real engine resolved objects
  through ObjectQL it would have run context-less (security middleware falls
  OPEN on a missing principal = full authority). The entry point now resolves
  the caller identity even on the direct dispatcher-plugin route and even when
  `requireAuth` is off, and threads it as `options.context`;
  `IGraphQLService.execute` documents that implementations MUST forward it to
  every data-engine call. Unit-proven; the authz conformance matrix pins the
  threading (`graphql-identity-thread` row) so removing it goes STALE and
  fails CI.

- **realtime (surface 2 — no per-recipient authz seam, posture registered).**
  Delivery is a pure fan-out (subscriptions carry no principal,
  `matchesSubscription` filters only by object+eventTypes, the engine
  publishes the full `after` row), safe only while every subscriber is
  server-internal. The posture is now registered as an `experimental` matrix
  row (`realtime-delivery-authz`) stating the admission requirement
  (per-recipient RLS/FLS/tenant re-check on delivery, or id-only payload +
  client re-fetch), and transport TRIPWIRE probes turn any newly wired
  WebSocket/SSE/subscribe/client transport into an UNCLASSIFIED surface → red
  CI until the identity story ships with it. The `service-realtime` README —
  which advertised `authorizeChannel`/`broadcastToUser`/presence auth that do
  not exist — is rewritten to describe the real, trusted-internal-only
  surface, and the contract docs carry the admission requirement at the seam.
