// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.
//
// Regression coverage for the `requireAuth` gate on the dispatcher's service
// route families (AI + metadata catch-all). These routes declare `auth: true`
// but nothing enforced it before — an anonymous caller reached e.g.
// `GET /api/v1/ai/status` (and the metadata reader) on a tenant-less host and
// got adapter/model/schema data back. The gate mirrors the REST `enforceAuth`
// seam: on a `requireAuth` deployment, anonymous callers get 401 while an
// authenticated (or internal system) context passes.

import { describe, it, expect } from 'vitest';
import { HttpDispatcher } from './http-dispatcher.js';

const aiRoute = {
    method: 'GET',
    path: '/api/v1/ai/status',
    auth: true,
    handler: async () => ({ status: 200, body: { adapter: 'test' } }),
};

const makeKernel = (extra: Record<string, unknown> = {}) =>
    ({
        context: {
            getService: (name: string) => (name === 'ai' ? { adapterName: 'test' } : null),
        },
        __aiRoutes: [aiRoute],
        ...extra,
    }) as any;

const anon = { request: {}, executionContext: undefined } as any;
const authed = { request: {}, executionContext: { userId: 'u1' } } as any;
const system = { request: {}, executionContext: { isSystem: true } } as any;

describe('HttpDispatcher requireAuth gate — AI routes (handleAI)', () => {
    it('401s an anonymous caller when requireAuth is on', async () => {
        const d = new HttpDispatcher(makeKernel(), undefined, { requireAuth: true });
        const r = await d.handleAI('/ai/status', 'GET', undefined, undefined, anon);
        expect(r.response?.status).toBe(401);
        expect(r.response?.body?.error?.details?.code ?? r.response?.body?.error?.code).toBeDefined();
    });

    it('lets an authenticated caller through', async () => {
        const d = new HttpDispatcher(makeKernel(), undefined, { requireAuth: true });
        const r = await d.handleAI('/ai/status', 'GET', undefined, undefined, authed);
        expect(r.response?.status).toBe(200);
        expect(r.response?.body?.adapter).toBe('test');
    });

    it('lets an internal system context through', async () => {
        const d = new HttpDispatcher(makeKernel(), undefined, { requireAuth: true });
        const r = await d.handleAI('/ai/status', 'GET', undefined, undefined, system);
        expect(r.response?.status).toBe(200);
    });

    it('serves anonymously when requireAuth is off (unchanged legacy behaviour)', async () => {
        const d = new HttpDispatcher(makeKernel(), undefined, { requireAuth: false });
        const r = await d.handleAI('/ai/status', 'GET', undefined, undefined, anon);
        expect(r.response?.status).toBe(200);
    });

    it('does not gate a route that opts out with auth:false', async () => {
        const openRoute = { ...aiRoute, path: '/api/v1/ai/public', auth: false };
        const d = new HttpDispatcher(makeKernel({ __aiRoutes: [openRoute] }), undefined, { requireAuth: true });
        const r = await d.handleAI('/ai/public', 'GET', undefined, undefined, anon);
        expect(r.response?.status).toBe(200);
    });
});

describe('HttpDispatcher requireAuth gate — GraphQL (handleGraphQL)', () => {
    // A valid-enough body so the missing-query 400 branch isn't hit first.
    const gqlBody = { query: '{ __typename }' };

    it('401s an anonymous caller when requireAuth is on (#2567)', async () => {
        const d = new HttpDispatcher(makeKernel(), undefined, { requireAuth: true });
        await expect(d.handleGraphQL(gqlBody, anon)).rejects.toMatchObject({ statusCode: 401 });
    });

    it('lets an authenticated caller PAST the gate', async () => {
        const d = new HttpDispatcher(makeKernel(), undefined, { requireAuth: true });
        // The mock kernel has no graphql service, so a caller that clears the
        // gate hits 501 — which PROVES the gate passed (an anonymous caller
        // throws 401 before this point).
        await expect(d.handleGraphQL(gqlBody, authed)).rejects.toMatchObject({ statusCode: 501 });
    });

    it('lets an internal system context past the gate', async () => {
        const d = new HttpDispatcher(makeKernel(), undefined, { requireAuth: true });
        await expect(d.handleGraphQL(gqlBody, system)).rejects.toMatchObject({ statusCode: 501 });
    });

    it('serves anonymously when requireAuth is off (unchanged legacy behaviour)', async () => {
        const d = new HttpDispatcher(makeKernel(), undefined, { requireAuth: false });
        // Gate is a no-op → reaches the (absent) graphql service → 501, NOT 401.
        await expect(d.handleGraphQL(gqlBody, anon)).rejects.toMatchObject({ statusCode: 501 });
    });

    it('400s a missing query before the auth gate is consulted', async () => {
        const d = new HttpDispatcher(makeKernel(), undefined, { requireAuth: true });
        await expect(d.handleGraphQL({} as any, anon)).rejects.toMatchObject({ statusCode: 400 });
    });
});

// #2992 / ADR-0096 D1 — the GraphQL entry point must THREAD the caller's
// identity to the engine, not just gate anonymity. kernel.graphql is a stub
// surface today (never assigned in the monorepo), but the moment a real
// engine lands it resolves objects through ObjectQL, whose security
// middleware falls OPEN on a missing principal — so the entry point passes
// the resolved ExecutionContext as `options.context` (the same key the REST
// callData path threads). Dropping it also goes STALE in the authz
// conformance matrix (dogfood/test/authz-conformance.test.ts).
describe('HttpDispatcher identity threading — GraphQL (handleGraphQL, #2992)', () => {
    const gqlBody = { query: '{ __typename }', variables: { a: 1 } };

    const makeGraphQLKernel = (calls: any[]) =>
        makeKernel({
            graphql: (query: string, variables: any, options: any) => {
                calls.push({ query, variables, options });
                return { data: {} };
            },
        });

    it('threads the resolved ExecutionContext as options.context', async () => {
        const calls: any[] = [];
        const d = new HttpDispatcher(makeGraphQLKernel(calls), undefined, { requireAuth: true });
        await d.handleGraphQL(gqlBody, authed);
        expect(calls).toHaveLength(1);
        expect(calls[0].query).toBe(gqlBody.query);
        expect(calls[0].variables).toEqual(gqlBody.variables);
        expect(calls[0].options.context).toBe(authed.executionContext);
    });

    it('threads a system context unchanged', async () => {
        const calls: any[] = [];
        const d = new HttpDispatcher(makeGraphQLKernel(calls), undefined, { requireAuth: true });
        await d.handleGraphQL(gqlBody, system);
        expect(calls[0].options.context).toBe(system.executionContext);
    });

    it('threads the caller identity even when requireAuth is OFF (an authenticated caller on an open deployment still runs under their own authority)', async () => {
        const calls: any[] = [];
        const d = new HttpDispatcher(makeGraphQLKernel(calls), undefined, { requireAuth: false });
        await d.handleGraphQL(gqlBody, authed);
        expect(calls[0].options.context).toBe(authed.executionContext);
    });

    it('an anonymous caller on an open deployment carries NO authority (explicit guest principal or nothing — never a forged user/system identity)', async () => {
        const calls: any[] = [];
        const d = new HttpDispatcher(makeGraphQLKernel(calls), undefined, { requireAuth: false });
        // Fresh context object: handleGraphQL caches the resolved identity on it.
        await d.handleGraphQL(gqlBody, { request: {}, executionContext: undefined } as any);
        const threaded = calls[0].options.context;
        // The resolver yields an explicit guest principal (mirroring dispatch());
        // whatever is threaded must carry no user and no system authority.
        expect(threaded?.userId).toBeUndefined();
        expect(threaded?.isSystem ?? false).toBe(false);
    });
});

describe('HttpDispatcher requireAuth gate — metadata catch-all (handleMetadata)', () => {
    it('401s an anonymous caller when requireAuth is on', async () => {
        const d = new HttpDispatcher(makeKernel(), undefined, { requireAuth: true });
        const r = await d.handleMetadata('/object', anon, 'GET');
        expect(r.response?.status).toBe(401);
    });

    it('does not 401 an authenticated caller (proceeds past the gate)', async () => {
        const d = new HttpDispatcher(makeKernel(), undefined, { requireAuth: true });
        const r = await d.handleMetadata('/object', authed, 'GET');
        expect(r.response?.status).not.toBe(401);
    });

    it('does not 401 when requireAuth is off', async () => {
        const d = new HttpDispatcher(makeKernel(), undefined, { requireAuth: false });
        const r = await d.handleMetadata('/object', anon, 'GET');
        expect(r.response?.status).not.toBe(401);
    });
});
