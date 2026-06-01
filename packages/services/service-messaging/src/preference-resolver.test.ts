// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { PreferenceResolver } from './preference-resolver.js';

function silentLogger() {
    return { info: () => {}, warn: () => {}, error: () => {} };
}

/**
 * Fake data engine answering `find('sys_notification_preference', { where })`
 * from an in-memory row list, filtered by the query's `topic` (and org).
 */
function fakeData(rows: any[] = [], opts: { throwOnFind?: boolean } = {}) {
    const queries: any[] = [];
    return {
        queries,
        engine: {
            async find(object: string, query: any) {
                queries.push({ object, where: query?.where });
                if (opts.throwOnFind) throw new Error('pref table locked');
                const w = query?.where ?? {};
                return rows.filter(
                    (r) =>
                        r.topic === w.topic &&
                        (w.organization_id == null || r.organization_id === w.organization_id),
                );
            },
            async findOne() { return null; },
            async insert(_o: string, r: any) { return { id: 'x', ...r }; },
            async update() { return {}; },
            async delete() { return {}; },
            async count() { return 0; },
            async aggregate() { return []; },
        } as any,
    };
}

function pref(over: Partial<{ user_id: string; topic: string; channel: string; enabled: boolean; organization_id: string }>) {
    return { user_id: '*', topic: '*', channel: '*', enabled: true, ...over };
}

function resolver(getData: () => any, mandatoryTopics: string[] = []) {
    return new PreferenceResolver({ getData, logger: silentLogger(), mandatoryTopics });
}

describe('PreferenceResolver', () => {
    it('fails open (all channels) when there is no data engine', async () => {
        const r = resolver(() => undefined);
        const out = await r.filter(['u1', 'u2'], ['inbox', 'email'], { topic: 'task.assigned' });
        expect(out).toEqual([
            { recipient: 'u1', channels: ['inbox', 'email'] },
            { recipient: 'u2', channels: ['inbox', 'email'] },
        ]);
    });

    it('returns [] for empty recipients or channels', async () => {
        const r = resolver(() => fakeData().engine);
        expect(await r.filter([], ['inbox'], { topic: 't' })).toEqual([]);
        expect(await r.filter(['u1'], [], { topic: 't' })).toEqual([]);
    });

    it('defaults every (recipient, channel) ON when no rows exist', async () => {
        const r = resolver(() => fakeData([]).engine);
        const out = await r.filter(['u1'], ['inbox', 'email'], { topic: 'task.assigned' });
        expect(out).toEqual([{ recipient: 'u1', channels: ['inbox', 'email'] }]);
    });

    it('drops a single channel a user muted, keeping the others', async () => {
        const rows = [pref({ user_id: 'u1', topic: 'task.assigned', channel: 'email', enabled: false })];
        const r = resolver(() => fakeData(rows).engine);
        const out = await r.filter(['u1'], ['inbox', 'email'], { topic: 'task.assigned' });
        expect(out).toEqual([{ recipient: 'u1', channels: ['inbox'] }]);
    });

    it('drops a recipient entirely when they mute the topic on all channels (channel "*")', async () => {
        const rows = [pref({ user_id: 'u1', topic: 'task.assigned', channel: '*', enabled: false })];
        const r = resolver(() => fakeData(rows).engine);
        const out = await r.filter(['u1', 'u2'], ['inbox', 'email'], { topic: 'task.assigned' });
        expect(out).toEqual([{ recipient: 'u2', channels: ['inbox', 'email'] }]);
    });

    it('lets a per-user row override the admin-global default', async () => {
        const rows = [
            pref({ user_id: '*', topic: 'task.assigned', channel: 'email', enabled: false }), // global: email off
            pref({ user_id: 'u1', topic: 'task.assigned', channel: 'email', enabled: true }),  // u1 opts back in
        ];
        const r = resolver(() => fakeData(rows).engine);
        const out = await r.filter(['u1', 'u2'], ['inbox', 'email'], { topic: 'task.assigned' });
        // u1 re-enabled email; u2 inherits the global mute (email dropped).
        expect(out).toEqual([
            { recipient: 'u1', channels: ['inbox', 'email'] },
            { recipient: 'u2', channels: ['inbox'] },
        ]);
    });

    it('prefers the most specific row (topic+channel beats topic-wildcard)', async () => {
        const rows = [
            pref({ user_id: 'u1', topic: 'task.assigned', channel: '*', enabled: false }),     // mute all channels…
            pref({ user_id: 'u1', topic: 'task.assigned', channel: 'inbox', enabled: true }),  // …except inbox
        ];
        const r = resolver(() => fakeData(rows).engine);
        const out = await r.filter(['u1'], ['inbox', 'email'], { topic: 'task.assigned' });
        expect(out).toEqual([{ recipient: 'u1', channels: ['inbox'] }]);
    });

    it('honours a wildcard-topic preference row', async () => {
        const rows = [pref({ user_id: 'u1', topic: '*', channel: 'email', enabled: false })];
        const r = resolver(() => fakeData(rows).engine);
        const out = await r.filter(['u1'], ['inbox', 'email'], { topic: 'anything.at.all' });
        expect(out).toEqual([{ recipient: 'u1', channels: ['inbox'] }]);
    });

    it('bypasses preferences for a mandatory topic (exact match) even when muted', async () => {
        const rows = [pref({ user_id: 'u1', topic: 'security.breach', channel: '*', enabled: false })];
        const r = resolver(() => fakeData(rows).engine, ['security.breach']);
        const out = await r.filter(['u1'], ['inbox', 'email'], { topic: 'security.breach' });
        expect(out).toEqual([{ recipient: 'u1', channels: ['inbox', 'email'] }]);
    });

    it('bypasses preferences for a mandatory topic prefix', async () => {
        const r = resolver(() => fakeData([pref({ user_id: 'u1', topic: '*', channel: '*', enabled: false })]).engine, ['security.']);
        const out = await r.filter(['u1'], ['inbox'], { topic: 'security.mfa_disabled' });
        expect(out).toEqual([{ recipient: 'u1', channels: ['inbox'] }]);
        expect(r.isMandatory('security.mfa_disabled')).toBe(true);
        expect(r.isMandatory('task.assigned')).toBe(false);
    });

    it('fails open when the preference lookup throws', async () => {
        const r = resolver(() => fakeData([], { throwOnFind: true }).engine);
        const out = await r.filter(['u1'], ['inbox', 'email'], { topic: 'task.assigned' });
        expect(out).toEqual([{ recipient: 'u1', channels: ['inbox', 'email'] }]);
    });

    it('scopes the lookup to the organization when provided', async () => {
        const data = fakeData([
            pref({ user_id: 'u1', topic: 'task.assigned', channel: 'email', enabled: false, organization_id: 'org_1' }),
        ]);
        const r = resolver(() => data.engine);
        await r.filter(['u1'], ['inbox', 'email'], { topic: 'task.assigned', organizationId: 'org_1' });
        expect(data.queries.every((q) => q.where.organization_id === 'org_1')).toBe(true);
    });
});
