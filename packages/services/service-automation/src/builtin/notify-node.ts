// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { PluginContext } from '@objectstack/core';
import type { AutomationContext } from '@objectstack/spec/contracts';
import { defineActionDescriptor } from '@objectstack/spec/automation';
import type { AutomationEngine } from '../engine.js';
import { interpolate, type VariableMap } from './template.js';

/**
 * Structural view of `@objectstack/service-messaging`'s service (ADR-0012),
 * declared locally so service-automation does not take a runtime dependency on
 * it — mirrors the `ConnectorRegistrySurface` pattern. The `notify` node
 * resolves whatever object is registered under the `messaging` service and
 * dispatches through this shape; if no such service is present the node
 * degrades to a no-op success.
 */
export interface MessagingServiceSurface {
    emit(input: {
        topic: string;
        audience: string[];
        payload?: Record<string, unknown>;
        severity?: string;
        dedupKey?: string;
        source?: { object: string; id: string };
        actorId?: string;
        channels?: string[];
    }): Promise<{ notificationId: string; delivered: number; failed: number }>;
}

/** Coerce a config value (string | string[]) into a clean string[]. */
function toStringList(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
    if (typeof value === 'string' && value.trim()) return [value.trim()];
    return [];
}

/** Coerce an interpolated config value to a non-empty trimmed string, else undefined. */
function toStr(value: unknown): string | undefined {
    if (value == null) return undefined;
    const s = String(value).trim();
    return s.length > 0 ? s : undefined;
}

/**
 * Resolve the click-through target record from the node config, if any.
 *
 * Accepts the flat `sourceObject`/`sourceId` keys (canonical — mirrors the
 * `sys_notification.source_object`/`source_id` columns) or the nested
 * `source: { object, id }` form (mirrors the messaging `emit()` surface). A
 * target is produced only when BOTH object and id resolve — a half-specified
 * link is dropped so the inbox never renders a dead deep-link.
 */
function resolveSource(
    cfg: Record<string, unknown>,
    variables: VariableMap,
    context: AutomationContext,
): { object: string; id: string } | undefined {
    const src = (cfg.source ?? null) as { object?: unknown; id?: unknown } | null;
    const object = toStr(interpolate(cfg.sourceObject ?? src?.object, variables, context));
    const id = toStr(interpolate(cfg.sourceId ?? src?.id, variables, context));
    return object && id ? { object, id } : undefined;
}

/**
 * `notify` built-in node (ADR-0012) — outbound notification.
 *
 * Baseline node and the human-notification counterpart to `http`
 * ("raw call") and `connector_action` ("call a registered integration"):
 * `notify` hands a topic + recipients + message to the platform's messaging
 * service, which fans it out across the user's channels (inbox by default).
 *
 * Like the CRUD nodes degrade without a data engine, `notify` degrades to a
 * warning + success when no `messaging` service is registered — the capability
 * simply isn't installed in that stack. Install `MessagingServicePlugin`
 * (`@objectstack/service-messaging`) and the same flow starts delivering, with
 * no flow edit. This is the seam that fixes the "notify drops on the floor"
 * gap (#1292) once messaging is present.
 */
export function registerNotifyNode(engine: AutomationEngine, ctx: PluginContext): void {
    const getMessaging = (): MessagingServiceSurface | undefined => {
        try {
            return ctx.getService<MessagingServiceSurface>('messaging');
        } catch {
            return undefined;
        }
    };

    engine.registerNodeExecutor({
        type: 'notify',
        descriptor: defineActionDescriptor({
            type: 'notify', version: '1.0.0', name: 'Notify',
            description: 'Send an outbound notification to users via the messaging service (inbox / email / push / …).',
            icon: 'bell', category: 'io', source: 'builtin',
            supportsRetry: true,
            // Delivery is outbox-backed inside the messaging service (ADR-0030
            // emit → sys_notification_delivery), so it inherits retry/dead-letter.
            needsOutbox: true,
            paradigms: ['flow', 'approval'],
            // Drives the Studio form + documents the accepted keys. Extra keys
            // are still tolerated (JSON Schema allows additional properties) —
            // this is discoverability, not a lockdown.
            configSchema: {
                // No `required` array: `recipients`/`title` each accept an alias
                // (`to`/`subject`), which a strict required-check would reject.
                // The node enforces "title + ≥1 recipient" at execute time.
                type: 'object',
                properties: {
                    recipients: {
                        description: 'Recipient user id(s) / audience selector(s); alias: `to`',
                    },
                    title: { type: 'string', description: 'Notification title; alias: `subject`' },
                    message: { type: 'string', description: 'Notification body; alias: `body`' },
                    channels: {
                        type: 'array', items: { type: 'string' },
                        description: 'Channels to fan out to (default: inbox)',
                    },
                    topic: { type: 'string', description: 'Event topic (default: "notify")' },
                    severity: { type: 'string', description: 'info | warning | critical' },
                    // ── Click-through target (#2675) ─────────────────────────
                    sourceObject: {
                        type: 'string',
                        description: 'Object name of the record the notification links to (writes sys_notification.source_object). Requires sourceId.',
                    },
                    sourceId: {
                        type: 'string',
                        description: 'Record id the notification links to (writes sys_notification.source_id). Requires sourceObject. The inbox synthesizes a `/{object}/{id}` deep-link from these.',
                    },
                    actorId: {
                        type: 'string',
                        description: 'User id that caused the event (writes sys_notification.actor_id)',
                    },
                    url: {
                        type: 'string',
                        description: 'Explicit click-through URL; overrides the link synthesized from sourceObject/sourceId. Alias: `actionUrl`.',
                    },
                    payload: { type: 'object', description: 'Extra template inputs merged into the notification payload' },
                },
            },
        }),
        async execute(node, variables, context) {
            const cfg = (node.config ?? {}) as Record<string, unknown>;

            const recipients = toStringList(interpolate(cfg.recipients ?? cfg.to ?? [], variables, context));
            const title = String(interpolate(cfg.title ?? cfg.subject ?? '', variables, context) ?? '');
            const body = String(interpolate(cfg.message ?? cfg.body ?? '', variables, context) ?? '');
            const channels = toStringList(cfg.channels);
            const topic = cfg.topic ? String(cfg.topic) : undefined;
            const severity = cfg.severity ? String(cfg.severity) : undefined;
            const urlCfg = cfg.actionUrl ?? cfg.url;
            const actionUrl = urlCfg
                ? String(interpolate(urlCfg, variables, context) ?? '')
                : undefined;
            const payload = cfg.payload
                ? (interpolate(cfg.payload, variables, context) as Record<string, unknown>)
                : undefined;

            // Click-through target: forwarding `source` lets the messaging
            // service persist sys_notification.source_object/source_id and
            // synthesize a `/{object}/{id}` deep-link for the inbox (#2675). An
            // explicit `actionUrl`/`url` still wins over the synthesized link.
            const source = resolveSource(cfg, variables, context);
            const actorId = toStr(interpolate(cfg.actorId, variables, context));

            if (!title) return { success: false, error: 'notify: title (or subject) is required' };
            if (recipients.length === 0) {
                return { success: false, error: 'notify: at least one recipient is required' };
            }

            const messaging = getMessaging();
            if (!messaging) {
                ctx.logger.warn(
                    `[notify] no messaging service registered; notification "${title}" not delivered`,
                );
                return {
                    success: true,
                    output: { delivered: 0, failed: 0, skipped: true },
                };
            }

            try {
                // ADR-0030 single ingress: hand the messaging service a topic +
                // audience + payload; it writes the L2 event and materializes
                // per channel. title/body/url ride in the payload (templates in
                // a later phase fall back to these).
                const result = await messaging.emit({
                    topic: topic ?? 'notify',
                    audience: recipients,
                    payload: { ...(payload ?? {}), title, body, url: actionUrl },
                    severity,
                    source,
                    actorId,
                    channels: channels.length ? channels : undefined,
                });
                return {
                    success: true,
                    output: {
                        notificationId: result.notificationId,
                        delivered: result.delivered,
                        failed: result.failed,
                    },
                };
            } catch (err) {
                return { success: false, error: `notify failed: ${(err as Error).message}` };
            }
        },
    });

    ctx.logger.info('[Notify] 1 built-in node executor registered (notify)');
}
