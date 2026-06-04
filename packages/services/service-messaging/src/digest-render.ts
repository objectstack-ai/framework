// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { NotificationDeliveryRecord } from './outbox.js';

/**
 * One collapsed digest message assembled from a window's batched deliveries
 * (ADR-0030 P3b-2). `items` preserves the individual notifications so a
 * structured channel (inbox) can render a list, while `title`/`body` give a
 * flat rendering for plain channels (email text).
 */
export interface DigestRenderResult {
    title: string;
    body: string;
    severity: 'info';
    count: number;
    items: Array<{
        notificationId: string;
        title: string;
        body?: string;
        topic?: string;
        actionUrl?: string;
    }>;
}

/**
 * Collapse same-`(recipient, channel, window)` deliveries into a single message.
 * The caller guarantees `rows` is non-empty and shares a recipient + channel
 * (the digest group). Only non-`critical` notifications are ever batched, so the
 * digest severity is always `info`.
 */
export function renderDigest(rows: NotificationDeliveryRecord[]): DigestRenderResult {
    const items = rows.map((r) => {
        const p = r.payload ?? {};
        return {
            notificationId: r.notificationId,
            title: typeof p.title === 'string' && p.title ? p.title : (r.topic ?? 'Notification'),
            body: typeof p.body === 'string' && p.body ? p.body : undefined,
            topic: r.topic,
            actionUrl: typeof p.actionUrl === 'string' && p.actionUrl ? p.actionUrl : undefined,
        };
    });
    const count = items.length;
    const title = count === 1 ? items[0].title : `You have ${count} notifications`;
    const body = items.map((it) => `• ${it.title}`).join('\n');
    return { title, body, severity: 'info', count, items };
}
