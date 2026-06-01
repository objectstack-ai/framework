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

/** The receipt object the inbox channel writes a `delivered` row to (ADR-0030). */
export const RECEIPT_OBJECT = 'sys_notification_receipt';

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
    /** Receipt object name override (default {@link RECEIPT_OBJECT}). */
    receiptObject?: string;
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
    const receiptObject = opts.receiptObject ?? RECEIPT_OBJECT;
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

    /**
     * Write the `delivered` receipt for an inbox materialization. Best-effort:
     * receipts are the read-state spine but a failure here must never turn a
     * delivered message into a failed one — we log and move on. Skipped when the
     * event id is absent (a synthetic/minimal stack with nothing to key on).
     */
    async function writeDeliveredReceipt(
        ctx: MessagingChannelContext,
        data: IDataEngine,
        r: { notificationId?: string; userId: string; organizationId?: string; at: string },
    ): Promise<void> {
        if (!r.notificationId) return;
        try {
            await data.insert(receiptObject, {
                notification_id: r.notificationId,
                delivery_id: null,
                user_id: r.userId,
                channel: 'inbox',
                state: 'delivered',
                at: r.at,
                organization_id: r.organizationId ?? null,
                created_at: r.at,
            });
        } catch (err) {
            ctx.logger.warn(
                `[inbox] delivered receipt write failed for '${r.userId}' (${(err as Error).message}); inbox row stands`,
            );
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
            const at = now();

            const row: Record<string, unknown> = {
                user_id: userId,
                notification_id: n.notificationId ?? null,
                topic: n.topic,
                title: n.title,
                body_md: n.body,
                severity: n.severity ?? 'info',
                action_url: n.actionUrl,
                organization_id: n.organizationId ?? null,
                created_at: at,
            };

            let inboxId: string | undefined;
            try {
                const created = await data.insert(objectName, row);
                const id = Array.isArray(created) ? created[0]?.id : created?.id ?? created;
                inboxId = id != null ? String(id) : undefined;
            } catch (err) {
                return { ok: false, error: `inbox insert failed: ${(err as Error).message}` };
            }

            // Read-state lives in the receipt (ADR-0030), not on the inbox row.
            // Best-effort: a missing receipt must not fail a delivered message.
            await writeDeliveredReceipt(ctx, data, {
                notificationId: n.notificationId,
                userId,
                organizationId: n.organizationId,
                at,
            });

            return { ok: true, externalId: inboxId };
        },

        classifyError(_err: unknown): ErrorClass {
            // A failed local insert is almost always transient (lock/timeout).
            return 'retryable';
        },
    };
}
