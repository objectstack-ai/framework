---
'@objectstack/service-messaging': minor
'@objectstack/runtime': minor
---

Implement the `/api/v1/notifications` REST surface (ADR-0030)

The notification REST routes (`GET /notifications`, `POST /notifications/read`,
`POST /notifications/read/all`) were declared in the spec but never had a
server-side handler — no plugin registered the `notification` core service, so
the routes were never advertised in discovery and `client.notifications.*`
calls 404'd. (The Console bell works today only because it bypasses these
endpoints and reads the inbox via the generic data API.)

This wires the surface end-to-end against the ADR-0030 L5 model:

- **`MessagingService`** gains an inbox read API: `listInbox(userId, opts)`
  reads `sys_inbox_message` joined with `sys_notification_receipt` for
  read-state (a message is unread until its event has a `read`/`clicked`/
  `dismissed` receipt); `markRead(userId, ids)` and `markAllRead(userId)`
  upsert the receipt to `read`, keyed `(notification_id, user_id,
  channel:'inbox')` — updating the existing `delivered` receipt in place,
  inserting only when absent. No reliance on the re-modeled `sys_notification`
  L2 event (which carries no recipient/read columns).
- **`MessagingServicePlugin`** now also registers the messaging service under
  the `notification` core service slot, so the dispatcher resolves + advertises
  the routes. The legacy `INotificationService.send()` abstraction is unused and
  unconsumed.
- **`HttpDispatcher`** gains `handleNotification` + a `/notifications` dispatch
  branch: it takes the authenticated user from the execution context and maps
  list / mark-read / mark-all-read to the service. Responses match the spec
  schemas (`{ notifications, unreadCount }`, `{ success, readCount }`).

Pairs with the objectui SDK consumer repoint (`useClientNotifications` →
`markRead`/`registerDevice` signatures). Device registration and preference
endpoints remain out of scope (unimplemented as before).
