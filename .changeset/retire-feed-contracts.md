---
"@objectstack/spec": minor
"@objectstack/metadata-protocol": minor
"@objectstack/client": minor
"@objectstack/objectql": patch
---

**Breaking (npm type surface): retire the vestigial feed contracts + protocol surface (ADR-0052 §5 follow-up, #1959).**

The `service-feed` runtime was deleted in #1955; `sys_comment` / `sys_activity`
are the canonical record-collaboration/timeline backend. This removes the dead
type surface that still pointed at the deleted runtime — every removed method was
already unreachable (the feed REST route was never mounted → 404; the protocol
implementation was never wired with a feed service, so `requireFeedService()`
could only throw). No behavior changes.

No authorable metadata key is removed (the `feeds:` object capability flag and
the `RecordActivity` UI component config are unchanged), so `PROTOCOL_MAJOR`
stays 15 and this ships as `minor` rather than a protocol major.

FROM → TO migration for every removed export:

- `@objectstack/spec/contracts` — `IFeedService`, `CreateFeedItemInput`,
  `UpdateFeedItemInput`, `ListFeedOptions`, `FeedListResult` → **removed, no
  replacement**. Comments/activity are plain records: write `sys_comment` / read
  `sys_activity` via the data engine or the REST data API.
- `@objectstack/spec/api` — `FeedApiContracts`, `FeedApiErrorCode`,
  `FeedProtocol`, and all feed request/response schemas + types (`GetFeed*`,
  `CreateFeedItem*`, `UpdateFeedItem*`, `DeleteFeedItem*`, `AddReaction*`,
  `RemoveReaction*`, `PinFeedItem*`, `UnpinFeedItem*`, `StarFeedItem*`,
  `UnstarFeedItem*`, `SearchFeed*`, `GetChangelog*`, `ChangelogEntry`,
  `SubscribeRequest/Response`, `FeedUnsubscribeRequest`, `UnsubscribeResponse`,
  `FeedPathParams`, `FeedItemPathParams`, `FeedListFilterType`) → **removed**. Use
  the data API against `sys_comment` / `sys_activity` (`/api/v1/data/sys_comment/…`);
  reactions and threaded replies are fields on `sys_comment`.
- `@objectstack/spec/data` — `FeedItemSchema`/`FeedItem`, `FeedActorSchema`/`FeedActor`,
  `MentionSchema`/`Mention`, `ReactionSchema`/`Reaction`,
  `FieldChangeEntrySchema`/`FieldChangeEntry`, `FeedVisibility`,
  `RecordSubscriptionSchema`/`RecordSubscription`, `SubscriptionEventType`, and the
  `data`-namespace `NotificationChannel` → **removed**. `FeedItemType` and
  `FeedFilterMode` are **kept** (live UI activity-timeline config). For notification
  channels use `NotificationChannelSchema` from `@objectstack/spec/system`.
- `@objectstack/client` — `client.feed.*` (`list` / `create` / `update` / `delete` /
  `addReaction` / `removeReaction` / `pin` / `unpin` / `star` / `unstar` / `search` /
  `getChangelog` / `subscribe` / `unsubscribe`) and the re-exported feed response
  types → **removed**. One-line fix: use `client.data.*` on `sys_comment` /
  `sys_activity`, e.g. `client.data.create('sys_comment', { object, record_id, body })`
  and `client.data.find('sys_activity', { filters: [['record_id', '=', id]] })`.
- `@objectstack/metadata-protocol` — `ObjectStackProtocolImplementation` no longer
  implements the 14 feed methods; its constructor
  `(engine, getServicesRegistry?, getFeedService?, environmentId?)` becomes
  `(engine, getServicesRegistry?, environmentId?)`. One-line fix: delete the third
  argument.
