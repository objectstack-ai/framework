// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { createInboxChannel, INBOX_OBJECT } from './inbox-channel.js';
import type { Delivery } from './channel.js';

function silentCtx() {
    return { logger: { info: () => {}, warn: () => {}, error: () => {} } };
}

function delivery(overrides: Partial<Delivery['notification']> = {}, recipient = 'user_1'): Delivery {
    return {
        channel: 'inbox',
        recipient,
        notification: {
            topic: 'deal.won',
            title: 'Deal closed',
            body: 'Acme signed 🎉',
            severity: 'info',
            actionUrl: '/opportunities/42',
            recipients: [recipient],
            ...overrides,
        },
    };
}

/** A fake data engine capturing inserts (and optionally answering findOne). */
function fakeData(
    insertImpl?: (obj: string, row: any) => any,
    findOneImpl?: (obj: string, query: any) => any,
) {
    const inserts: Array<{ object: string; row: any }> = [];
    const findOnes: Array<{ object: string; query: any }> = [];
    return {
        inserts,
        findOnes,
        engine: {
            async insert(object: string, row: any) {
                inserts.push({ object, row });
                return insertImpl ? insertImpl(object, row) : { id: 'inbox_1', ...row };
            },
            async find() { return []; },
            async findOne(object: string, query: any) {
                findOnes.push({ object, query });
                return findOneImpl ? findOneImpl(object, query) : null;
            },
            async update() { return {}; },
            async delete() { return {}; },
        } as any,
    };
}

describe('inbox channel', () => {
    it('has the stable id "inbox"', () => {
        const ch = createInboxChannel({ getData: () => undefined });
        expect(ch.id).toBe('inbox');
    });

    it('writes one sys_inbox_message row keyed by the recipient', async () => {
        const data = fakeData();
        const ch = createInboxChannel({ getData: () => data.engine, now: () => '2026-06-01T00:00:00.000Z' });

        const result = await ch.send(silentCtx(), delivery({}, 'user_42'));

        expect(result.ok).toBe(true);
        expect(result.externalId).toBe('inbox_1');
        expect(data.inserts).toHaveLength(1);
        expect(data.inserts[0].object).toBe(INBOX_OBJECT);
        expect(data.inserts[0].row).toEqual({
            user_id: 'user_42',
            topic: 'deal.won',
            title: 'Deal closed',
            body_md: 'Acme signed 🎉',
            severity: 'info',
            action_url: '/opportunities/42',
            read: false,
            created_at: '2026-06-01T00:00:00.000Z',
        });
    });

    it('defaults severity to info when the notification omits it', async () => {
        const data = fakeData();
        const ch = createInboxChannel({ getData: () => data.engine });
        await ch.send(silentCtx(), delivery({ severity: undefined }));
        expect(data.inserts[0].row.severity).toBe('info');
    });

    it('honours an objectName override', async () => {
        const data = fakeData();
        const ch = createInboxChannel({ getData: () => data.engine, objectName: 'custom_inbox' });
        await ch.send(silentCtx(), delivery());
        expect(data.inserts[0].object).toBe('custom_inbox');
    });

    it('reports a no-op success (not a throw) when no data engine is registered', async () => {
        const ch = createInboxChannel({ getData: () => undefined });
        const result = await ch.send(silentCtx(), delivery());
        expect(result.ok).toBe(true);
        expect(result.externalId).toBeUndefined();
    });

    it('surfaces an insert failure as ok:false', async () => {
        const ch = createInboxChannel({
            getData: () => fakeData(() => { throw new Error('db down'); }).engine,
        });
        const result = await ch.send(silentCtx(), delivery());
        expect(result.ok).toBe(false);
        expect(result.error).toContain('db down');
    });

    it('classifies errors as retryable', () => {
        const ch = createInboxChannel({ getData: () => undefined });
        expect(ch.classifyError?.(new Error('x'))).toBe('retryable');
    });

    // ── email → user id resolution (notify-by-email lands in the right inbox) ──

    it('resolves an email-shaped recipient to its sys_user id', async () => {
        const data = fakeData(undefined, (obj, _q) =>
            obj === 'sys_user' ? { id: 'usr_abc123' } : null,
        );
        const ch = createInboxChannel({ getData: () => data.engine });

        await ch.send(silentCtx(), delivery({}, 'ada@example.com'));

        expect(data.findOnes).toHaveLength(1);
        expect(data.findOnes[0].object).toBe('sys_user');
        expect(data.findOnes[0].query).toEqual({ where: { email: 'ada@example.com' }, fields: ['id'] });
        expect(data.inserts[0].row.user_id).toBe('usr_abc123');
    });

    it('honours a userObject override for resolution', async () => {
        const data = fakeData(undefined, () => ({ id: 'usr_xyz' }));
        const ch = createInboxChannel({ getData: () => data.engine, userObject: 'crm_contact' });
        await ch.send(silentCtx(), delivery({}, 'ada@example.com'));
        expect(data.findOnes[0].object).toBe('crm_contact');
        expect(data.inserts[0].row.user_id).toBe('usr_xyz');
    });

    it('keys by the recipient verbatim when it is not email-shaped (no lookup)', async () => {
        const data = fakeData();
        const ch = createInboxChannel({ getData: () => data.engine });
        await ch.send(silentCtx(), delivery({}, 'usr_42'));
        expect(data.findOnes).toHaveLength(0);
        expect(data.inserts[0].row.user_id).toBe('usr_42');
    });

    it('falls back to the email verbatim when no user matches', async () => {
        const data = fakeData(undefined, () => null);
        const ch = createInboxChannel({ getData: () => data.engine });
        await ch.send(silentCtx(), delivery({}, 'ghost@example.com'));
        expect(data.findOnes).toHaveLength(1);
        expect(data.inserts[0].row.user_id).toBe('ghost@example.com');
    });

    it('falls back to the email verbatim when the lookup throws', async () => {
        const data = fakeData(undefined, () => { throw new Error('user table locked'); });
        const ch = createInboxChannel({ getData: () => data.engine });
        const result = await ch.send(silentCtx(), delivery({}, 'ada@example.com'));
        expect(result.ok).toBe(true);
        expect(data.inserts[0].row.user_id).toBe('ada@example.com');
    });
});
