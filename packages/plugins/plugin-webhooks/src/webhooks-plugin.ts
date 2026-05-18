// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import crypto from 'node:crypto';
import type { Plugin, PluginContext } from '@objectstack/core';
import type {
  IRealtimeService,
  RealtimeEventPayload,
  RealtimeSubscriptionOptions,
} from '@objectstack/spec/contracts';

/**
 * A single webhook delivery target.
 */
export interface WebhookSink {
  /** Unique sink id used for log correlation. */
  id: string;
  /** Target HTTPS URL. */
  url: string;
  /** Optional HMAC-SHA256 secret. When set, `X-Objectstack-Signature: sha256=…` is added. */
  secret?: string;
  /**
   * Restrict to specific object names (logical names, e.g. `lead`, `account`).
   * Omit / empty → all objects.
   */
  objects?: string[];
  /**
   * Restrict to specific event types. Omit / empty → all `data.record.*` events.
   */
  eventTypes?: string[];
  /** Extra headers to send (Authorization, Tenant, etc.). */
  headers?: Record<string, string>;
  /** Per-request timeout in milliseconds. Default 5000. */
  timeoutMs?: number;
  /** Retry attempts on transient failure. Default 3. Set 0 to disable retries. */
  retries?: number;
}

/**
 * Delivery attempt outcome surfaced to in-process listeners / tests.
 */
export type WebhookDeliveryStatus = 'ok' | 'retrying' | 'failed';

export interface WebhookDeliveryRecord {
  sinkId: string;
  url: string;
  eventType: string;
  object?: string;
  status: WebhookDeliveryStatus;
  httpStatus?: number;
  attempt: number;
  error?: string;
}

/**
 * Plugin configuration.
 *
 * Sinks may be supplied programmatically OR via env vars when none are
 * passed (suitable for 12-factor / Docker deployments):
 *
 *   OBJECTSTACK_WEBHOOK_URL       — single URL, or comma-separated URLs.
 *   OBJECTSTACK_WEBHOOK_SECRET    — HMAC secret applied to all env-sourced URLs.
 *   OBJECTSTACK_WEBHOOK_OBJECTS   — comma-separated object whitelist.
 *   OBJECTSTACK_WEBHOOK_EVENTS    — comma-separated event-type whitelist
 *                                   (e.g. `data.record.created`).
 */
export interface WebhooksPluginOptions {
  /** Explicit sink list (takes precedence over env vars). */
  sinks?: WebhookSink[];
  /** Override fetch (mainly for tests). Defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
  /** Hook invoked with each delivery outcome (mainly for tests / metrics). */
  onDelivery?: (record: WebhookDeliveryRecord) => void;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_RETRIES = 3;
const BACKOFF_BASE_MS = 250;
const BACKOFF_MAX_MS = 5_000;

/**
 * WebhooksPlugin — fan out data.record.* events to external HTTP endpoints.
 *
 * @example
 * ```ts
 * kernel.use(new WebhooksPlugin({
 *   sinks: [
 *     { id: 'crm-sync', url: 'https://hooks.example.com/in',
 *       secret: process.env.HOOK_SECRET, objects: ['lead', 'account'] },
 *   ],
 * }));
 * ```
 */
export class WebhooksPlugin implements Plugin {
  name = 'com.objectstack.webhooks';
  version = '1.0.0';
  type = 'standard';
  dependencies = ['com.objectstack.service.realtime'];

  private readonly options: WebhooksPluginOptions;
  private subscriptionIds: string[] = [];
  private realtime?: IRealtimeService;
  private sinks: WebhookSink[] = [];
  private logger?: PluginContext['logger'];

  constructor(options: WebhooksPluginOptions = {}) {
    this.options = options;
  }

  async init(ctx: PluginContext): Promise<void> {
    this.logger = ctx.logger;
    this.sinks = this.resolveSinks();
    if (this.sinks.length === 0) {
      ctx.logger.info(
        'WebhooksPlugin: no sinks configured (options.sinks empty and OBJECTSTACK_WEBHOOK_URL unset) — plugin is dormant',
      );
      return;
    }
    ctx.logger.info(`WebhooksPlugin: ${this.sinks.length} sink(s) configured`);
  }

  async start(ctx: PluginContext): Promise<void> {
    if (this.sinks.length === 0) return;
    ctx.hook('kernel:ready', async () => {
      try {
        this.realtime = ctx.getService<IRealtimeService>('realtime');
      } catch {
        ctx.logger.warn('WebhooksPlugin: realtime service unavailable — events will not be forwarded');
        return;
      }

      // We subscribe once per sink so the realtime service can apply each
      // sink's object / eventTypes filter at the channel layer where
      // possible. This also lets us cleanly unsubscribe on stop().
      for (const sink of this.sinks) {
        const opts: RealtimeSubscriptionOptions | undefined =
          (sink.objects && sink.objects.length === 1) ||
          (sink.eventTypes && sink.eventTypes.length > 0)
            ? {
                ...(sink.objects && sink.objects.length === 1 ? { object: sink.objects[0] } : {}),
                ...(sink.eventTypes && sink.eventTypes.length > 0 ? { eventTypes: sink.eventTypes } : {}),
              }
            : undefined;
        const id = await this.realtime.subscribe(
          'data.record',
          async (event) => { await this.dispatch(sink, event); },
          opts,
        );
        this.subscriptionIds.push(id);
      }
      ctx.logger.info(`WebhooksPlugin: subscribed ${this.subscriptionIds.length} realtime listener(s)`);
    });
  }

  async stop(ctx: PluginContext): Promise<void> {
    if (!this.realtime) return;
    for (const id of this.subscriptionIds) {
      try { await this.realtime.unsubscribe(id); }
      catch (err) { ctx.logger.debug('WebhooksPlugin: unsubscribe failed', { id, err }); }
    }
    this.subscriptionIds = [];
  }

  /**
   * Resolve sinks from constructor options, falling back to env vars when
   * none provided. Exposed for testing.
   */
  private resolveSinks(): WebhookSink[] {
    if (this.options.sinks && this.options.sinks.length > 0) return this.options.sinks;

    const urlEnv = process.env.OBJECTSTACK_WEBHOOK_URL;
    if (!urlEnv) return [];

    const urls = urlEnv.split(',').map(s => s.trim()).filter(Boolean);
    const secret = process.env.OBJECTSTACK_WEBHOOK_SECRET;
    const objectsEnv = process.env.OBJECTSTACK_WEBHOOK_OBJECTS;
    const eventsEnv = process.env.OBJECTSTACK_WEBHOOK_EVENTS;
    const objects = objectsEnv ? objectsEnv.split(',').map(s => s.trim()).filter(Boolean) : undefined;
    const eventTypes = eventsEnv ? eventsEnv.split(',').map(s => s.trim()).filter(Boolean) : undefined;

    return urls.map((url, idx) => ({
      id: `env-${idx + 1}`,
      url,
      ...(secret ? { secret } : {}),
      ...(objects ? { objects } : {}),
      ...(eventTypes ? { eventTypes } : {}),
    }));
  }

  /**
   * Dispatch a single event to a sink, with HMAC signing, timeout, and
   * exponential-backoff retry. Failures past the retry budget are logged
   * but never thrown — webhook delivery must never break the originating
   * mutation.
   */
  private async dispatch(sink: WebhookSink, event: RealtimeEventPayload): Promise<void> {
    // Defence in depth: the realtime layer already filters by single-object
    // subscriptions, but multi-object whitelists are applied here.
    if (sink.objects && sink.objects.length > 0 && event.object && !sink.objects.includes(event.object)) {
      return;
    }
    if (sink.eventTypes && sink.eventTypes.length > 0 && !sink.eventTypes.includes(event.type)) {
      return;
    }

    const fetchImpl = this.options.fetchImpl ?? globalThis.fetch;
    if (!fetchImpl) {
      this.logger?.warn('WebhooksPlugin: no fetch implementation available — dropping event', { sinkId: sink.id });
      return;
    }

    const body = JSON.stringify(event);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ObjectStack-Webhooks/1.0',
      'X-Objectstack-Event': event.type,
      ...(event.object ? { 'X-Objectstack-Object': event.object } : {}),
      'X-Objectstack-Delivery': crypto.randomUUID(),
      ...(sink.headers ?? {}),
    };
    if (sink.secret) {
      const sig = crypto.createHmac('sha256', sink.secret).update(body).digest('hex');
      headers['X-Objectstack-Signature'] = `sha256=${sig}`;
    }

    const timeoutMs = sink.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxAttempts = (sink.retries ?? DEFAULT_RETRIES) + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetchImpl(sink.url, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok || (res.status >= 400 && res.status < 500)) {
          // 4xx is "permanent" — don't retry; only 2xx counts as success.
          const status: WebhookDeliveryStatus = res.ok ? 'ok' : 'failed';
          this.options.onDelivery?.({
            sinkId: sink.id, url: sink.url, eventType: event.type,
            object: event.object, status, httpStatus: res.status, attempt,
          });
          if (status === 'failed') {
            this.logger?.warn('WebhooksPlugin: sink rejected event', {
              sinkId: sink.id, status: res.status, eventType: event.type,
            });
          }
          return;
        }
        // 5xx → fall through to retry.
        if (attempt === maxAttempts) {
          this.options.onDelivery?.({
            sinkId: sink.id, url: sink.url, eventType: event.type, object: event.object,
            status: 'failed', httpStatus: res.status, attempt,
          });
          this.logger?.warn('WebhooksPlugin: max retries exhausted', {
            sinkId: sink.id, status: res.status, eventType: event.type,
          });
          return;
        }
        this.options.onDelivery?.({
          sinkId: sink.id, url: sink.url, eventType: event.type, object: event.object,
          status: 'retrying', httpStatus: res.status, attempt,
        });
      } catch (err: any) {
        clearTimeout(timer);
        const errMessage = err?.name === 'AbortError'
          ? `timeout after ${timeoutMs}ms`
          : (err?.message ?? String(err));
        if (attempt === maxAttempts) {
          this.options.onDelivery?.({
            sinkId: sink.id, url: sink.url, eventType: event.type, object: event.object,
            status: 'failed', attempt, error: errMessage,
          });
          this.logger?.warn('WebhooksPlugin: delivery failed', {
            sinkId: sink.id, eventType: event.type, error: errMessage,
          });
          return;
        }
        this.options.onDelivery?.({
          sinkId: sink.id, url: sink.url, eventType: event.type, object: event.object,
          status: 'retrying', attempt, error: errMessage,
        });
      }
      // Exponential backoff with full jitter.
      const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (attempt - 1));
      const jittered = Math.floor(Math.random() * delay);
      await new Promise(r => setTimeout(r, jittered));
    }
  }
}
