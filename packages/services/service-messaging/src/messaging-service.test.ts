// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach } from 'vitest';
import { MessagingService } from './messaging-service.js';
import { MemoryNotificationOutbox } from './memory-outbox.js';
import type { Delivery, MessagingChannel, SendResult } from './channel.js';

function silentLogger() {
    return { info: () => {}, warn: () => {}, error: () => {} };
}

/** A channel that records every delivery it is handed. */
function recordingChannel(id: string, result: SendResult = { ok: true }): {
    channel: MessagingChannel;
    seen: Delivery[];
} {
    const seen: Delivery[] = [];
    return {
        seen,
        channel: {
            id,
            async send(_ctx, delivery) {
                seen.push(delivery);
                return result;
            },
        },
    };
}

/** A fake data engine capturing event inserts (and optionally a dedup hit). */
function fakeData(findOneImpl?: (obj: string, q: any) => any) {
    const inserts: Array<{ object: string; row: any }> = [];
    const findOnes: Array<{ object: string; query: any }> = [];
    return {
        inserts,
        findOnes,
        getData: () => ({
            async insert(object: string, row: any) {
                inserts.push({ object, row });
                return { id: `evt_${inserts.length}`, ...row };
            },
            async find() { return []; },
            async findOne(object: string, query: any) {
                findOnes.push({ object, query });
                return findOneImpl ? findOneImpl(object, query) : null;
            },
            async update() { return {}; },
            async delete() { return {}; },
            async count() { return 0; },
            async aggregate() { return []; },
        }) as any,
    };
}

describe('MessagingService', () => {
    let service: MessagingService;

    beforeEach(() => {
        service = new MessagingService({ logger: silentLogger() });
    });

    describe('channel registry', () => {
        it('registers, lists, and resolves channels', () => {
            const { channel } = recordingChannel('inbox');
            service.registerChannel(channel);
            expect(service.getRegisteredChannels()).toEqual(['inbox']);
            expect(service.getChannel('inbox')).toBe(channel);
        });

        it('replaces a channel registered under a duplicate id', () => {
            const a = recordingChannel('inbox');
            const b = recordingChannel('inbox');
            service.registerChannel(a.channel);
            service.registerChannel(b.channel);
            expect(service.getRegisteredChannels()).toEqual(['inbox']);
            expect(service.getChannel('inbox')).toBe(b.channel);
        });

        it('unregisters a channel', () => {
            const { channel } = recordingChannel('inbox');
            service.registerChannel(channel);
            service.unregisterChannel('inbox');
            expect(service.getRegisteredChannels()).toEqual([]);
            expect(service.getChannel('inbox')).toBeUndefined();
        });
    });

    describe('emit() ingress + fan-out', () => {
        it('defaults to the inbox channel and one delivery per resolved recipient', async () => {
            const inbox = recordingChannel('inbox', { ok: true, externalId: 'row_1' });
            service.registerChannel(inbox.channel);

            const result = await service.emit({
                topic: 'deal.won',
                audience: ['user_1', 'user_2'],
                payload: { title: 'Deal closed', body: 'Acme signed 🎉' },
            });

            expect(inbox.seen.map((d) => d.recipient)).toEqual(['user_1', 'user_2']);
            expect(inbox.seen[0].channel).toBe('inbox');
            expect(inbox.seen[0].notification.title).toBe('Deal closed');
            expect(result.delivered).toBe(2);
            expect(result.failed).toBe(0);
            expect(result.notificationId).toMatch(/^evt_/); // synthesized w/o data layer
            expect(result.deliveries[0]).toMatchObject({ channel: 'inbox', recipient: 'user_1', ok: true, externalId: 'row_1' });
        });

        it('synthesizes an action_url from source when no explicit url is given (ADR-0030 L5 deep-link)', async () => {
            const inbox = recordingChannel('inbox');
            service.registerChannel(inbox.channel);
            await service.emit({
                topic: 'collab.assignment',
                audience: ['user_1'],
                payload: { title: 'Assigned to you' },
                source: { object: 'showcase_task', id: 't_42' },
            });
            // The materialization carries a navigable link the bell can follow,
            // even though the producer didn't set payload.url.
            expect(inbox.seen[0].notification.actionUrl).toBe('/showcase_task/t_42');
        });

        it('prefers an explicit payload.url over the source-derived link', async () => {
            const inbox = recordingChannel('inbox');
            service.registerChannel(inbox.channel);
            await service.emit({
                topic: 't',
                audience: ['user_1'],
                payload: { title: 'Hi', url: '/custom/landing' },
                source: { object: 'showcase_task', id: 't_42' },
            });
            expect(inbox.seen[0].notification.actionUrl).toBe('/custom/landing');
        });

        it('leaves action_url undefined when there is neither a url nor a source', async () => {
            const inbox = recordingChannel('inbox');
            service.registerChannel(inbox.channel);
            await service.emit({ topic: 't', audience: ['user_1'], payload: { title: 'Hi' } });
            expect(inbox.seen[0].notification.actionUrl).toBeUndefined();
        });

        it('accepts a single (non-array) audience entry', async () => {
            const inbox = recordingChannel('inbox');
            service.registerChannel(inbox.channel);
            const result = await service.emit({ topic: 't', audience: 'user_9', payload: { title: 'Hi' } });
            expect(inbox.seen.map((d) => d.recipient)).toEqual(['user_9']);
            expect(result.delivered).toBe(1);
        });

        it('de-duplicates repeated recipients in the audience', async () => {
            const inbox = recordingChannel('inbox');
            service.registerChannel(inbox.channel);
            await service.emit({ topic: 't', audience: ['user_1', 'user_1'], payload: { title: 'Hi' } });
            expect(inbox.seen.map((d) => d.recipient)).toEqual(['user_1']);
        });

        it('resolves role:/team:/owner_of: to 0 recipients when no directory (data) is present', async () => {
            // Without a data engine the RecipientResolver can't query membership,
            // so these selectors yield no recipients (rather than throwing).
            // Directory-backed expansion is covered in recipient-resolver.test.ts.
            const inbox = recordingChannel('inbox');
            service.registerChannel(inbox.channel);
            const result = await service.emit({
                topic: 't',
                audience: ['role:admin', 'team:sales', { ownerOf: { object: 'lead', id: 'l1' } }],
                payload: { title: 'Hi' },
            });
            expect(inbox.seen).toHaveLength(0);
            expect(result.delivered).toBe(0);
            expect(result.failed).toBe(0);
        });

        it('resolves role:/team:/owner_of: through the data engine when present', async () => {
            const engine = {
                async insert(_o: string, row: any) { return { id: 'evt_x', ...row }; },
                async find(object: string) {
                    if (object === 'sys_member') return [{ user_id: 'u_admin1' }, { user_id: 'u_admin2' }];
                    if (object === 'sys_team_member') return [{ user_id: 'u_sales' }];
                    return [];
                },
                async findOne(object: string) {
                    return object === 'lead' ? { id: 'l1', owner_id: 'u_owner' } : null;
                },
                async update() { return {}; },
                async delete() { return {}; },
                async count() { return 0; },
                async aggregate() { return []; },
            } as any;
            service = new MessagingService({ logger: silentLogger(), getData: () => engine });
            const inbox = recordingChannel('inbox');
            service.registerChannel(inbox.channel);

            const result = await service.emit({
                topic: 't',
                audience: ['role:admin', 'team:sales', { ownerOf: { object: 'lead', id: 'l1' } }, 'u_admin1'],
                payload: { title: 'Hi' },
            });

            // u_admin1 de-duped against the role expansion; owner resolved from the record.
            expect(inbox.seen.map((d) => d.recipient).sort()).toEqual(
                ['u_admin1', 'u_admin2', 'u_owner', 'u_sales'].sort(),
            );
            expect(result.delivered).toBe(4);
        });

        it('fans out across every requested channel', async () => {
            const inbox = recordingChannel('inbox');
            const email = recordingChannel('email');
            service.registerChannel(inbox.channel);
            service.registerChannel(email.channel);

            const result = await service.emit({
                topic: 't',
                audience: ['user_1'],
                channels: ['inbox', 'email'],
                payload: { title: 'Hi', body: 'there' },
            });

            expect(inbox.seen).toHaveLength(1);
            expect(email.seen).toHaveLength(1);
            expect(result.delivered).toBe(2);
        });

        it('applies the preference filter — a muted channel is dropped, a mandatory topic bypasses it', async () => {
            // Engine returns a preference muting `email` for user_1 on topic 't'.
            const prefRow = { user_id: 'user_1', topic: 't', channel: 'email', enabled: false };
            const engine = {
                async insert(_o: string, row: any) { return { id: 'evt_1', ...row }; },
                async find(object: string, query: any) {
                    if (object === 'sys_notification_preference') {
                        return query?.where?.topic === 't' ? [prefRow] : [];
                    }
                    return [];
                },
                async findOne() { return null; },
                async update() { return {}; },
                async delete() { return {}; },
                async count() { return 0; },
                async aggregate() { return []; },
            } as any;

            // Non-mandatory topic 't': email is muted → only inbox delivered.
            const svc = new MessagingService({ logger: silentLogger(), getData: () => engine });
            const inbox = recordingChannel('inbox');
            const email = recordingChannel('email');
            svc.registerChannel(inbox.channel);
            svc.registerChannel(email.channel);
            const r1 = await svc.emit({ topic: 't', audience: ['user_1'], channels: ['inbox', 'email'], payload: { title: 'Hi' } });
            expect(inbox.seen).toHaveLength(1);
            expect(email.seen).toHaveLength(0); // muted
            expect(r1.delivered).toBe(1);

            // Same mute, but topic is mandatory → bypass → both channels delivered.
            const mandatory = new MessagingService({ logger: silentLogger(), getData: () => engine, mandatoryTopics: ['t'] });
            const inbox2 = recordingChannel('inbox');
            const email2 = recordingChannel('email');
            mandatory.registerChannel(inbox2.channel);
            mandatory.registerChannel(email2.channel);
            const r2 = await mandatory.emit({ topic: 't', audience: ['user_1'], channels: ['inbox', 'email'], payload: { title: 'Hi' } });
            expect(inbox2.seen).toHaveLength(1);
            expect(email2.seen).toHaveLength(1); // mandatory bypass
            expect(r2.delivered).toBe(2);
        });

        it('reports a failed delivery per recipient when a channel is unregistered, without throwing', async () => {
            const result = await service.emit({
                topic: 't',
                audience: ['user_1', 'user_2'],
                channels: ['email'],
                payload: { title: 'Hi' },
            });
            expect(result.delivered).toBe(0);
            expect(result.failed).toBe(2);
            expect(result.deliveries.every((d) => /not registered/.test(d.error ?? ''))).toBe(true);
        });

        it('isolates a throwing channel as a failed delivery', async () => {
            service.registerChannel({
                id: 'inbox',
                async send() {
                    throw new Error('boom');
                },
            });
            const result = await service.emit({ topic: 't', audience: ['user_1'], payload: { title: 'x' } });
            expect(result.failed).toBe(1);
            expect(result.deliveries[0].error).toContain('boom');
        });

        it('surfaces a channel-reported failure (ok:false)', async () => {
            service.registerChannel(recordingChannel('inbox', { ok: false, error: 'quota exceeded' }).channel);
            const result = await service.emit({ topic: 't', audience: ['user_1'], payload: { title: 'x' } });
            expect(result.failed).toBe(1);
            expect(result.deliveries[0].error).toBe('quota exceeded');
        });
    });

    describe('emit() with a delivery outbox (P1)', () => {
        it('enqueues a pending delivery per (recipient × channel) instead of fanning out inline', async () => {
            const outbox = new MemoryNotificationOutbox(1);
            const inbox = recordingChannel('inbox');
            service = new MessagingService({ logger: silentLogger(), outbox });
            service.registerChannel(inbox.channel);

            const result = await service.emit({
                topic: 'deal.won',
                audience: ['user_1', 'user_2'],
                payload: { title: 'Deal closed', body: 'Acme' },
            });

            // Nothing sent inline — the dispatcher owns the send.
            expect(inbox.seen).toHaveLength(0);
            expect(result.delivered).toBe(2); // 2 enqueued (accepted)
            const rows = await outbox.list();
            expect(rows).toHaveLength(2);
            expect(rows.every((r) => r.status === 'pending')).toBe(true);
            expect(rows[0].payload).toMatchObject({ title: 'Deal closed', body: 'Acme', severity: 'info' });
            expect(rows.map((r) => r.recipientId).sort()).toEqual(['user_1', 'user_2']);
        });
    });

    describe('emit() L2 event persistence', () => {
        it('writes one sys_notification event row carrying topic/payload/severity/source/actor', async () => {
            const data = fakeData();
            service = new MessagingService({ logger: silentLogger(), getData: data.getData, now: () => '2026-06-01T00:00:00.000Z' });
            service.registerChannel(recordingChannel('inbox').channel);

            const result = await service.emit({
                topic: 'task.assigned',
                audience: ['user_1'],
                severity: 'warning',
                source: { object: 'task', id: 't_7' },
                actorId: 'user_admin',
                organizationId: 'org_1',
                payload: { title: 'Assigned' },
            });

            const event = data.inserts.find((i) => i.object === 'sys_notification');
            expect(event).toBeDefined();
            expect(event!.row).toMatchObject({
                topic: 'task.assigned',
                severity: 'warning',
                source_object: 'task',
                source_id: 't_7',
                actor_id: 'user_admin',
                organization_id: 'org_1',
                created_at: '2026-06-01T00:00:00.000Z',
            });
            expect(result.notificationId).toBe('evt_1');
        });

        it('is idempotent on dedupKey — a matching prior event skips fan-out', async () => {
            const data = fakeData((obj) => (obj === 'sys_notification' ? { id: 'evt_existing' } : null));
            service = new MessagingService({ logger: silentLogger(), getData: data.getData });
            const inbox = recordingChannel('inbox');
            service.registerChannel(inbox.channel);

            const result = await service.emit({
                topic: 'task.assigned',
                audience: ['user_1'],
                dedupKey: 'task.assigned:t_7:user_1',
                payload: { title: 'Assigned' },
            });

            expect(result.deduped).toBe(true);
            expect(result.notificationId).toBe('evt_existing');
            expect(inbox.seen).toHaveLength(0); // no re-fan
            expect(data.inserts.some((i) => i.object === 'sys_notification')).toBe(false);
        });

        it('converges to the winner when a concurrent emit wins the dedup_key unique index', async () => {
            // Simulate the race: the fast-path findOne misses (no prior event),
            // but the event insert hits the UNIQUE(dedup_key) violation because a
            // concurrent emit inserted first. We must catch it and converge to
            // that winner rather than throwing or double-emitting.
            let firstLookup = true;
            const engine = {
                async insert(object: string) {
                    if (object === 'sys_notification') throw new Error('UNIQUE constraint failed: sys_notification.dedup_key');
                    return { id: 'row' };
                },
                async find() { return []; },
                async findOne(object: string) {
                    if (object !== 'sys_notification') return null;
                    // First call = the fast-path miss; second = post-conflict lookup finds the winner.
                    if (firstLookup) { firstLookup = false; return null; }
                    return { id: 'evt_winner' };
                },
                async update() { return {}; },
                async delete() { return {}; },
                async count() { return 0; },
                async aggregate() { return []; },
            } as any;
            service = new MessagingService({ logger: silentLogger(), getData: () => engine });
            const inbox = recordingChannel('inbox');
            service.registerChannel(inbox.channel);

            const result = await service.emit({
                topic: 'task.assigned',
                audience: ['user_1'],
                dedupKey: 'task.assigned:t_7:user_1',
                payload: { title: 'Assigned' },
            });

            expect(result.deduped).toBe(true);
            expect(result.notificationId).toBe('evt_winner');
            expect(inbox.seen).toHaveLength(0); // loser does not re-fan
        });

        it('rethrows an event insert error that is not a dedup conflict', async () => {
            // No dedupKey ⇒ no convergence path ⇒ a genuine write failure surfaces.
            const engine = {
                async insert() { throw new Error('disk full'); },
                async find() { return []; },
                async findOne() { return null; },
                async update() { return {}; },
                async delete() { return {}; },
                async count() { return 0; },
                async aggregate() { return []; },
            } as any;
            service = new MessagingService({ logger: silentLogger(), getData: () => engine });
            service.registerChannel(recordingChannel('inbox').channel);

            await expect(
                service.emit({ topic: 't', audience: ['user_1'], payload: { title: 'x' } }),
            ).rejects.toThrow('disk full');
        });
    });
});

/**
 * A stateful in-memory engine for the inbox read API (ADR-0030). Supports the
 * flat-equality `where` filters listInbox/markRead/markAllRead issue, plus
 * `update(..., { where: { id } })` mutation and `insert`.
 */
function inboxEngine(seed: { inbox?: any[]; receipts?: any[] } = {}) {
    const store: Record<string, any[]> = {
        sys_inbox_message: [...(seed.inbox ?? [])],
        sys_notification_receipt: [...(seed.receipts ?? [])],
    };
    let seq = 0;
    const matches = (row: any, where: any = {}) =>
        Object.entries(where).every(([k, v]) => String(row[k]) === String(v));
    const engine = {
        store,
        async find(object: string, query: any = {}) {
            let rows = (store[object] ?? []).filter((r) => matches(r, query.where));
            const ob = Array.isArray(query.orderBy) ? query.orderBy : [];
            if (ob.some((o: any) => o.field === 'created_at' && o.order === 'desc')) {
                rows = [...rows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
            }
            return typeof query.limit === 'number' ? rows.slice(0, query.limit) : rows;
        },
        async findOne(object: string, query: any = {}) {
            return (store[object] ?? []).find((r) => matches(r, query.where)) ?? null;
        },
        async insert(object: string, row: any) {
            const created = { id: `row_${++seq}`, ...row };
            (store[object] ??= []).push(created);
            return created;
        },
        async update(object: string, data: any, options: any = {}) {
            for (const r of store[object] ?? []) {
                if (matches(r, options.where)) Object.assign(r, data);
            }
            return {};
        },
        async delete() { return {}; },
        async count() { return 0; },
        async aggregate() { return []; },
    };
    return engine as any;
}

describe('MessagingService — inbox read API (ADR-0030)', () => {
    const logger = silentLogger();

    it('lists inbox rows joined with receipt read-state and counts unread', async () => {
        const engine = inboxEngine({
            inbox: [
                { id: 'm1', user_id: 'u1', notification_id: 'n1', topic: 'collab.mention', title: 'A', body_md: 'a', action_url: '/x', created_at: '2026-01-01T00:00:01Z' },
                { id: 'm2', user_id: 'u1', notification_id: 'n2', topic: 'task.assigned', title: 'B', body_md: 'b', created_at: '2026-01-01T00:00:02Z' },
                { id: 'm3', user_id: 'u2', notification_id: 'n3', topic: 'x', title: 'C', created_at: '2026-01-01T00:00:03Z' },
            ],
            receipts: [
                { id: 'r1', notification_id: 'n1', user_id: 'u1', channel: 'inbox', state: 'read' },
                { id: 'r2', notification_id: 'n2', user_id: 'u1', channel: 'inbox', state: 'delivered' },
            ],
        });
        const svc = new MessagingService({ logger, getData: () => engine });

        const res = await svc.listInbox('u1');
        // Only u1's rows; newest first; n2 unread, n1 read.
        expect(res.notifications.map((n) => n.id)).toEqual(['n2', 'n1']);
        expect(res.unreadCount).toBe(1);
        const n1 = res.notifications.find((n) => n.id === 'n1')!;
        expect(n1).toMatchObject({ type: 'collab.mention', title: 'A', body: 'a', read: true, actionUrl: '/x' });
        expect(res.notifications.find((n) => n.id === 'n2')!.read).toBe(false);
    });

    it('filters by read state when requested', async () => {
        const engine = inboxEngine({
            inbox: [
                { id: 'm1', user_id: 'u1', notification_id: 'n1', title: 'A', created_at: '1' },
                { id: 'm2', user_id: 'u1', notification_id: 'n2', title: 'B', created_at: '2' },
            ],
            receipts: [{ id: 'r1', notification_id: 'n1', user_id: 'u1', channel: 'inbox', state: 'read' }],
        });
        const svc = new MessagingService({ logger, getData: () => engine });

        expect((await svc.listInbox('u1', { read: false })).notifications.map((n) => n.id)).toEqual(['n2']);
        expect((await svc.listInbox('u1', { read: true })).notifications.map((n) => n.id)).toEqual(['n1']);
    });

    it('markRead updates the existing delivered receipt in place (no duplicate)', async () => {
        const engine = inboxEngine({
            inbox: [{ id: 'm1', user_id: 'u1', notification_id: 'n1', title: 'A', created_at: '1' }],
            receipts: [{ id: 'r1', notification_id: 'n1', user_id: 'u1', channel: 'inbox', state: 'delivered' }],
        });
        const svc = new MessagingService({ logger, getData: () => engine });

        const res = await svc.markRead('u1', ['n1']);
        expect(res).toEqual({ success: true, readCount: 1 });
        const receipts = engine.store.sys_notification_receipt;
        expect(receipts).toHaveLength(1); // updated in place, not duplicated
        expect(receipts[0]).toMatchObject({ id: 'r1', state: 'read' });
        expect(receipts[0].at).toBeTruthy();
    });

    it('markRead inserts a read receipt when none exists yet', async () => {
        const engine = inboxEngine({
            inbox: [{ id: 'm1', user_id: 'u1', notification_id: 'n1', title: 'A', created_at: '1' }],
        });
        const svc = new MessagingService({ logger, getData: () => engine });

        const res = await svc.markRead('u1', ['n1']);
        expect(res.readCount).toBe(1);
        const receipts = engine.store.sys_notification_receipt;
        expect(receipts).toHaveLength(1);
        expect(receipts[0]).toMatchObject({ notification_id: 'n1', user_id: 'u1', channel: 'inbox', state: 'read' });
    });

    it('markAllRead flips every unread message and leaves already-read ones', async () => {
        const engine = inboxEngine({
            inbox: [
                { id: 'm1', user_id: 'u1', notification_id: 'n1', title: 'A', created_at: '1' },
                { id: 'm2', user_id: 'u1', notification_id: 'n2', title: 'B', created_at: '2' },
            ],
            receipts: [{ id: 'r1', notification_id: 'n1', user_id: 'u1', channel: 'inbox', state: 'read' }],
        });
        const svc = new MessagingService({ logger, getData: () => engine });

        const res = await svc.markAllRead('u1');
        expect(res.readCount).toBe(1); // only n2 was unread
        expect((await svc.listInbox('u1')).unreadCount).toBe(0);
    });

    it('degrades to empty without a data engine or user id', async () => {
        const noData = new MessagingService({ logger });
        expect(await noData.listInbox('u1')).toEqual({ notifications: [], unreadCount: 0 });
        expect(await noData.markRead('u1', ['n1'])).toEqual({ success: true, readCount: 0 });

        const svc = new MessagingService({ logger, getData: () => inboxEngine() });
        expect(await svc.listInbox('')).toEqual({ notifications: [], unreadCount: 0 });
    });
});
