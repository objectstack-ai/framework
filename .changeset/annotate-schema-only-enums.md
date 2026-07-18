---
"@objectstack/spec": patch
---

Annotate the schema-only event/subscription/connector surfaces flagged by the #3197 audit with explicit "not yet enforced / not yet implemented" notes in their doc comments and `.describe()` texts, so authoring metadata against them is no longer silently swallowed. No runtime behavior or schema shape changes — documentation only.

Surfaces annotated (each trace re-confirmed against the current tree before annotating):

- `GraphQLSubscriptionConfigSchema` (`api/graphql.zod.ts`) — no subscription transport exists; the GraphQL HTTP entry serves query/mutation only.
- `WebSocketMessageType` + module header (`api/websocket.zod.ts`) — no WebSocket server is mounted (#2462); the protocol is a future wire contract.
- `RealtimeEventType` (`api/realtime.zod.ts`) — zero runtime importers; the engine emits `data.record.*` names (which don't match this enum's members) and nothing emits `field.changed`.
- Connector `webhooks`/`WebhookConfigSchema`/`WebhookEventSchema` and `triggers`/`ConnectorTriggerSchema` (`integration/connector.zod.ts`) — `AutomationEngine.registerConnector` reads only `actions`; webhook events and trigger definitions parse but are never dispatched or polled.
- Automation `ConnectorTriggerSchema`/`TriggerRegistrySchema` (`automation/trigger-registry.zod.ts`) — no runtime importer; the `stream` trigger mechanism exists only here.
- `NotificationChannelSchema` (`system/notification.zod.ts`) + the mirrored `NotificationChannel` contract type — implemented delivery channels are `inbox`/`email`/`sms`; `push`/`slack`/`teams`/`webhook` dead-letter, and the enum's `in-app` does not match the registered `inbox` channel id.

The audit's sixth row (`SubscriptionEventType`, formerly `data/subscription.zod.ts`) needed no annotation — it was already removed outright by the feed-contract retirement (#1959).
