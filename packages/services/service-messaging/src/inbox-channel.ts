// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { IDataEngine } from '@objectstack/spec/contracts';
import type {
    Delivery,
    ErrorClass,
    MessagingChannel,
    MessagingChannelContext,
    SendResult,
} from './channel.js';

/** The object the inbox channel writes rows to. */
export const INBOX_OBJECT = 'sys_inbox_message';

/** The user identity object an email-shaped recipient is resolved against. */
export const USER_OBJECT = 'sys_user';

/** Cheap RFC-ish heuristic — "looks like an email" so we attempt id resolution. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface InboxChannelOptions {
    /**
     * Resolve the runtime data engine. Returns `undefined` when no data layer
     * is registered (e.g. a minimal test stack) — the channel then warns and
     * reports a no-op success rather than throwing, matching the platform's
     * built-in CRUD-node degradation.
     */
    getData(): IDataEngine | undefined;
    /** Object name override (default {@link INBOX_OBJECT}). */
    objectName?: string;
    /**
     * User identity object used to resolve an email-shaped recipient to its
     * id (default {@link USER_OBJECT}). The inbox is keyed by user id, but
     * flows commonly address recipients by email (e.g. an `assignee` field),
     * so a recipient matching {@link EMAIL_SHAPE} is looked up by `email` and
     * replaced with the matching user's `id`. Verbatim fallback applies when
     * the recipient is not email-shaped, no user matches, or the lookup fails.
     */
    userObject?: string;
    /** Clock injection for deterministic tests. Defaults to `new Date()`. */
    now?(): string;
}

/**
 * The always-on `inbox` channel (ADR-0012 §4).
 *
 * Unlike email/webhook/push, inbox is direction-reversed: there is no outbound
 * call — we write a `sys_inbox_message` row in our own DB and the user's client
 * pulls it. So it needs no connector/transport. One delivery → one row keyed by
 * the recipient user id.
 */
export function createInboxChannel(opts: InboxChannelOptions): MessagingChannel {
    const objectName = opts.objectName ?? INBOX_OBJECT;
    const userObject = opts.userObject ?? USER_OBJECT;
    const now = opts.now ?? (() => new Date().toISOString());

    /**
     * Map an email-shaped recipient to its user id; return the recipient
     * unchanged for non-email recipients, on no match, or on any lookup error
     * (the inbox row is best-effort keyed and must never fail on resolution).
     */
    async function resolveRecipient(
        ctx: MessagingChannelContext,
        data: IDataEngine,
        recipient: string,
    ): Promise<string> {
        if (!EMAIL_SHAPE.test(recipient)) return recipient;
        try {
            const user = await data.findOne(userObject, {
                where: { email: recipient },
                fields: ['id'],
            });
            const id = user?.id;
            if (id != null && String(id).length > 0) return String(id);
            ctx.logger.warn(
                `[inbox] no '${userObject}' matched email '${recipient}'; keying inbox row by the email verbatim`,
            );
            return recipient;
        } catch (err) {
            ctx.logger.warn(
                `[inbox] failed to resolve '${recipient}' to a user id (${(err as Error).message}); keying by the email verbatim`,
            );
            return recipient;
        }
    }

    return {
        id: 'inbox',

        async send(ctx: MessagingChannelContext, delivery: Delivery): Promise<SendResult> {
            const data = opts.getData();
            const n = delivery.notification;

            if (!data) {
                ctx.logger.warn(
                    `[inbox] no data engine registered; inbox row for '${delivery.recipient}' not persisted`,
                );
                return { ok: true };
            }

            const userId = await resolveRecipient(ctx, data, delivery.recipient);

            const row: Record<string, unknown> = {
                user_id: userId,
                topic: n.topic,
                title: n.title,
                body_md: n.body,
                severity: n.severity ?? 'info',
                action_url: n.actionUrl,
                read: false,
                created_at: now(),
            };

            try {
                const created = await data.insert(objectName, row);
                const id = Array.isArray(created) ? created[0]?.id : created?.id ?? created;
                return { ok: true, externalId: id != null ? String(id) : undefined };
            } catch (err) {
                return { ok: false, error: `inbox insert failed: ${(err as Error).message}` };
            }
        },

        classifyError(_err: unknown): ErrorClass {
            // A failed local insert is almost always transient (lock/timeout).
            return 'retryable';
        },
    };
}
