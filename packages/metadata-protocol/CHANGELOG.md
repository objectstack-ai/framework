# @objectstack/metadata-protocol

## 16.1.0

### Patch Changes

- Updated dependencies [9e45b63]
- Updated dependencies [b20201f]
  - @objectstack/spec@16.1.0
  - @objectstack/core@16.1.0
  - @objectstack/formula@16.1.0
  - @objectstack/metadata-core@16.1.0
  - @objectstack/types@16.1.0

## 16.0.0

### Minor Changes

- bfa3c3f: **Broadcast a `transactionalBatch` capability bit in discovery so clients negotiate the atomic cross-object batch declaratively, instead of runtime-probing 404/405/501 (#3298).**

  The atomic cross-object batch endpoint (`POST {basePath}/batch`, #1604 / ADR-0034 item 4) and its typed SDK surface (`client.data.batchTransaction`, #3271) already shipped, but discovery never told a client whether a backend actually supports it. Consumers (notably ObjectUI's `ObjectStackAdapter`) had to _probe_: fire a `/batch`, read `404`/`405` (no route) or `501` (no runtime transaction), and only then fall back to non-atomic client-side simulation. That is "find out by calling", not capability negotiation — it cannot be decided at connect time and cannot serve as the "minimum backend supports `/batch`" gate that blocks hard-deleting the non-atomic fallback downstream.

  `WellKnownCapabilitiesSchema` gains a required `transactionalBatch: boolean`, and **every** discovery producer fills it honestly (`declared === enforced`), so it never becomes a declared-but-unpopulated bit:

  - **`@objectstack/metadata-protocol`** (`getDiscovery`) — reports whether the runtime engine can honour a transaction (`typeof engine.transaction === 'function'`). The `/batch` handler runs its ops inside `engine.transaction()`, which degrades to a non-atomic passthrough (or 501) without one.
  - **`@objectstack/rest`** (`/discovery`) — ANDs the engine signal with whether it actually mounts the route (`api.enableBatch`), so a server with batch disabled reports `false` even on a transaction-capable engine (never advertise an endpoint that would 404).
  - **`@objectstack/plugin-hono-server`** (standalone discovery) — reports `false`: this minimal surface registers CRUD only and does not mount `/batch` (that ships with `@objectstack/rest`). Under-reporting is the safe direction — a client keeps its correct-but-slower fallback rather than losing atomicity.
  - **`@objectstack/client`** — already normalizes hierarchical `capabilities` to flat booleans, so `client.capabilities.transactionalBatch` is exposed (and now typed) for declarative consumers.

  The bit follows the existing capability semantics: `true` ⟺ the `/batch` route is mounted **and** the runtime can honour a transaction — the exact condition under which the endpoint returns `200` rather than `404`/`405`/`501`. Additive and behavior-preserving; only the discovery payload gains a field.

- 668dd17: **Breaking (npm type surface): retire the vestigial feed contracts + protocol surface (ADR-0052 §5 follow-up, #1959).**

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

### Patch Changes

- e057f42: fix: harden the bulk-write path — retries, idempotency, contracts, and summary visibility (#3147–#3152)

  Six reliability fixes to the batched seed/import + `engine.insert(array)` path
  introduced by the #2678 bulk-write rework:

  - **#3151** `bulkWrite` validates that `writeBatch` returns one record per input
    row (a short/long/non-array return is degraded per-row, not backfilled as
    phantom success); `engine.insert(array)` likewise rejects a short driver
    `bulkCreate` return instead of padding afterInsert with `undefined`.
  - **#3150** wraps the two remaining un-retried write points (seed
    `writeRecord`/`resolveDeferredUpdates`, import's no-`createManyData`
    fallback) in `withTransientRetry`; `defaultIsTransientError` short-circuits
    definitive logical errors to non-transient.
  - **#3148** import `resolveRef` flushes pending creates on a same-object miss so
    a later row can reference an earlier same-file CREATE, and no longer
    negatively caches a miss.
  - **#3149** threads an `attempt` counter through `bulkWrite`; seed rechecks by
    `externalId` and import by `matchFields` before re-writing, so a
    commit-then-lost-response retry cannot duplicate a batch.
  - **#3147** `recomputeSummaries` retries transient failures and, on exhaustion,
    surfaces `SummaryRecomputeError` (`ERR_SUMMARY_RECOMPUTE`) instead of a
    silent warn; seed/import recover it to a warning without re-writing.
  - **#3152** autonumbers are assigned after validation, so a batch that dies in
    validation consumes no sequence value (no number-range gaps).

- 0e41302: fix(metadata-protocol): unscoped metadata list dedupes package-aware, not by bare name (ADR-0048 #1828)

  `getMetaItems` merged registry items, `sys_metadata` overlay rows, draft-preview
  rows, and MetadataService items into `Map`s keyed by bare `name`, so two installed
  packages shipping the same `type/name` (e.g. `page/home`) collapsed to one row
  (last-write-wins) on an unscoped `GET /meta/:type` whenever either package had an
  overlay — and the frontend prefer-local resolution, which reads that list, could
  no longer tell the two packages' rows apart.

  The three merge sites (plus the env/org pre-merge) now key by `(package, name)`,
  mirroring `getMetaItem`'s scoped-then-global-fallback resolution: colliding rows
  stay distinct each with its own `_packageId`, a package-less (env-wide) overlay
  still wins over the single artifact it customizes (ADR-0005 precedence and
  single-package behaviour unchanged), and the registry-hydration artifact graft is
  scoped to each row's own `package_id` so a collision no longer mislabels provenance.

- b8a21ad: Publish/discard package drafts in the draft's own org scope, fixing `no_draft` after saving a draft via Studio.

  Studio "Save Draft" (`PUT /meta/:type/:name?mode=draft`) never threads the session's `activeOrganizationId`, so the draft row is written env-wide (`organization_id = NULL`). "Publish" (`POST /packages/:id/publish-drafts`) resolves the active org and passed it to `promoteDraft`, which looked the draft up with a strict `organization_id = <org>` equality — so it 404'd (`[no_draft] No pending draft exists …`) on the env-wide row it could never match, even though `listDrafts` had already surfaced that draft to the publish CTA (PR #1852's `$or`). `discardPackageDrafts` had the same latent gap.

  `listDrafts` now projects each draft's own `organizationId`, and `publishPackageDrafts` / `discardPackageDrafts` promote / delete each draft in that scope (env-wide stays env-wide, per-org stays per-org). Seed-body capture and the ADR-0067 revert-plan pre-state read are scoped the same way.

  Fixes #3115.

- beaf2de: fix(metadata-protocol): strip static `readonly` on INSERT at the data-write ingress (#3043)

  #2948/#3003 made static `readonly: true` fields server-enforced on UPDATE (a
  non-system PATCH forging `approval_status: 'approved'` is silently stripped in
  the engine), but INSERT was exempt. For approval/status/verdict columns that
  exemption was the _shorter_ attack: instead of the #3003 draft-then-PATCH move, a
  non-system caller could `POST` a record already `approval_status: 'approved'` in
  one step — and the UPDATE-only strip never reached it.

  The strip now also runs on INSERT, but at the **external data-write ingress**
  (`DataProtocol.createData` / `createManyData` / `batchData` / `cloneData`) rather
  than in the engine. That seam is the single point every external programmatic
  create funnels through — the REST CRUD route, the GraphQL/MCP dispatcher
  (`bridge.create` → `callData` → `createData`), and bulk import — while **trusted
  internal writers** (better-auth's adapter, the metadata repository, the seed
  loader) call `engine.insert` directly and bypass it. Enforcing at the ingress
  protects every caller/agent path at once without stripping the internal writers
  that legitimately seed read-only columns on create (identity provisioning,
  provenance stamps, event-log cursors) — the blast radius an engine-level insert
  strip would have.

  - **Caller-forged only, at the ingress.** The payload here is raw caller input
    (the security middleware stamps `owner_id` / `organization_id` later, inside
    `engine.insert`), so only keys the caller actually sent are dropped; server
    stamps are added afterwards and are unaffected.
  - **Re-derives the default.** A stripped field falls back to its declared
    `defaultValue` in the engine (a forged `approval_status` becomes `draft`, not
    NULL).
  - **System-context exempt.** `isSystem` writes still seed read-only columns.
  - **Silent** (HTTP 2xx), per-row on batch/import. `readonlyWhen` stays
    INSERT-exempt (a conditional lock needs a prior record).
  - **Author-defined business objects only.** Platform objects (`managedBy` set,
    or the `sys_` namespace) carry their own field-write governance that a silent
    strip must not pre-empt — e.g. ADR-0086 REJECTS (403) a forged
    `managed_by:'package'` on `sys_permission_set`, and #3004 rejects a forged
    `owner_id`; several of those columns are `readonly`, so stripping them here
    would swallow the payload the guard is meant to reject. The #3043 threat is app
    approval/status fields, never `sys_` — the same boundary `applySystemFields`
    uses for ownership.

  Behavior change: a non-system create through the data API (REST / GraphQL / MCP /
  import) can no longer seed a `readonly` column from the payload. Flows that
  legitimately write read-only columns at creation must run with a system context
  (`isSystem`), the same requirement the UPDATE strip already imposes.

- 8abf133: **Breaking (discovery response shape): retire the residual feed capability surface (#3180, follow-up to #1959 / ADR-0052 §5).**

  The feed backend was retired long ago; #1959 removed the feed contracts + SDK. This
  removes the last discovery/dispatcher references to it, and fixes a real bug where the
  `comments` capability was permanently `false`.

  - `@objectstack/spec` — `WellKnownCapabilitiesSchema.feed` and `ApiRoutesSchema.feed`
    (`routes.feed`) are **removed**, and the `/api/v1/feed` entry is dropped from
    `DEFAULT_DISPATCHER_ROUTES`. FROM → TO: clients reading `discovery.capabilities.feed`
    or `discovery.routes.feed` → use `discovery.capabilities.comments`; comments/activity
    are served by the generic data API on `sys_comment` / `sys_activity`
    (`/api/v1/data/sys_comment/…`).
  - `@objectstack/metadata-protocol` — `getDiscovery()` no longer emits the always-`false`
    `feed` service/capability. **Bug fix:** the `comments` capability previously keyed off
    the deleted `'feed'` service (so it was permanently `false` after #1955); it now tracks
    the presence of the `sys_comment` object (provided by the always-on audit slate), so
    `declared === enforced`.
  - `@objectstack/client` — the internal `feed: '/api/v1/feed'` route constant is removed
    (it only existed to satisfy the now-removed `ApiRoutes.feed` type; no client code used it).

- 515f11a: fix(seed): replaying seeds no longer corrupts lookup natural keys on the upsert update path

  Every dev-server restart replayed package seeds in upsert mode, and any record whose
  lookup/master_detail was authored as a natural key could have that reference overwritten
  with NULL on the update path (`NOT NULL constraint failed` on required columns; silent
  link loss on nullable ones). Four fixes:

  - An unresolved reference now leaves the column untouched (deferred to pass 2) or drops
    the record loudly — it is never written as NULL over an existing row.
  - DB-side reference resolution probes the target dataset's declared `externalId` (e.g.
    `email`) before falling back to `name` and `id`, matching how in-memory resolution
    already keyed records.
  - A rejected update (e.g. a `state_machine` rule vetoing the replay) no longer severs
    natural-key resolution for downstream child datasets.
  - Replays are idempotent: an upsert/update whose declared fields already match the
    existing row is skipped instead of rewritten (no more `updated_at` churn or lifecycle
    re-validation on every boot).

- Updated dependencies [f972574]
- Updated dependencies [6289ec3]
- Updated dependencies [22013aa]
- Updated dependencies [3ad3dd5]
- Updated dependencies [8efa395]
- Updated dependencies [3a18b60]
- Updated dependencies [a8aa34c]
- Updated dependencies [e057f42]
- Updated dependencies [a3823b2]
- Updated dependencies [43a3efb]
- Updated dependencies [524696a]
- Updated dependencies [6b51346]
- Updated dependencies [80273c8]
- Updated dependencies [bfa3c3f]
- Updated dependencies [5e3301d]
- Updated dependencies [dd9f223]
- Updated dependencies [46e876c]
- Updated dependencies [7125007]
- Updated dependencies [5f05de2]
- Updated dependencies [021ba4c]
- Updated dependencies [158aa14]
- Updated dependencies [62a2117]
- Updated dependencies [83e8f7d]
- Updated dependencies [d2723e2]
- Updated dependencies [fefcd54]
- Updated dependencies [beaf2de]
- Updated dependencies [06cb319]
- Updated dependencies [369eb6e]
- Updated dependencies [06ff734]
- Updated dependencies [b659111]
- Updated dependencies [5754a23]
- Updated dependencies [6c270a6]
- Updated dependencies [290e2f0]
- Updated dependencies [668dd17]
- Updated dependencies [8abf133]
- Updated dependencies [e0859b1]
- Updated dependencies [92f5f19]
- Updated dependencies [32899e6]
- Updated dependencies [04ecd4e]
- Updated dependencies [4d5a892]
- Updated dependencies [16cebeb]
- Updated dependencies [86d30af]
- Updated dependencies [8923843]
- Updated dependencies [ea32ec7]
- Updated dependencies [a2795f6]
- Updated dependencies [f16b492]
- Updated dependencies [4b6fde8]
- Updated dependencies [2018df9]
- Updated dependencies [fc5a3a2]
- Updated dependencies [8ff9210]
  - @objectstack/spec@16.0.0
  - @objectstack/core@16.0.0
  - @objectstack/formula@16.0.0
  - @objectstack/metadata-core@16.0.0
  - @objectstack/types@16.0.0

## 16.0.0-rc.1

### Minor Changes

- bfa3c3f: **Broadcast a `transactionalBatch` capability bit in discovery so clients negotiate the atomic cross-object batch declaratively, instead of runtime-probing 404/405/501 (#3298).**

  The atomic cross-object batch endpoint (`POST {basePath}/batch`, #1604 / ADR-0034 item 4) and its typed SDK surface (`client.data.batchTransaction`, #3271) already shipped, but discovery never told a client whether a backend actually supports it. Consumers (notably ObjectUI's `ObjectStackAdapter`) had to _probe_: fire a `/batch`, read `404`/`405` (no route) or `501` (no runtime transaction), and only then fall back to non-atomic client-side simulation. That is "find out by calling", not capability negotiation — it cannot be decided at connect time and cannot serve as the "minimum backend supports `/batch`" gate that blocks hard-deleting the non-atomic fallback downstream.

  `WellKnownCapabilitiesSchema` gains a required `transactionalBatch: boolean`, and **every** discovery producer fills it honestly (`declared === enforced`), so it never becomes a declared-but-unpopulated bit:

  - **`@objectstack/metadata-protocol`** (`getDiscovery`) — reports whether the runtime engine can honour a transaction (`typeof engine.transaction === 'function'`). The `/batch` handler runs its ops inside `engine.transaction()`, which degrades to a non-atomic passthrough (or 501) without one.
  - **`@objectstack/rest`** (`/discovery`) — ANDs the engine signal with whether it actually mounts the route (`api.enableBatch`), so a server with batch disabled reports `false` even on a transaction-capable engine (never advertise an endpoint that would 404).
  - **`@objectstack/plugin-hono-server`** (standalone discovery) — reports `false`: this minimal surface registers CRUD only and does not mount `/batch` (that ships with `@objectstack/rest`). Under-reporting is the safe direction — a client keeps its correct-but-slower fallback rather than losing atomicity.
  - **`@objectstack/client`** — already normalizes hierarchical `capabilities` to flat booleans, so `client.capabilities.transactionalBatch` is exposed (and now typed) for declarative consumers.

  The bit follows the existing capability semantics: `true` ⟺ the `/batch` route is mounted **and** the runtime can honour a transaction — the exact condition under which the endpoint returns `200` rather than `404`/`405`/`501`. Additive and behavior-preserving; only the discovery payload gains a field.

### Patch Changes

- Updated dependencies [6289ec3]
- Updated dependencies [8efa395]
- Updated dependencies [bfa3c3f]
- Updated dependencies [7125007]
- Updated dependencies [62a2117]
- Updated dependencies [06ff734]
  - @objectstack/spec@16.0.0-rc.1
  - @objectstack/formula@16.0.0-rc.1
  - @objectstack/metadata-core@16.0.0-rc.1
  - @objectstack/core@16.0.0-rc.1
  - @objectstack/types@16.0.0-rc.1

## 16.0.0-rc.0

### Minor Changes

- 668dd17: **Breaking (npm type surface): retire the vestigial feed contracts + protocol surface (ADR-0052 §5 follow-up, #1959).**

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

### Patch Changes

- e057f42: fix: harden the bulk-write path — retries, idempotency, contracts, and summary visibility (#3147–#3152)

  Six reliability fixes to the batched seed/import + `engine.insert(array)` path
  introduced by the #2678 bulk-write rework:

  - **#3151** `bulkWrite` validates that `writeBatch` returns one record per input
    row (a short/long/non-array return is degraded per-row, not backfilled as
    phantom success); `engine.insert(array)` likewise rejects a short driver
    `bulkCreate` return instead of padding afterInsert with `undefined`.
  - **#3150** wraps the two remaining un-retried write points (seed
    `writeRecord`/`resolveDeferredUpdates`, import's no-`createManyData`
    fallback) in `withTransientRetry`; `defaultIsTransientError` short-circuits
    definitive logical errors to non-transient.
  - **#3148** import `resolveRef` flushes pending creates on a same-object miss so
    a later row can reference an earlier same-file CREATE, and no longer
    negatively caches a miss.
  - **#3149** threads an `attempt` counter through `bulkWrite`; seed rechecks by
    `externalId` and import by `matchFields` before re-writing, so a
    commit-then-lost-response retry cannot duplicate a batch.
  - **#3147** `recomputeSummaries` retries transient failures and, on exhaustion,
    surfaces `SummaryRecomputeError` (`ERR_SUMMARY_RECOMPUTE`) instead of a
    silent warn; seed/import recover it to a warning without re-writing.
  - **#3152** autonumbers are assigned after validation, so a batch that dies in
    validation consumes no sequence value (no number-range gaps).

- 0e41302: fix(metadata-protocol): unscoped metadata list dedupes package-aware, not by bare name (ADR-0048 #1828)

  `getMetaItems` merged registry items, `sys_metadata` overlay rows, draft-preview
  rows, and MetadataService items into `Map`s keyed by bare `name`, so two installed
  packages shipping the same `type/name` (e.g. `page/home`) collapsed to one row
  (last-write-wins) on an unscoped `GET /meta/:type` whenever either package had an
  overlay — and the frontend prefer-local resolution, which reads that list, could
  no longer tell the two packages' rows apart.

  The three merge sites (plus the env/org pre-merge) now key by `(package, name)`,
  mirroring `getMetaItem`'s scoped-then-global-fallback resolution: colliding rows
  stay distinct each with its own `_packageId`, a package-less (env-wide) overlay
  still wins over the single artifact it customizes (ADR-0005 precedence and
  single-package behaviour unchanged), and the registry-hydration artifact graft is
  scoped to each row's own `package_id` so a collision no longer mislabels provenance.

- b8a21ad: Publish/discard package drafts in the draft's own org scope, fixing `no_draft` after saving a draft via Studio.

  Studio "Save Draft" (`PUT /meta/:type/:name?mode=draft`) never threads the session's `activeOrganizationId`, so the draft row is written env-wide (`organization_id = NULL`). "Publish" (`POST /packages/:id/publish-drafts`) resolves the active org and passed it to `promoteDraft`, which looked the draft up with a strict `organization_id = <org>` equality — so it 404'd (`[no_draft] No pending draft exists …`) on the env-wide row it could never match, even though `listDrafts` had already surfaced that draft to the publish CTA (PR #1852's `$or`). `discardPackageDrafts` had the same latent gap.

  `listDrafts` now projects each draft's own `organizationId`, and `publishPackageDrafts` / `discardPackageDrafts` promote / delete each draft in that scope (env-wide stays env-wide, per-org stays per-org). Seed-body capture and the ADR-0067 revert-plan pre-state read are scoped the same way.

  Fixes #3115.

- beaf2de: fix(metadata-protocol): strip static `readonly` on INSERT at the data-write ingress (#3043)

  #2948/#3003 made static `readonly: true` fields server-enforced on UPDATE (a
  non-system PATCH forging `approval_status: 'approved'` is silently stripped in
  the engine), but INSERT was exempt. For approval/status/verdict columns that
  exemption was the _shorter_ attack: instead of the #3003 draft-then-PATCH move, a
  non-system caller could `POST` a record already `approval_status: 'approved'` in
  one step — and the UPDATE-only strip never reached it.

  The strip now also runs on INSERT, but at the **external data-write ingress**
  (`DataProtocol.createData` / `createManyData` / `batchData` / `cloneData`) rather
  than in the engine. That seam is the single point every external programmatic
  create funnels through — the REST CRUD route, the GraphQL/MCP dispatcher
  (`bridge.create` → `callData` → `createData`), and bulk import — while **trusted
  internal writers** (better-auth's adapter, the metadata repository, the seed
  loader) call `engine.insert` directly and bypass it. Enforcing at the ingress
  protects every caller/agent path at once without stripping the internal writers
  that legitimately seed read-only columns on create (identity provisioning,
  provenance stamps, event-log cursors) — the blast radius an engine-level insert
  strip would have.

  - **Caller-forged only, at the ingress.** The payload here is raw caller input
    (the security middleware stamps `owner_id` / `organization_id` later, inside
    `engine.insert`), so only keys the caller actually sent are dropped; server
    stamps are added afterwards and are unaffected.
  - **Re-derives the default.** A stripped field falls back to its declared
    `defaultValue` in the engine (a forged `approval_status` becomes `draft`, not
    NULL).
  - **System-context exempt.** `isSystem` writes still seed read-only columns.
  - **Silent** (HTTP 2xx), per-row on batch/import. `readonlyWhen` stays
    INSERT-exempt (a conditional lock needs a prior record).
  - **Author-defined business objects only.** Platform objects (`managedBy` set,
    or the `sys_` namespace) carry their own field-write governance that a silent
    strip must not pre-empt — e.g. ADR-0086 REJECTS (403) a forged
    `managed_by:'package'` on `sys_permission_set`, and #3004 rejects a forged
    `owner_id`; several of those columns are `readonly`, so stripping them here
    would swallow the payload the guard is meant to reject. The #3043 threat is app
    approval/status fields, never `sys_` — the same boundary `applySystemFields`
    uses for ownership.

  Behavior change: a non-system create through the data API (REST / GraphQL / MCP /
  import) can no longer seed a `readonly` column from the payload. Flows that
  legitimately write read-only columns at creation must run with a system context
  (`isSystem`), the same requirement the UPDATE strip already imposes.

- 8abf133: **Breaking (discovery response shape): retire the residual feed capability surface (#3180, follow-up to #1959 / ADR-0052 §5).**

  The feed backend was retired long ago; #1959 removed the feed contracts + SDK. This
  removes the last discovery/dispatcher references to it, and fixes a real bug where the
  `comments` capability was permanently `false`.

  - `@objectstack/spec` — `WellKnownCapabilitiesSchema.feed` and `ApiRoutesSchema.feed`
    (`routes.feed`) are **removed**, and the `/api/v1/feed` entry is dropped from
    `DEFAULT_DISPATCHER_ROUTES`. FROM → TO: clients reading `discovery.capabilities.feed`
    or `discovery.routes.feed` → use `discovery.capabilities.comments`; comments/activity
    are served by the generic data API on `sys_comment` / `sys_activity`
    (`/api/v1/data/sys_comment/…`).
  - `@objectstack/metadata-protocol` — `getDiscovery()` no longer emits the always-`false`
    `feed` service/capability. **Bug fix:** the `comments` capability previously keyed off
    the deleted `'feed'` service (so it was permanently `false` after #1955); it now tracks
    the presence of the `sys_comment` object (provided by the always-on audit slate), so
    `declared === enforced`.
  - `@objectstack/client` — the internal `feed: '/api/v1/feed'` route constant is removed
    (it only existed to satisfy the now-removed `ApiRoutes.feed` type; no client code used it).

- 515f11a: fix(seed): replaying seeds no longer corrupts lookup natural keys on the upsert update path

  Every dev-server restart replayed package seeds in upsert mode, and any record whose
  lookup/master_detail was authored as a natural key could have that reference overwritten
  with NULL on the update path (`NOT NULL constraint failed` on required columns; silent
  link loss on nullable ones). Four fixes:

  - An unresolved reference now leaves the column untouched (deferred to pass 2) or drops
    the record loudly — it is never written as NULL over an existing row.
  - DB-side reference resolution probes the target dataset's declared `externalId` (e.g.
    `email`) before falling back to `name` and `id`, matching how in-memory resolution
    already keyed records.
  - A rejected update (e.g. a `state_machine` rule vetoing the replay) no longer severs
    natural-key resolution for downstream child datasets.
  - Replays are idempotent: an upsert/update whose declared fields already match the
    existing row is skipped instead of rewritten (no more `updated_at` churn or lifecycle
    re-validation on every boot).

- Updated dependencies [f972574]
- Updated dependencies [22013aa]
- Updated dependencies [3ad3dd5]
- Updated dependencies [3a18b60]
- Updated dependencies [a8aa34c]
- Updated dependencies [e057f42]
- Updated dependencies [a3823b2]
- Updated dependencies [43a3efb]
- Updated dependencies [524696a]
- Updated dependencies [6b51346]
- Updated dependencies [80273c8]
- Updated dependencies [5e3301d]
- Updated dependencies [dd9f223]
- Updated dependencies [46e876c]
- Updated dependencies [5f05de2]
- Updated dependencies [021ba4c]
- Updated dependencies [158aa14]
- Updated dependencies [83e8f7d]
- Updated dependencies [d2723e2]
- Updated dependencies [fefcd54]
- Updated dependencies [beaf2de]
- Updated dependencies [06cb319]
- Updated dependencies [369eb6e]
- Updated dependencies [b659111]
- Updated dependencies [5754a23]
- Updated dependencies [6c270a6]
- Updated dependencies [290e2f0]
- Updated dependencies [668dd17]
- Updated dependencies [8abf133]
- Updated dependencies [e0859b1]
- Updated dependencies [92f5f19]
- Updated dependencies [32899e6]
- Updated dependencies [04ecd4e]
- Updated dependencies [4d5a892]
- Updated dependencies [16cebeb]
- Updated dependencies [86d30af]
- Updated dependencies [8923843]
- Updated dependencies [ea32ec7]
- Updated dependencies [a2795f6]
- Updated dependencies [f16b492]
- Updated dependencies [4b6fde8]
- Updated dependencies [2018df9]
- Updated dependencies [fc5a3a2]
  - @objectstack/spec@16.0.0-rc.0
  - @objectstack/core@16.0.0-rc.0
  - @objectstack/formula@16.0.0-rc.0
  - @objectstack/types@16.0.0-rc.0
  - @objectstack/metadata-core@16.0.0-rc.0

## 15.1.1

### Patch Changes

- @objectstack/spec@15.1.1
- @objectstack/core@15.1.1
- @objectstack/types@15.1.1
- @objectstack/metadata-core@15.1.1
- @objectstack/formula@15.1.1

## 15.1.0

### Minor Changes

- f531a26: feat(discovery): honest capabilities — standardized stub/fallback marker + realtime route honesty (ADR-0076 D12/A1.5 framework slice, #2462)

  **Spec** — new service self-description marker for honest discovery
  (ADR-0076 D12): `SERVICE_SELF_INFO_KEY` (`__serviceInfo`),
  `ServiceSelfInfoSchema` / `ServiceSelfInfo`, and `readServiceSelfInfo()`,
  which also normalizes plugin-dev's legacy `_dev: true` flag to
  `{ status: 'stub', handlerReady: false }`. A registered service that is a
  stub / dev fake / degraded fallback self-identifies via this marker; a fully
  real service carries no marker.

  **Runtime + metadata-protocol** — both discovery builders
  (`HttpDispatcher.getDiscoveryInfo` and the protocol shim's `getDiscovery`)
  now honor the marker instead of hardcoding `status: 'available',
handlerReady: true` for every registered service. Dev stubs report `stub`,
  the ObjectQL analytics fallback reports `degraded` (it keeps serving — no
  `/analytics` 404), and consumers can finally trust
  `status === 'available'` / `handlerReady === true`.

  **Realtime honesty fix** — discovery no longer advertises a
  `/realtime` route or `websockets: true`: `service-realtime` is an
  in-process pub/sub bus, no dispatcher branch or plugin mounts any
  `/realtime` HTTP surface, so the advertised route always 404'd. The
  registered service now reports `status: 'degraded', handlerReady: false`
  with no route (clients using the SDK are unaffected — it falls back to the
  conventional path, which behaves exactly as before). Also corrects the
  advertised realtime provider from the nonexistent `plugin-realtime` to
  `service-realtime`.

  **REST (A1.5)** — the REST layer's protocol dependency is narrowed from the
  `ObjectStackProtocol` god-union to the new `RestProtocol =
DataProtocol & MetadataProtocol` slice (exported from
  `@objectstack/rest`), per the ADR-0076 D9 incremental narrowing guidance.
  Type-level only; no runtime change.

- f531a26: OWD posture is now enforced on the runtime write path (#3050). `metadata-protocol` gains the ADR-0094-addendum `registerAuthoringGate(type, gate)` seam — an awaited, throwing pre-persistence hook inside `saveMetaItem` (draft and publish-mode saves; environment writes only). `plugin-security` registers the `object` posture gate on it: an environment overlay of a packaged object may only TIGHTEN `sharingModel`/`externalSharingModel` (ADR-0086 D1 — closes the `OS_METADATA_WRITABLE=object` unvalidated-widening hole), and `externalSharingModel ≤ sharingModel` (ADR-0090 D11) is now rejected at save time instead of only by CLI lint. Write-path only — stored metadata keeps loading unchanged.
- d75c7ac: Package-draft publishing is now turn-atomic (ADR-0067 Decision-2, #3066). `publishPackageDrafts` runs every draft promotion AND the `sys_metadata_commit` record inside ONE engine transaction — a mid-batch failure rolls back the whole batch (`publishedCount: 0`; the causal item carries its real error, the rest report `batch_aborted`). Side effects (registry refresh, table DDL, seed apply, materializers, ADR-0094 projections, events) run after the metadata commits and are surfaced-not-swallowed on failure. `@objectstack/objectql`'s `engine.transaction()` now JOINS an already-open ambient transaction instead of opening a nested driver transaction (deadlock on single-connection pools; escaped the outer rollback). BREAKING (behavioral): API consumers that relied on partial batch publishes ("2 of 3 landed") now get all-or-nothing; engines without `transaction()` (memory driver, minimal stubs) keep the previous sequential behavior.

### Patch Changes

- f531a26: fix(metadata-protocol): findData now rejects unknown `$`-prefixed query parameters with 400 `UNSUPPORTED_QUERY_PARAM` instead of silently treating them as implicit field-equality filters that match zero rows (#2926 ⑩). A `$`-prefixed key can never be a field name, so this is loud-failure only for the unsupported-alias class; bare-key implicit equality filtering is unchanged. The error message lists the supported aliases ($top, $skip, $orderby, $select, $count, $search, $searchFields, $filter, $expand).
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [3fe9df1]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [4109153]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [627f225]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
- Updated dependencies [f531a26]
  - @objectstack/spec@15.1.0
  - @objectstack/core@15.1.0
  - @objectstack/types@15.1.0
  - @objectstack/formula@15.1.0
  - @objectstack/metadata-core@15.1.0

## 15.0.0

### Patch Changes

- Updated dependencies [28b7c28]
- Updated dependencies [13749ec]
- Updated dependencies [e62c233]
- Updated dependencies [ed61c9b]
- Updated dependencies [31d04d4]
  - @objectstack/spec@15.0.0
  - @objectstack/core@15.0.0
  - @objectstack/formula@15.0.0
  - @objectstack/metadata-core@15.0.0
  - @objectstack/types@15.0.0

## 14.8.0

### Minor Changes

- 1dede32: Make the `sys_permission_set` data record a pure projection of the metadata layer (ADR-0094; framework#2875) — one authoritative store for permission-set definitions, retiring the two-store split-brain behind the #2857 display-freshness class.

  - **`@objectstack/metadata-protocol`**: new `registerMutationProjector(type, fn)` — an awaited, best-effort per-type hook invoked after persistence inside `saveMetaItem` / `publishMetaItem` / `deleteMetaItem`, so a derived data-plane read-model is already consistent when the write returns (outcome surfaced as `projectionApplied` on the response). Complements the fire-and-forget `onMetadataMutation` listeners.
  - **`@objectstack/plugin-security`**: every non-system data-door write on `sys_permission_set` (Setup CRUD, bulk imports, any ObjectQL path) is redirected into the metadata store by an engine middleware; the record is written only by the projector. Boot reconciliation projects env overlays onto records (Studio-created sets now appear in Setup), backfills legacy data-door-only records into metadata once, and re-projects drifted records from the effective body (metadata wins). The projector also syncs the metadata manager's in-memory `permission` entry, so evaluator resolution and the Setup display can no longer disagree.

  Behavior changes: "deleting" an artifact-backed permission set through the data door now resets it to its declared body instead of removing the row; renaming a set through the data door is rejected (`400`) — clone to a new name instead; record edits that predate this change and are shadowed by a metadata definition are discarded (loud warning) at first boot, since they were never enforced.

  Moved exports (from `@objectstack/plugin-security`): `upsertEnvPermissionSet` now lives in `permission-set-projection.js` (still re-exported from the package root) and **creates** missing records; `projectEnvPermissionOnMutation` / `subscribeEnvPermissionProjection` are replaced by `projectPermissionMutation` / `registerPermissionSetProjection`.

### Patch Changes

- Updated dependencies [16b4bf6]
- Updated dependencies [16b4bf6]
- Updated dependencies [10e8983]
- Updated dependencies [607aaf4]
- Updated dependencies [bb71321]
  - @objectstack/spec@14.8.0
  - @objectstack/core@14.8.0
  - @objectstack/formula@14.8.0
  - @objectstack/metadata-core@14.8.0
  - @objectstack/types@14.8.0

## 14.7.0

### Patch Changes

- Updated dependencies [d6a72eb]
- Updated dependencies [824a395]
  - @objectstack/spec@14.7.0
  - @objectstack/types@14.7.0
  - @objectstack/core@14.7.0
  - @objectstack/formula@14.7.0
  - @objectstack/metadata-core@14.7.0

## 14.6.0

### Patch Changes

- Updated dependencies [609cb13]
- Updated dependencies [ce6d151]
  - @objectstack/spec@14.6.0
  - @objectstack/core@14.6.0
  - @objectstack/formula@14.6.0
  - @objectstack/metadata-core@14.6.0
  - @objectstack/types@14.6.0

## 14.5.0

### Patch Changes

- Updated dependencies [526805e]
- Updated dependencies [d79ca07]
- Updated dependencies [33ebd34]
- Updated dependencies [c044f08]
- Updated dependencies [01274eb]
  - @objectstack/spec@14.5.0
  - @objectstack/core@14.5.0
  - @objectstack/formula@14.5.0
  - @objectstack/metadata-core@14.5.0
  - @objectstack/types@14.5.0

## 14.4.0

### Patch Changes

- Updated dependencies [7953832]
- Updated dependencies [82e745e]
- Updated dependencies [f3035bd]
- Updated dependencies [82c0d94]
- Updated dependencies [7449476]
  - @objectstack/spec@14.4.0
  - @objectstack/metadata-core@14.4.0
  - @objectstack/core@14.4.0
  - @objectstack/formula@14.4.0
  - @objectstack/types@14.4.0

## 14.3.0

### Patch Changes

- Updated dependencies [2a71f48]
- Updated dependencies [02f6af4]
- Updated dependencies [c1064f1]
  - @objectstack/spec@14.3.0
  - @objectstack/core@14.3.0
  - @objectstack/formula@14.3.0
  - @objectstack/metadata-core@14.3.0
  - @objectstack/types@14.3.0

## 14.2.0

### Patch Changes

- Updated dependencies [ac8f029]
- Updated dependencies [4ab9958]
  - @objectstack/spec@14.2.0
  - @objectstack/core@14.2.0
  - @objectstack/formula@14.2.0
  - @objectstack/metadata-core@14.2.0
  - @objectstack/types@14.2.0

## 14.1.0

### Patch Changes

- Updated dependencies [5a8465f]
- Updated dependencies [7f8620b]
- Updated dependencies [82ba3a6]
  - @objectstack/spec@14.1.0
  - @objectstack/core@14.1.0
  - @objectstack/formula@14.1.0
  - @objectstack/metadata-core@14.1.0
  - @objectstack/types@14.1.0

## 14.0.0

### Minor Changes

- 1056c5f: Package uninstall now revokes the package's data-plane permission rows (#2747, ADR-0086 D3 / ADR-0090 D5 "no ghost grants").

  **`@objectstack/metadata-protocol`**: `deletePackage` gains an
  uninstall-cleanup seam — the exact mirror of the publish materializer:
  domain plugins register named cleanups via `registerUninstallCleanup(name,
fn)` and every cleanup runs with the uninstalled package id, its outcome
  reported on the new `cleanups` array of the response (a failed revocation is
  visible, never silent). `deletePackage` also unregisters the package from
  the in-memory SchemaRegistry (best-effort), so the running kernel stops
  serving it without waiting for a restart.

  **`@objectstack/plugin-security`**: registers the
  `security.package-permissions` cleanup — deletes the package's own
  `sys_permission_set` rows (`managed_by: 'package'` + matching `package_id`
  only; env-authored and foreign-package rows are never touched, ADR-0086 D4),
  their `sys_position_permission_set` / `sys_user_permission_set` bindings
  (bindings first, so no dangling grants), and the package's
  `sys_audience_binding_suggestion` rows (a reinstall re-prompts fresh).
  Also fixes the engine-call signature in the suggestion module: `find`/`delete`
  read `context` from their second argument — the previous trailing
  `{ context }` argument was ignored, so deletes ran principal-less.

  **`@objectstack/rest`**: `DELETE /api/v1/packages/:id` (no version pin) now
  goes through `protocol.deletePackage` — one uninstall semantic instead of a
  bare `sys_packages` row delete — removing the package's metadata, durable
  record, registry entry, and running the cleanups; the response carries
  `deletedCount` + `cleanups`. A version-scoped delete keeps the narrow
  durable-registry semantics.

### Patch Changes

- Updated dependencies [0a8e685]
- Updated dependencies [afa8115]
- Updated dependencies [80f12ca]
- Updated dependencies [e2fa074]
- Updated dependencies [23c8668]
- Updated dependencies [29f017d]
- Updated dependencies [216fa9a]
- Updated dependencies [6c22b12]
  - @objectstack/spec@14.0.0
  - @objectstack/core@14.0.0
  - @objectstack/formula@14.0.0
  - @objectstack/metadata-core@14.0.0
  - @objectstack/types@14.0.0

## 13.0.0

### Minor Changes

- fc7e7f7: Enforce the package namespace-prefix rule for Studio-authored packages.

  The protocol requires every object name in a package to carry the package's
  `manifest.namespace` prefix (`crm_account`); `defineStack()` enforces this at
  compile time via `validateNamespacePrefix`. Studio/runtime-authored packages
  never take that path, and they were created without a namespace at all — so the
  rule was silently inert and objects published with bare, collision-prone names.

  Two runtime changes close the gap:

  - `protocol.installPackage` now derives a default namespace from the package id
    (`com.example.leave` → `leave`) when the manifest declares none, and persists
    it on the manifest (in-memory registry + `sys_packages`). An explicitly
    declared namespace always wins (e.g. HotCRM's `crm`).
  - `protocol.publishPackageDrafts` now rejects any object draft whose name lacks
    the package namespace prefix, before promoting anything (atomic), with an
    actionable message (`Rename it to 'leave_ticket'`). Packages that declare no
    namespace are grandfathered — mirroring `defineStack`, the rule is not
    invented at enforcement time.

  The per-object prefix check and the id→namespace derivation are extracted into
  `@objectstack/spec/kernel` (`validateObjectNamespacePrefix`,
  `deriveNamespaceFromPackageId`) as the single source shared by `defineStack` and
  the runtime publish path, so the two enforcement points cannot drift.

### Patch Changes

- Updated dependencies [6d83431]
- Updated dependencies [01917c2]
- Updated dependencies [b271691]
- Updated dependencies [a5a1e41]
- Updated dependencies [466adf6]
- Updated dependencies [57b89b4]
- Updated dependencies [5be00c3]
- Updated dependencies [466adf6]
- Updated dependencies [2bee609]
- Updated dependencies [fc7e7f7]
  - @objectstack/spec@13.0.0
  - @objectstack/core@13.0.0
  - @objectstack/formula@13.0.0
  - @objectstack/types@13.0.0
  - @objectstack/metadata-core@13.0.0

## 12.6.0

### Minor Changes

- 21420d9: Seed loader and data-import now route bulk writes through the engine's array-form `insert()` (one round-trip per batch, with parent-deduplicated summary recompute) instead of one `insert()`/`createData()` call per record, and both retry transient driver errors instead of silently dropping the row (#2678).

  A new shared helper, `bulkWrite` (`@objectstack/core`), batches rows through a caller-supplied batch-write function, retries a whole-batch transient failure (network blip / timeout) with exponential backoff, and degrades to per-row writes (each itself retried) when a batch fails for a non-transient reason — so one bad row can't drop the other N-1. `withTransientRetry` wraps a single write (e.g. an update) with the same retry behavior.

  - `SeedLoaderService.loadDataset()` (`@objectstack/metadata-protocol`) buffers insert-mode records and flushes them in batches of 200 via the engine's array `insert()`. Datasets with a self-referencing field (e.g. `employee.manager_id -> employee`) keep the historical per-record write path, since a later record may need an earlier one's freshly-assigned id.
  - `runImport()` (`@objectstack/rest`) buffers create-resolved rows and flushes them via `protocol.createManyData()` when the protocol supports it, falling back to the original per-row `createData()` call otherwise. `Protocol.createManyData` (`@objectstack/metadata-protocol`) now forwards `context` to `engine.insert()` like `createData` already did, so tenant-scoped bulk creates work correctly.

  Previously, a 1000-row seed or import into an object with a rollup summary issued 1000+ round-trips and up to 1000 summary recomputes; a single transient network error on any one row silently dropped it with no retry (the 2026-07-06 HotCRM first-boot incident). A `bulkCreate`-capable driver now sees roughly `ceil(N/batch)` writes, and a transient error is retried before a row is ever reported as failed.

  **Fix (`@objectstack/driver-sql`):** `SqlDriver.bulkCreate()` never generated a client-side id for a row missing one, unlike `create()` — a latent gap that this change is the first to exercise at scale (a bulk-inserted row without a driver-native id default silently landed with `id: NULL`). `bulkCreate()` now mirrors `create()`'s id/`_id` normalization per row.

### Patch Changes

- Updated dependencies [6cebf22]
- Updated dependencies [21420d9]
  - @objectstack/spec@12.6.0
  - @objectstack/core@12.6.0
  - @objectstack/formula@12.6.0
  - @objectstack/metadata-core@12.6.0
  - @objectstack/types@12.6.0

## 12.5.0

### Patch Changes

- 8b3d363: Package metadata seed can no longer wedge the platform via record-change automation.

  A seeded record whose lifecycle flow self-triggered (a `record-after-update` flow
  writing back to its own trigger record) looped forever when its boolean re-entry
  guard never tripped — booleans persist as integer `1` on SQLite/libsql and CEL
  `1 != true` is `true`. During first-boot seed (which awaits automation) this hung
  the whole kernel build.

  Three layers:

  - `ExecutionContext.skipTriggers` (set by the seed-loader, threaded onto
    `HookContext.session` via `buildSession`) makes the record-change trigger skip
    flow dispatch for seed/bulk writes — seed data is end-state reference data, not
    user events. Lifecycle hooks still run.
  - `coerceBooleanFields()` converts SQLite 0/1 (and `'0'/'1'/'true'/'false'`) to
    real booleans on the after-hook view of a record (`hookContext.result` /
    `.previous`), so flow conditions see JS booleans. The value returned to the
    caller is unchanged.
  - The automation engine breaks a flow re-entering for the same record while an
    execution is still on the stack (`activeRecordFlows`), a backstop for any
    self-trigger loop.

- Updated dependencies [8b3d363]
  - @objectstack/spec@12.5.0
  - @objectstack/core@12.5.0
  - @objectstack/formula@12.5.0
  - @objectstack/metadata-core@12.5.0
  - @objectstack/types@12.5.0

## 12.4.0

### Minor Changes

- 60dc3ba: ADR-0087 P0 — enforce the protocol version handshake (make `engines.protocol` real).

  `PluginEnginesSchema.protocol` (ADR-0025 §3.2, protocol-first per §3.10 #3) was declared, documented, and checked by no loader or installer — an ADR-0078 "declarable-but-inert" violation. A package built against an incompatible protocol major failed deep in a schema `.parse()` or a renderer contract instead of at the boundary.

  - **`@objectstack/spec`**: exports `PROTOCOL_VERSION` / `PROTOCOL_MAJOR` (`kernel`) — the single source of truth the handshake checks against. A drift test keeps it in lockstep with the package major.
  - **`@objectstack/metadata-core`**: adds `checkProtocolCompat()` (pure, major-grained range check), `assertProtocolCompat()`, and the structured `ProtocolIncompatibleError` (`OS_PROTOCOL_INCOMPATIBLE`, carrying both versions and the `objectstack migrate meta --from N` command). It refuses only on a _positive_ mismatch determination; absent ranges are grandfathered (warn) and unrecognized ranges never cause a false rejection.
  - **`@objectstack/metadata-protocol`**: `installPackage` runs the handshake before writing to the registry — an incompatible package is refused with a machine-actionable diagnostic instead of crashing later.

  Additive and backward compatible: packages that declare no `engines.protocol` range keep loading (with a warning). Part of the ADR-0087 epic (#2643); resolves #2644.

- 1dd5dfd: feat(packages): edit a package manifest via `PATCH /packages/:id`

  Adds an editable path for a package's `name` / `description` / `version` after
  creation: `SchemaRegistry.updatePackageManifest` (merges in-memory, preserving
  lifecycle state), `protocol.updatePackage` (re-persists to `sys_packages`), and
  the `PATCH /packages/:id` route in the HTTP dispatcher. `id` / `scope` / `type`
  remain immutable.

### Patch Changes

- Updated dependencies [60dc3ba]
  - @objectstack/spec@12.4.0
  - @objectstack/metadata-core@12.4.0
  - @objectstack/core@12.4.0
  - @objectstack/formula@12.4.0
  - @objectstack/types@12.4.0

## 12.3.0

### Patch Changes

- Updated dependencies [e7eceec]
  - @objectstack/spec@12.3.0
  - @objectstack/core@12.3.0
  - @objectstack/formula@12.3.0
  - @objectstack/metadata-core@12.3.0
  - @objectstack/types@12.3.0

## 12.2.0

### Patch Changes

- 75c310f: Rewrite the `writable_package_required` rejection message as user-facing remediation ("switch to a writable package in the package selector, or create a new one") instead of developer-facing copy that cited an internal ADR path — the message is surfaced verbatim as a Studio toast. The ADR pointer moves to a `docs` property on the error; `code`, `status`, and `packageId` are unchanged.
- Updated dependencies [fce8ff4]
- Updated dependencies [3962023]
- Updated dependencies [2bb193d]
- Updated dependencies [0426d27]
- Updated dependencies [da807f7]
- Updated dependencies [4f5b791]
  - @objectstack/spec@12.2.0
  - @objectstack/metadata-core@12.2.0
  - @objectstack/core@12.2.0
  - @objectstack/formula@12.2.0
  - @objectstack/types@12.2.0

## 12.1.0

### Patch Changes

- Updated dependencies [93e6d02]
  - @objectstack/spec@12.1.0
  - @objectstack/core@12.1.0
  - @objectstack/formula@12.1.0
  - @objectstack/metadata-core@12.1.0
  - @objectstack/types@12.1.0

## 12.0.0

### Minor Changes

- 9796e7c: feat(security): two-doors separation for permission sets (ADR-0086 P2)

  Splits who may change a permission set into two non-overlapping doors, enforced
  at the data layer instead of by convention:

  **块 1 — the package door (publish-time materialization).**
  `ObjectStackProtocolImplementation` gains a generic publish-time materializer
  registry (`registerPublishMaterializer(type, fn)`). When a draft of a registered
  type is published, its body is projected into a data-plane row and the result is
  surfaced on the publish response as `materializeApplied` (best-effort, never
  thrown — same contract as `seedApplied`). `promoteDraft` now returns the draft's
  `packageId` so the materializer can stamp the owning package. `plugin-security`
  registers a `permission` materializer that upserts the published set into
  `sys_permission_set` with `managed_by:'package'` + `package_id` — so a set
  authored through the studio package door (saved as a `permission` draft, then
  published) lands in the admin surface with the exact provenance the boot seeder
  already stamps, now on the runtime publish path too. The single-set upsert is
  shared with `bootstrapDeclaredPermissions` (`upsertPackagePermissionSet`), so
  both paths apply the same own-row / foreign-package / env-authored rules.

  **块 2 — the admin door (data-layer write gate).**
  The security middleware now refuses any admin-door write
  (`update`/`delete`/`transfer`/`restore`/`purge`) to a `sys_permission_set` row
  with `managed_by:'package'`, and refuses an `insert` that forges
  `managed_by:'package'`. The gate fails closed regardless of the caller's grants
  (a platform admin with `modifyAllRecords` is blocked just the same), so it is a
  real data-layer boundary rather than a UI hint. System/boot writes carry
  `isSystem` and bypass the whole middleware, so the boot seeder and the publish
  materializer are unaffected. Env-authored sets (`managed_by` `user`/`platform`
  or absent) stay freely editable through the admin door — the two doors never
  overwrite each other.

### Patch Changes

- b5be479: fix(protocol): versionless package installs now persist to sys_packages (#2532)

  `installPackage` writes both package stores, but its durable half was guarded by
  `pkgSvc?.publish && manifest.version` — silently skipping every versionless
  runtime-created base (`{id, name}` from the builder / Setup). Those packages
  lived only in the in-memory registry and vanished on restart, while their
  metadata and tables survived. The version is now defaulted (`0.1.0`) instead of
  skipping, a failed persist logs loudly instead of silently, and `deletePackage`
  drops the `sys_packages` record so an uninstalled package no longer resurrects
  at the next boot (service-package hydrates that table into the registry).

- 2d567cb: Runtime-authored (Studio) hooks now execute their `body` (#2588).

  Previously a hook authored at runtime (saved via `protocol.saveMetaItem` /
  `publish-drafts`) loaded into the registry but its L1/L2 `body` never ran — the
  metadata-service bind path passed no `bodyRunner` and the engine's
  `_defaultBodyRunner` fallback was never installed, so the binder silently
  skipped the body. Now:

  - `AppPlugin` installs the QuickJS-sandboxed hook body runner as the engine
    default at boot (`engine.setDefaultBodyRunner`), so bind paths without an
    explicit runner can execute bodies. Opt out with
    `OS_DISABLE_AUTHORED_HOOKS=1` to keep runtime-authored hook bodies inert.
  - `ObjectQLPlugin` re-binds runtime-authored hooks from their `sys_metadata`
    rows at `kernel:ready` (cold boot — env-scoped kernels never surfaced these
    rows before), on `metadata:reloaded`, and on every hook mutation through the
    new `protocol.onMetadataMutation` listener — so saves, publishes, edits, and
    deletes take effect live, without a restart. Package-artifact hooks are
    excluded from this bind path (AppPlugin already binds them with an explicit
    runner) so they no longer risk double execution.
  - `@objectstack/metadata-protocol` gains a server-side
    `onMetadataMutation(listener)` API: `saveMetaItem` / `publishMetaItem` /
    `deleteMetaItem` notify subscribers after persistence succeeds.

- e3498fb: fix(runtime): carry spec-validation issues (and the 422 status) through metadata save/publish errors

  `protocol.saveMetaItem` already validates a metadata draft against its spec Zod
  schema and, on failure, throws a rich error: HTTP `status: 422`, `code:
'invalid_metadata'`, and a structured `issues: [{ path, message, code }]` array
  (field-anchored, `superRefine` issues included). But the HTTP dispatcher's catch
  blocks collapsed all of that to a single message — the save path even hardcoded
  `400` — so a client could only show a generic "failed validation" banner with no
  way to point at the offending field. The publish path was worse: the per-draft
  catch in `publishPackageDrafts` flattened each failure into `{ type, name, error
}` and **dropped `issues` entirely**.

  Now:

  - A new `errorFromThrown(e, fallbackStatus)` dispatcher helper preserves the
    error's own `status` (so validation surfaces as **422**, not a downgraded 400)
    and attaches `{ code, issues }` under `error.details` when present. Errors that
    carry neither behave exactly as before. Used by the metadata **save** (`PUT
/meta/:type/:name`) and **publish** (`POST /packages/:id/publish-drafts`)
    catch sites.
  - `publishPackageDrafts` now carries `issues` into each `failed[]` entry, so a
    validation failure during publish is field-anchored too (it previously kept
    only the message).

  This is the server half of "surface validation at the save/publish moment, on
  the field" — the Studio can now map each issue back to its input instead of
  showing a wall-of-text banner. Purely additive to the error payload; the only
  behavior change is the more-correct 422 (was 400) for a failed metadata save.

- 806a40a: Stop runtime view personalization from permanently removing views from the switcher.

  A console personalization PUT (grid column sort, inline edit, …) sends only the raw
  view config — no top-level `viewKind`/`object`. Persisted verbatim, the overlay row
  replaced the flattened package entry wholesale on read, stripping the identity fields
  every switcher-style consumer filters on (`viewKind && object`) — one sort click and
  the view vanished until the DB row was deleted (#2555).

  Two independent guards: `saveMetaItem` now inherits the missing `viewKind`/`object`/
  `label` from the registry entry the overlay shadows before persisting, and
  `getMetaItems` heals identity-less rows already in the DB the same way on read. The
  overlay's own fields always win; `defineView` container bodies are untouched.

- Updated dependencies [a8df396]
- Updated dependencies [e695fe0]
- Updated dependencies [7c09621]
- Updated dependencies [7709db4]
- Updated dependencies [2082109]
- Updated dependencies [7c09621]
- Updated dependencies [9860de4]
- Updated dependencies [069c205]
  - @objectstack/spec@12.0.0
  - @objectstack/core@12.0.0
  - @objectstack/formula@12.0.0
  - @objectstack/metadata-core@12.0.0
  - @objectstack/types@12.0.0

## 11.10.0

### Patch Changes

- Updated dependencies [6a9397e]
- Updated dependencies [c0efe5d]
  - @objectstack/spec@11.10.0
  - @objectstack/core@11.10.0
  - @objectstack/formula@11.10.0
  - @objectstack/metadata-core@11.10.0
  - @objectstack/types@11.10.0

## 11.9.0

### Patch Changes

- Updated dependencies [d3595d9]
  - @objectstack/spec@11.9.0
  - @objectstack/core@11.9.0
  - @objectstack/formula@11.9.0
  - @objectstack/metadata-core@11.9.0
  - @objectstack/types@11.9.0

## 11.8.0

### Patch Changes

- @objectstack/spec@11.8.0
- @objectstack/core@11.8.0
- @objectstack/types@11.8.0
- @objectstack/metadata-core@11.8.0
- @objectstack/formula@11.8.0

## 11.7.0

### Patch Changes

- Updated dependencies [5178906]
  - @objectstack/spec@11.7.0
  - @objectstack/core@11.7.0
  - @objectstack/formula@11.7.0
  - @objectstack/metadata-core@11.7.0
  - @objectstack/types@11.7.0

## 11.6.0

### Patch Changes

- @objectstack/spec@11.6.0
- @objectstack/core@11.6.0
- @objectstack/types@11.6.0
- @objectstack/metadata-core@11.6.0
- @objectstack/formula@11.6.0

## 11.5.0

### Patch Changes

- Updated dependencies [6ee4f04]
- Updated dependencies [c1e3a65]
  - @objectstack/spec@11.5.0
  - @objectstack/core@11.5.0
  - @objectstack/formula@11.5.0
  - @objectstack/metadata-core@11.5.0
  - @objectstack/types@11.5.0

## 11.4.0

### Patch Changes

- Updated dependencies [5821c51]
- Updated dependencies [a0fce3f]
  - @objectstack/spec@11.4.0
  - @objectstack/core@11.4.0
  - @objectstack/formula@11.4.0
  - @objectstack/metadata-core@11.4.0
  - @objectstack/types@11.4.0

## 11.3.0

### Patch Changes

- Updated dependencies [58e8e31]
- Updated dependencies [b4a5df0]
  - @objectstack/spec@11.3.0
  - @objectstack/core@11.3.0
  - @objectstack/formula@11.3.0
  - @objectstack/metadata-core@11.3.0
  - @objectstack/types@11.3.0

## 11.2.0

### Patch Changes

- Updated dependencies [d0f4b13]
- Updated dependencies [302bdab]
  - @objectstack/spec@11.2.0
  - @objectstack/core@11.2.0
  - @objectstack/formula@11.2.0
  - @objectstack/metadata-core@11.2.0
  - @objectstack/types@11.2.0

## 11.1.0

### Minor Changes

- 13dbcf2: Extract metadata management into `@objectstack/metadata-protocol` (ADR-0076)

  `protocol.ts` (the `ObjectStackProtocol` implementation — sys_metadata CRUD, draft/publish, locks, package ownership, diagnostics) plus its `sys-metadata-repository`, `metadata-diagnostics`, `seed-loader`, and `build-probes` helpers were metadata-domain code that lived inside `@objectstack/objectql` for historical reasons. They now live in a dedicated **`@objectstack/metadata-protocol`** package.

  The protocol no longer depends on the concrete `ObjectQL` class — it is typed against an injected `MetadataHostEngine` interface (the engine is still injected at runtime). Dependency direction is now one-way (`objectql → metadata-protocol`); there is no cycle.

  **Non-breaking**: `@objectstack/objectql` re-exports every previously public symbol (`ObjectStackProtocolImplementation`, `SysMetadataRepository`, `SysMetadataEngine`, `SeedLoaderService`, `runBuildProbes`, …), so existing imports keep working.

  This is Step 1 of ADR-0076. A later step turns the protocol into a capability plugin so `objectql` itself stops depending on it (making the engine lean by construction).

  Also adds a lean **`@objectstack/objectql/core`** entry — the engine/registry/hooks/validation surface only, with no kernel plugin or metadata protocol — so a thin embedder can import just the engine and never pull `@objectstack/metadata-protocol` into its bundle. A boundary ratchet test guards the entry.

### Patch Changes

- Updated dependencies [ce0b4f6]
- Updated dependencies [9ccfcd6]
- Updated dependencies [ecf193f]
- Updated dependencies [51bec81]
- Updated dependencies [3e593a7]
- Updated dependencies [fdb41c0]
- Updated dependencies [63d5403]
  - @objectstack/core@11.1.0
  - @objectstack/spec@11.1.0
  - @objectstack/types@11.1.0
  - @objectstack/formula@11.1.0
  - @objectstack/metadata-core@11.1.0
