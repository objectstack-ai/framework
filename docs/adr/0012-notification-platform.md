# ADR-0012: Notification Platform — Four Built-in Channels on a Generalized Outbox

**Status**: Draft (2026-05-25)
**Authors**: Platform team — surfaced from GitHub Issue #1292 ("[P0] notification: no outbound notification channel")
**Consumers**: `@objectstack/spec` (new `notification/` domain), `@objectstack/service-notification` (new), `@objectstack/plugin-notification-inbox` (new), `@objectstack/plugin-notification-email` (replaces `plugin-email`), `@objectstack/plugin-notification-webhook` (extracted from `plugin-webhooks`), `@objectstack/plugin-notification-push` (new), every flow that has a `notify` node, every template that ships notification rules

---

## TL;DR

The `notify` node in every flow today resolves a recipient list and then drops the message on the floor — there is no transport. Issue #1292 documents this as a P0 gap across 7 templates (contracts / procurement / compliance / content / todo / hotcrm / helpdesk).

We already own most of the infrastructure: `plugin-webhooks` ships a durable outbox, exponential retry, HMAC signing, idempotency, dead-letter queue, and cluster-coordinated dispatch (per-partition `cluster.lock`, TTL 5× tick). The missing pieces are (a) a channel-agnostic generalization of that dispatcher, (b) four built-in channels people actually expect (`inbox` / `email` / `webhook` / `push`), (c) a topic + preference matrix so users can opt out, and (d) an email transport sub-system that supports both private-deploy SMTP and SaaS providers.

This ADR proposes:

1. **Extract** the outbox/retry/lock/signing machinery from `plugin-webhooks` into `@objectstack/service-notification`.
2. **Ship four built-in channels**: `inbox` (always on), `email`, `webhook` (the existing one, now a channel implementation), `push` (APNs + FCM).
3. **Email becomes a transport sub-system**: SMTP is mandatory baseline (required for air-gapped / on-prem); SendGrid / SES / Resend / Postmark / Aliyun / Tencent register as `EmailTransport` plugins.
4. **Absorb `plugin-email`** into `plugin-notification-email`. Keep `ctx.email.send(...)` as a low-level API for special cases (OTP, password reset) that must bypass user preferences; wrap it as a `NotificationChannel` so flow `notify` nodes get retry/outbox for free.
5. **Other channels (Feishu / DingTalk / WeCom / Slack / SMS / Telegram) ship as community plugins**, all implementing the same `NotificationChannel` interface — no special casing.

Net effect: the `notify` node stops being a no-op; users get a real Inbox; templates that already reference channels in their flow YAML start working without code changes; and the door is open for plugin-based channel extension.

---

## Context

### What's broken (Issue #1292)

Every shipped template has a flow that ends with something like:

```yaml
- type: notify
  recipients: ['{{ approver.email }}']
  message: "Contract {{ contract.code }} needs approval"
```

The flow engine executes the `notify` node, the activity log records it, and **nothing leaves the box**. There is no SMTP call, no in-app inbox row, no webhook fire. Operators discover this only when an approval sits for days because no human was told.

This is a release-blocker for any template that relies on humans receiving signals (contracts, procurement, compliance, helpdesk, todo reminders, content publishing, CRM follow-ups).

### What `plugin-webhooks` already provides (~60% of the work)

`plugin-webhooks` v6.3.0 has, since 2026-Q1, implemented the hard parts of reliable delivery:

| Capability | Where | Notes |
|:---|:---|:---|
| Durable outbox | `sys_webhook_delivery.object.ts` | states: `pending → in_flight → success / failed / dead`; partitioned by `partition_key` |
| Exponential retry | `http-sender.ts` | backoff schedule `1s → 10s → 1m → 10m → 1h → 6h → 24h`, then dead-letter |
| HMAC signing | `http-sender.ts` | `X-Objectstack-Signature` (sha256), `X-Objectstack-Delivery` (uuid), `X-Objectstack-Timestamp` |
| Idempotency | `http-sender.ts` | delivery uuid as `Idempotency-Key`; receivers can dedupe |
| Cluster coordination | `dispatcher.ts` | `cluster.lock(partition_key, ttl=5×tick, default 1.25s)`; safe across replicas |
| Event subscription | `auto-enqueuer.ts` | `data.record.{created,updated,deleted,undeleted}` → enqueue |
| Receiver auth | `webhook-receiver.ts` | verifies inbound signatures; rotates secrets |

This is not a coincidence — it is the same shape any reliable delivery system needs. **The work is to generalize, not to rewrite.**

### What `plugin-email` lacks

`plugin-email` shipped earlier and is the inverse: it has the templates (`sys_email_template`) and a sent-log table (`sys_email`), supports Log / Resend / Postmark transports, and exposes `ctx.email.send(...)`. But it has **no outbox, no retry, no cluster lock, no dead-letter, no bounce/suppression, no preference matrix**. A transient SMTP error or a downed Resend dashboard drops the email permanently. There is also no SMTP transport, which is a hard blocker for on-prem and air-gapped deployments where SaaS providers are not reachable.

### Why "just route everything through webhook" doesn't work

We seriously considered shipping only `plugin-notification-webhook` and pointing email/push/inbox at it. It fails at four boundaries:

1. **Inbox is direction-reversed.** Inbox = "we write a row in our own DB, the user pulls it". There is no outbound HTTP call to make; routing it through webhook is a layer-violating round-trip through the network.
2. **Preferences must live on our side.** "Don't email Bob at night" is a platform decision, not a webhook receiver decision. If the matrix lives downstream, every receiver re-implements it.
3. **Push has a device-token lifecycle.** APNs/FCM tokens expire, get invalidated, and require an *async* feedback channel (token expiry callbacks). A generic webhook can't carry that semantics; the device registry must be in core.
4. **Email needs SMTP for private deploys + audit/compliance.** Air-gapped customers cannot reach SendGrid. A "webhook to SendGrid" approach is also unauditable for SOC2/GDPR — we need first-class sent-logs, bounce handling, and List-Unsubscribe headers under our control.

So: **four built-in channels, all other channels via plugin**.

### How peers solved it

| Platform | Built-in channels | Extension model |
|:---|:---|:---|
| Salesforce | Email, push, in-app, SMS (via Marketing Cloud) | "Notification Builder" + custom types |
| ServiceNow | Email, push, in-app, SMS | Notification preferences per topic; inbound email parsing |
| Jira | Email, in-app, mobile push | Per-user per-event matrix; smart batching |
| Linear | In-app, email, Slack, push | Slack/Discord as first-class integrations; topic-level toggles |
| Slack | In-app (own product), email digest, push | Channel routing rules; quiet hours; DND |
| PagerDuty | Voice, SMS, push, email | Escalation policies; on-call schedules |
| Stripe | Email, webhook, in-app | Webhook is the **primary** integration surface |
| Hasura | Webhook only | Punts to the application layer |

Pattern: the ones that ship to end-users (Salesforce, ServiceNow, Linear, Slack, Jira) all have in-app + email + push as built-ins, with webhook for B2B integration. The ones that target developers only (Stripe, Hasura) lean on webhooks. ObjectStack serves both audiences, so we need both: **built-in for human-facing channels, webhook for everything else, plugin escape hatch for the long tail**.

---

## Goals

* **Fix #1292** — `notify` nodes in shipped templates actually deliver to humans, without per-template wiring.
* **Four built-in channels**: `inbox` (always on, in-app), `email` (SMTP + SaaS transports), `webhook` (B2B integration), `push` (APNs + FCM).
* **One delivery substrate** — outbox / retry / cluster-lock / dead-letter / signing live in `service-notification`; every channel inherits them.
* **Topic + Preference matrix** — users opt out per topic per channel (Slack/Linear pattern); platform-default policies for system-critical topics that cannot be muted (e.g. password reset).
* **Renderer per channel** — same notification, channel-specific body (MJML for email, card JSON for Feishu, 4 KB JSON for push). Plain string is the fallback.
* **Plugin extension** — Feishu / DingTalk / WeCom / Slack / SMS / Telegram / domestic push vendors ship as `NotificationChannel` plugins with zero core change.
* **Email transport sub-system** — SMTP is mandatory and ships in core (private deploy unblock); SendGrid is the SaaS baseline; SES / Resend / Postmark / Aliyun / Tencent register as `EmailTransport` plugins.
* **Absorb `plugin-email`** — keep `ctx.email.send(...)` as a low-level escape hatch for system mail (OTP / password reset that must bypass preferences), but wrap it as a `NotificationChannel` so flow `notify` reuses outbox/retry.
* **Operational parity with webhook** — every channel exposes the same observability surface (`sys_*_delivery` table, dead-letter UI, retry button, metrics).

## Non-Goals

* **Digest / quiet-hours / dedup** as a finished feature in M1. We define the `DeliveryMiddleware` interface and a stub registry, but only ship a no-op middleware. Real digest engines (hourly rollups, "don't ping me again about this") are M2+.
* **Recipient resolver DSL** in M1. We define the interface (`role:approver`, `oncall:incident`, `owner_of:contract`) but only ship a trivial "explicit list + role lookup" resolver. Complex resolvers come from `service-permissions` / `service-oncall` later.
* **Domestic mobile push vendors** (HMS / Xiaomi / OPPO / VIVO). Schema reserves a `vendor` discriminator on `sys_user_device`, but only APNs and FCM ship in core. Domestic vendors are plugin transports.
* **Inbound email parsing** ("reply to this email to comment on the ticket"). The `EmailTransport` interface is send-only in M1. A parallel `EmailIngest` surface is a later ADR.
* **SMS as a built-in channel.** SMS routes through `plugin-notification-webhook` to Twilio / Aliyun SMS / Tencent SMS, or as a community `plugin-notification-sms` if demand justifies it. Carriers vary too much by region to bake in.
* **In-app real-time push to the browser.** Inbox writes rows; the existing `service-realtime` (websocket) layer decides when to ping the UI. That seam is unchanged.
* **Replacing `ToolRegistry`-style AI tool exposure for "send a notification".** ADR-0011 already covers exposing actions to LLMs; "send_notification" is just another action that opts in.

---

## Proposed Design

### 1. Five-layer architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1 — Event                                                 │
│   data.record.{created,updated,deleted}  /  flow.notify.emit    │
│   approval.requested  /  custom.app.event  /  ai.tool.call      │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Layer 2 — Notification                                          │
│   sys_notification          (topic, payload, severity, dedupKey)│
│   sys_notification_template (per-topic per-channel renderers)   │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Layer 3 — Subscription + Preference                             │
│   sys_notification_topic            (catalog; muteable: bool)   │
│   sys_notification_subscription     (who subscribes to what)    │
│   sys_notification_preference       (user × topic × channel)    │
│   RecipientResolver  (role:approver, owner_of:X, oncall:Y)      │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Layer 4 — Delivery (the generalized outbox)                     │
│   sys_notification_delivery   (pending→in_flight→success/failed/│
│                                dead, partition_key, attempts)   │
│   DeliveryMiddleware chain    (digest, quiet-hours, dedup)      │
│   NotificationChannel impls   (inbox, email, webhook, push, …)  │
│   service-notification dispatcher  (cluster.lock per partition) │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Layer 5 — Inbox + Receipt                                       │
│   sys_inbox_message      (user-facing in-app rows)              │
│   sys_email              (sent log; ties to delivery)           │
│   sys_email_suppression  (bounce / unsubscribe list)            │
│   sys_user_device        (APNs/FCM tokens; lifecycle hooks)     │
│   sys_notification_receipt (read/clicked/dismissed per channel) │
└─────────────────────────────────────────────────────────────────┘
```

Every layer has a stable seam. A custom channel (e.g. `plugin-notification-feishu`) plugs in at Layer 4 by implementing `NotificationChannel`. A custom resolver plugs in at Layer 3. A custom renderer plugs in between Layer 2 and Layer 4.

### 2. The `NotificationChannel` interface

```ts
// packages/spec/src/notification/channel.zod.ts
export interface NotificationChannel {
  /** Stable id: 'inbox' | 'email' | 'webhook' | 'push' | 'feishu' | ... */
  readonly id: string;

  /** Capabilities the dispatcher needs to know before scheduling. */
  readonly capabilities: {
    /** Channel accepts a list of recipients per delivery, or one each. */
    batching: 'per_recipient' | 'batch';
    /** Hard payload-size cap (push = 4 KB, email = ~10 MB, webhook = configurable). */
    maxPayloadBytes: number;
    /** Whether channel needs HMAC signing of outbound payloads. */
    signsPayload: boolean;
    /** Whether channel can report async failure (bounces, token-expiry). */
    asyncFeedback: boolean;
  };

  /**
   * Translate a Notification + recipient set into concrete addresses.
   * Returns one Address per delivery the dispatcher should enqueue.
   * For inbox: returns user_id. For email: email address. For push: device tokens.
   * For webhook: receiver URL + secret.
   */
  resolveAddresses(
    ctx: ChannelContext,
    notification: Notification,
    recipients: ResolvedRecipient[],
  ): Promise<Address[]>;

  /**
   * Perform a single delivery attempt. The dispatcher has already locked the
   * partition, checked preferences, applied middleware, and rendered the body.
   * Channel only does the I/O.
   */
  send(ctx: ChannelContext, delivery: Delivery): Promise<SendResult>;

  /**
   * Classify a thrown error so the dispatcher knows what to do:
   *   'retryable'         → backoff and retry
   *   'permanent'         → dead-letter immediately
   *   'invalid_recipient' → mark address as bad (suppress / invalidate device)
   *   'rate_limited'      → respect Retry-After header
   */
  classifyError(err: unknown): ErrorClass;
}
```

The four built-in channels each implement this; everything they do that is *not* in this interface (retry, lock, signing, outbox writes) is handled by `service-notification`.

### 3. `service-notification` — the extracted core

Created by lifting `dispatcher.ts` / outbox state machine / cluster lock from `plugin-webhooks` and rewriting them against the abstract `NotificationChannel`:

```
packages/services/service-notification/
├── dispatcher.ts          (was plugin-webhooks/src/dispatcher.ts)
├── outbox.ts              (state machine for sys_notification_delivery)
├── channel-registry.ts    (DI registration point for NotificationChannel)
├── device-registry.ts     (sys_user_device CRUD + invalidation hooks)
├── transport-registry.ts  (for sub-channels like EmailTransport)
├── renderer-registry.ts   (per-channel renderer lookup)
├── recipient-resolver.ts  (stub resolver in M1; pluggable)
├── middleware/
│   ├── digest.stub.ts     (interface only; no-op in M1)
│   ├── quiet-hours.stub.ts
│   └── dedup.stub.ts
└── index.ts
```

The dispatcher is no longer webhook-aware. It pulls a `pending` delivery row, calls `channelRegistry.get(row.channel_id).send(...)`, applies `classifyError`, writes the next state. `plugin-webhooks` keeps only its HTTP-specific code (signing, receiver auth, the configurable URL list) and registers itself as the `webhook` channel.

### 4. Built-in channel implementations

| Channel | Package | Backend | M1 status |
|:---|:---|:---|:---|
| `inbox` | `plugin-notification-inbox` | Writes to `sys_inbox_message`; fires `service-realtime` event for online users | **MUST ship M1** |
| `email` | `plugin-notification-email` (replaces `plugin-email`) | SMTP + transport plugins (SendGrid baseline) | **MUST ship M1** |
| `webhook` | `plugin-notification-webhook` (extracted from `plugin-webhooks`) | HTTP POST with HMAC | **MUST ship M1** (port existing) |
| `push` | `plugin-notification-push` | APNs (HTTP/2) + FCM (HTTP v1) | **MUST ship M1** |

All four bind into `channel-registry` during `onEnable`.


### 5. Email transport sub-system

Email is special because the wire protocol (SMTP) is mandatory for some customers and the SaaS providers (SendGrid, SES, Resend, Postmark, Aliyun DM, Tencent SES) have non-trivial differences in auth, bounce handling, and rate limits. Treating each provider as its own channel would multiply the matrix; treating them all as one `email` channel with pluggable transports keeps the user-facing surface clean.

```ts
// packages/spec/src/notification/transport.zod.ts
export interface EmailTransport {
  /** 'smtp' | 'sendgrid' | 'ses' | 'resend' | 'postmark' | 'aliyun_dm' | … */
  readonly id: string;

  /** Provider-specific Zod schema for sys_email_transport.config column. */
  readonly configSchema: ZodSchema;

  send(ctx: TransportContext, mail: EmailMessage): Promise<TransportResult>;

  /** Map provider error → ErrorClass for dispatcher; e.g. SES throttle → rate_limited. */
  classifyError(err: unknown): ErrorClass;

  /**
   * Optional: handle provider webhook callback (bounce / complaint).
   * If present, plugin registers a route; dispatcher consumes the parsed
   * BounceEvent and writes to sys_email_suppression.
   */
  ingestBounceWebhook?(ctx: TransportContext, payload: unknown): Promise<BounceEvent[]>;
}
```

**M1 ships `smtp` and `sendgrid` transports in core**. SMTP is non-negotiable for on-prem/air-gapped (`@nestjs/microservices`-style transport using `nodemailer`). SendGrid is the SaaS baseline because it covers 80% of cloud customers. Everything else (`ses`, `resend`, `postmark`, `aliyun_dm`, `tencent_ses`, `mailgun`) is a transport plugin published from the same monorepo or third-party.

Selection is per-environment, set in `sys_email_transport`:

```yaml
# default-env's manifest
email_transport:
  id: smtp
  config: { host: smtp.corp.example, port: 587, user: ..., from: 'no-reply@corp.example' }
```

The `email` channel does not know what transport is used; it asks `transport-registry.get(env.email_transport.id)`.

### 6. Push channel — device lifecycle

Push has two things the others don't: a **device registry** and an **invalidation feedback loop**.

```ts
// packages/spec/src/notification/device.zod.ts
export const UserDeviceSchema = z.object({
  user_id:    z.string(),
  device_id:  z.string(),              // client-generated, stable per app install
  vendor:     z.enum(['apns','fcm','hms','xiaomi','oppo','vivo','web_push']),
  token:      z.string(),              // APNs token / FCM token / VAPID endpoint
  app_id:     z.string(),              // bundle / sender id
  platform:   z.enum(['ios','android','web','macos','windows']),
  locale:     z.string().optional(),
  enabled:    z.boolean().default(true),
  invalidated_at: z.string().optional(),// when provider reported token dead
  last_seen_at:   z.string().optional(),
});
```

Lifecycle hooks:

* Client SDK calls `POST /api/v1/notifications/devices` on login → `device-registry.upsert(...)`.
* APNs / FCM `BadDeviceToken` / `Unregistered` response → channel returns `classifyError = 'invalid_recipient'` → dispatcher calls `device-registry.invalidate(token)` (sets `invalidated_at`, `enabled=false`) without dead-lettering the notification (it just routes around the dead token).
* Domestic vendors (HMS / Xiaomi / OPPO / VIVO) plug in as **alternate channel implementations** (`plugin-notification-push-hms` etc.), not as transports — their on-device SDKs and quotas are too different to share a code path.

### 7. Topic + Preference matrix

```ts
// packages/spec/src/notification/topic.zod.ts
export const NotificationTopicSchema = z.object({
  name:        z.string().regex(/^[a-z_][a-z0-9_]*$/),   // 'contract.approval_requested'
  label:       z.string(),
  description: z.string().optional(),
  category:    z.string().optional(),                    // 'contracts' for grouping in UI
  severity:    z.enum(['info','warning','critical']).default('info'),
  /** If true, users cannot mute this topic (password reset, security alerts). */
  mandatory:   z.boolean().default(false),
  /** Default channels for users who haven't set preferences. */
  default_channels: z.array(z.string()).default(['inbox']),
});

// packages/spec/src/notification/preference.zod.ts
export const NotificationPreferenceSchema = z.object({
  user_id:  z.string(),
  topic:    z.string(),
  channel:  z.string(),
  enabled:  z.boolean(),
  // Future: quiet_hours, digest_window — schema reserves the column, M1 ignores.
});
```

The dispatcher resolves recipients → fans out per channel → for each `(user, channel)` pair, checks `mandatory || preference.enabled || (no row && topic.default_channels.includes(channel))`. Anything that doesn't pass is dropped at this layer, *not* in the channel — so we get one place to audit "why didn't Bob get the email".

### 8. Renderer interface

```ts
// packages/spec/src/notification/renderer.zod.ts
export interface NotificationRenderer<TPayload, TBody> {
  readonly topic:   string;           // 'contract.approval_requested' or '*'
  readonly channel: string;           // 'email' | 'inbox' | 'push' | …
  render(payload: TPayload, ctx: RenderContext): Promise<TBody>;
}
```

Channel-specific body shapes:

| Channel | TBody |
|:---|:---|
| inbox  | `{ title, body_md, action_url, severity, icon }` |
| email  | `{ subject, html (from MJML compile), text, attachments?, headers? }` |
| webhook | `{ event, payload_json }` — same shape `plugin-webhooks` already uses |
| push   | `{ title, body, data, sound?, badge? }` ≤ 4 KB; channel enforces |

Templates live in `sys_notification_template (topic, channel, version, body, locale)`. Authors can ship per-template-per-channel; if a channel is missing a template, the dispatcher falls back to a generic renderer that uses `notification.title` / `notification.body_md`.

### 9. `plugin-email` absorption path

The existing `plugin-email` is **not** deleted in M1. It is renamed and refactored:

1. **Rename package** `@objectstack/plugin-email` → `@objectstack/plugin-notification-email`. Keep `@objectstack/plugin-email` as a deprecated alias that re-exports (M1 only; removed in next major).
2. **Keep `ctx.email.send(...)`** as the low-level API for system-critical mail (OTP, password reset, magic links). This bypasses the preference matrix because `mandatory:true` topics shouldn't even get there. Implementation routes through the same `service-notification` outbox so retries are inherited.
3. **Wrap with `NotificationChannel`**: register a `'email'` channel that internally calls the same transport sub-system; `notify` nodes in flows go through topic/preference/render and then end up in the same outbox row.
4. **Migrate tables**: `sys_email` (sent log) and `sys_email_template` stay, with `sys_email.delivery_id` FK added to tie back to `sys_notification_delivery`. Add new `sys_email_suppression` and `sys_email_transport`.
5. **Existing transports** (`log`, `resend`, `postmark`) move into `transport-registry` unchanged; new `smtp` and `sendgrid` join them.

No app code that calls `ctx.email.send(...)` breaks. Anything that previously bypassed the outbox now silently inherits durability.


### 10. Schema list — `packages/spec/src/notification/`

Per CLAUDE.md Prime Directive 8 ("one Zod source per metadata type"), every concept gets exactly one Zod file:

| File | Purpose |
|:---|:---|
| `channel.zod.ts` | `NotificationChannelSchema` (channel descriptor + capabilities) |
| `transport.zod.ts` | `EmailTransportSchema` (and future per-channel transport descriptors) |
| `template.zod.ts` | `NotificationTemplateSchema` (per topic × channel × locale × version) |
| `topic.zod.ts` | `NotificationTopicSchema` (catalog + mandatory flag + default channels) |
| `preference.zod.ts` | `NotificationPreferenceSchema` (user × topic × channel matrix) |
| `notification.zod.ts` | `NotificationSchema` (the wire-level message: topic, payload, severity, dedup_key) |
| `delivery.zod.ts` | `NotificationDeliverySchema` (outbox row: state machine, attempts, partition_key) |
| `device.zod.ts` | `UserDeviceSchema` (push device registry with vendor discriminator) |
| `email-suppression.zod.ts` | `EmailSuppressionSchema` (bounce + unsubscribe list) |
| `renderer.zod.ts` | `RendererDescriptorSchema` (registry entry; runtime interface lives in `service-notification`) |
| `recipient-resolver.zod.ts` | `RecipientResolverDescriptorSchema` (registry entry; resolver impl is runtime code) |
| `middleware.zod.ts` | `DeliveryMiddlewareDescriptorSchema` (digest/quiet-hours/dedup stubs) |
| `index.ts` | Re-exports under `Notification` namespace |

These join the existing namespace exports as `import { Notification } from '@objectstack/spec'`.

### 11. Object tables (singular metadata type, `sys_` prefix per Prime Directive 7)

| Table | Owner | Purpose |
|:---|:---|:---|
| `sys_notification` | service-notification | One row per emitted notification (pre-fan-out). Holds payload, topic, severity, dedup_key. |
| `sys_notification_topic` | service-notification | Catalog of known topics. Seeded from `defineTopic(...)` in plugins. |
| `sys_notification_template` | service-notification | Per topic × channel × locale × version. MJML for email, JSON for others. |
| `sys_notification_subscription` | service-notification | Who is subscribed to which topic (system-wide, role-based, or explicit). |
| `sys_notification_preference` | service-notification | User × topic × channel toggles. |
| `sys_notification_delivery` | service-notification | The outbox. State machine + partition_key + attempts. |
| `sys_notification_receipt` | service-notification | Per-channel read/clicked/dismissed. Populated by inbox UI + webhook callbacks where supported. |
| `sys_inbox_message` | plugin-notification-inbox | User-facing in-app messages. Indexed by `(user_id, created_at desc)`. |
| `sys_user_device` | plugin-notification-push | Push device registry. |
| `sys_email` | plugin-notification-email | Sent-log (existed; gains `delivery_id` FK). |
| `sys_email_template` | plugin-notification-email | Existed; refactored to share schema with `sys_notification_template`. |
| `sys_email_suppression` | plugin-notification-email | Bounce / complaint / unsubscribe list. Address-keyed. |
| `sys_email_transport` | plugin-notification-email | Per-environment transport selection + provider config. |
| `sys_webhook` | plugin-notification-webhook | Existed (renamed seam unchanged). |
| `sys_webhook_delivery` | plugin-notification-webhook | Existed; transitions to using `sys_notification_delivery` view in M2. |

### 12. Wire-up — how a `notify` node ends up delivered

```
flow.notify({ topic: 'contract.approval_requested', recipients: ['role:approver'], payload: {...} })
    │
    ▼
service-notification.emit(notification)
    │  writes sys_notification row, sets dedup_key
    ▼
RecipientResolver.resolve('role:approver', ctx) → [user_42, user_57]
    │
    ▼
for each user × default-or-preferred channels:
    check preference matrix  →  build sys_notification_delivery row(s)
    │
    ▼
DeliveryMiddleware.before(delivery)  (M1: no-op; M2: digest/quiet-hours)
    │
    ▼
dispatcher loop:
    cluster.lock(partition_key)
    renderer.render(payload, channel)  →  body
    channel.send(delivery)
    on retryable → outbox.scheduleRetry(backoff[attempt])
    on permanent → outbox.deadLetter
    on invalid_recipient → suppression/device invalidation, drop without dead-lettering
```

### 13. Observability

Every channel gets the same Studio surface (built once in `service-notification`):

* **Deliveries view** — filter by channel / topic / state / time range; columns: state, attempts, last_error, next_retry_at, partition_key.
* **Dead-letter inspector** — view payload, replay button, bulk-replay.
* **Metrics** — `notification.delivery.{enqueued,sent,failed,dead}` counters tagged by `channel` and `topic`; `notification.delivery.duration_ms` histogram.
* **Per-user audit** — "why didn't Bob get this?" answers: matched preference row, middleware drops, render errors, channel errors.


---

## Milestones

### M1 — close #1292 (target: this release)

* `packages/spec/src/notification/` with the 12 Zod files above.
* `packages/services/service-notification/` extracted from `plugin-webhooks` dispatcher.
* `plugin-notification-inbox` — writes `sys_inbox_message`, fires realtime ping.
* `plugin-notification-email` — absorbs `plugin-email`; ships `smtp` + `sendgrid` transports + existing `log`/`resend`/`postmark` migrated.
* `plugin-notification-webhook` — `plugin-webhooks` becomes a channel implementation; no functional change for existing receivers.
* `plugin-notification-push` — APNs HTTP/2 + FCM HTTP v1; `sys_user_device` lifecycle.
* `notify` flow node wired to `service-notification.emit(...)`.
* `defineTopic(...)` builder + seeded catalog for the 7 shipped templates.
* Recipient resolver: explicit list + `role:*` + `owner_of:*` (anything else falls back to `[]`).
* `DeliveryMiddleware` interface present, no-op middlewares registered.
* Studio "Deliveries" + "Dead-letter" page (built once, used by all 4 channels).
* Migration: `plugin-email` → `plugin-notification-email` alias re-export, `sys_email.delivery_id` FK populated for new mail; old `sys_email` rows untouched.

### M2 — make it pleasant

* Real digest middleware (per-user hourly/daily rollup, configurable).
* Real quiet-hours middleware (timezone-aware; mandatory topics bypass).
* Real dedup middleware (dedup_key + window).
* Studio UI for end-user preference matrix.
* Bounce ingestion endpoints for SES / Resend / Postmark / SendGrid → `sys_email_suppression`.
* List-Unsubscribe header + one-click unsubscribe endpoint.

### M3 — long-tail channels & advanced

* `plugin-notification-feishu` / `dingtalk` / `wecom` / `slack` (community-owned).
* `plugin-notification-sms` with Twilio / Aliyun-SMS / Tencent-SMS transports.
* Domestic push: HMS / Xiaomi / OPPO / VIVO as channel plugins.
* Inbound email parsing (`EmailIngest`) — separate ADR.
* Escalation policies + on-call schedules (depends on `service-oncall`).

---

## Acceptance criteria (mapping to #1292)

| #1292 checklist item | M1 deliverable |
|:---|:---|
| `notify` node emits a real delivery | `service-notification.emit(...)` writes `sys_notification` + fans out `sys_notification_delivery` rows |
| Inbox channel works | `plugin-notification-inbox` + `sys_inbox_message` + `GET /api/v1/notifications/inbox` |
| Email channel works on private deploys | `smtp` transport ships in core; `email_transport: { id: 'smtp', ... }` in env manifest |
| Email channel works on cloud | `sendgrid` transport ships in core; SES/Resend/Postmark as transport plugins |
| Webhook channel keeps working | `plugin-notification-webhook` is the existing `plugin-webhooks` repackaged; receivers unchanged |
| Push channel works | APNs + FCM in `plugin-notification-push`; `sys_user_device` lifecycle |
| User can opt out | `sys_notification_preference` matrix; mandatory topics bypass |
| Failures don't disappear | Outbox + retry schedule + dead-letter + Studio inspector |
| Templates render per channel | `sys_notification_template (topic, channel, locale, version)` + `RendererRegistry` |
| Plugins can add channels | Public `NotificationChannel` interface + `channel-registry.register(...)` |
| Plugins can add email providers | Public `EmailTransport` interface + `transport-registry.register(...)` |

---

## Risks & open questions

1. **Plugin-webhooks → plugin-notification-webhook rename.** Existing apps import `@objectstack/plugin-webhooks`. M1 keeps it as a deprecated alias; M2 may break. Decision: **alias for one major, hard break after**.
2. **`sys_email` schema drift.** Existing `plugin-email` writes a sent-log row directly. After absorption, writes route through outbox. We add `delivery_id` nullable and backfill nothing — old rows stay readable, new rows tie to delivery.
3. **MJML compile at runtime vs. at template-save time.** Lean toward save-time (cache compiled HTML in `sys_notification_template.compiled_html`) to avoid CPU per send. M1 can compile on send; M2 caches.
4. **Inbox cardinality.** A noisy app could write millions of `sys_inbox_message` rows. We add retention config per topic (`retain_days`, default 90) and a daily cleanup job. M1 ships retention column; cleanup job is M2.
5. **Push payload encryption (Web Push VAPID).** Out of scope for M1; FCM and APNs only.
6. **Multi-environment fan-out.** A notification emitted in env A must not leak to a user in env B. Resolver MUST scope by `environment_id`; preference rows are environment-local. Cross-env notifications require a future federation ADR.
7. **GDPR / CAN-SPAM.** Email channel must include `List-Unsubscribe` + physical address footer hook in templates. M1 includes the header column; M2 builds the one-click endpoint.

---

## Decision

Adopt the design above. Specifically:

* **Four built-in channels**: `inbox`, `email`, `webhook`, `push` — all implementing `NotificationChannel`.
* **One generalized dispatcher** in `@objectstack/service-notification`, extracted from `plugin-webhooks`.
* **Email transport sub-system**: `smtp` and `sendgrid` in core; others as `EmailTransport` plugins.
* **`plugin-email` absorbed** into `plugin-notification-email` with a deprecated alias for one major.
* **All other channels via plugin** implementing the same interface; no special casing.

This closes #1292 in M1 without locking us into ServiceNow-style monoliths or Stripe-style "punt to the client" minimalism. The seams are stable enough for the M2/M3 enhancements without re-architecting.
