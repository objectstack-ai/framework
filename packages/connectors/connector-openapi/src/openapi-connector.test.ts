// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { createOpenApiConnector, type OpenApiDocument } from './openapi-connector.js';

const doc: OpenApiDocument = {
    openapi: '3.0.0',
    info: { title: 'Pet Store', description: 'A sample pet API' },
    servers: [{ url: 'https://api.pets.example.com/v1' }],
    components: {
        securitySchemes: { apiKey: { type: 'apiKey', name: 'X-API-Key', in: 'header' } },
    },
    paths: {
        '/pets/{petId}': {
            get: {
                operationId: 'getPetById',
                summary: 'Get a pet by id',
                tags: ['pets'],
                parameters: [
                    { name: 'petId', in: 'path', required: true, schema: { type: 'integer' } },
                    { name: 'detail', in: 'query', schema: { type: 'string' } },
                ],
                responses: {
                    '200': { content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'integer' } } } } } },
                },
            },
        },
        '/pets': {
            post: {
                operationId: 'createPet',
                summary: 'Create a pet',
                tags: ['pets'],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } } } } },
                },
                responses: { '201': { description: 'created' } },
            },
            get: {
                // no operationId — exercises the slug fallback
                summary: 'List pets',
                tags: ['admin'],
                responses: { '200': { description: 'ok' } },
            },
        },
    },
};

/** A fake fetch that records calls and returns a JSON response (mirrors connector-rest tests). */
function fakeFetch(payload: unknown) {
    const calls: Array<{ url: string; init: { method?: string; body?: unknown; headers?: Record<string, string> } }> = [];
    const fetchImpl = (async (url: string, init: { method?: string; body?: unknown; headers?: Record<string, string> }) => {
        calls.push({ url, init });
        return {
            status: 200,
            ok: true,
            headers: { get: () => 'application/json' },
            json: async () => payload,
            text: async () => JSON.stringify(payload),
        };
    }) as unknown as typeof fetch;
    return { calls, fetchImpl };
}

describe('createOpenApiConnector', () => {
    it('derives connector metadata from info + servers', () => {
        const { def } = createOpenApiConnector({ document: doc });
        expect(def.name).toBe('pet_store');
        expect(def.label).toBe('Pet Store');
        expect(def.description).toBe('A sample pet API');
        expect(def.type).toBe('api');
    });

    it('maps each operation to an action and falls back to a slug key', () => {
        const { def } = createOpenApiConnector({ document: doc });
        const keys = (def.actions ?? []).map((a) => a.key);
        expect(keys).toContain('getPetById');
        expect(keys).toContain('createPet');
        expect(keys).toContain('get_pets'); // GET /pets has no operationId
    });

    it('assembles input schema sections from parameters and requestBody', () => {
        const { def } = createOpenApiConnector({ document: doc });
        const get = def.actions?.find((a) => a.key === 'getPetById');
        expect(get?.inputSchema).toMatchObject({
            type: 'object',
            properties: {
                path: { type: 'object', properties: { petId: { type: 'integer' } }, required: ['petId'] },
                query: { type: 'object', properties: { detail: { type: 'string' } } },
            },
            required: ['path'],
        });

        const post = def.actions?.find((a) => a.key === 'createPet');
        expect(post?.inputSchema).toMatchObject({
            properties: { body: { type: 'object', properties: { name: { type: 'string' } } } },
            required: ['body'],
        });
    });

    it('picks the success response schema as the output schema', () => {
        const { def } = createOpenApiConnector({ document: doc });
        const get = def.actions?.find((a) => a.key === 'getPetById');
        expect(get?.outputSchema).toMatchObject({ type: 'object', properties: { id: { type: 'integer' } } });
    });

    it('defaults authentication to none and reflects supplied credentials', () => {
        expect(createOpenApiConnector({ document: doc }).def.authentication).toEqual({ type: 'none' });
        const withAuth = createOpenApiConnector({ document: doc, auth: { type: 'bearer', token: 'secret' } });
        expect(withAuth.def.authentication).toEqual({ type: 'bearer', token: 'secret' });
    });

    it('honors an include allowlist', () => {
        const { def } = createOpenApiConnector({ document: doc, include: (op) => (op.tags ?? []).includes('pets') });
        expect((def.actions ?? []).map((a) => a.key)).toEqual(['getPetById', 'createPet']);
    });

    it('handler interpolates path params and forwards query via the REST request', async () => {
        const { calls, fetchImpl } = fakeFetch({ id: 42 });
        const { handlers } = createOpenApiConnector({ document: doc, fetchImpl });
        const result = await handlers.getPetById({ path: { petId: 42 }, query: { detail: 'full' } }, {});

        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe('https://api.pets.example.com/v1/pets/42?detail=full');
        expect(calls[0].init.method).toBe('GET');
        expect(result).toEqual({ status: 200, ok: true, body: { id: 42 } });
    });

    it('handler sends a JSON body for write operations', async () => {
        const { calls, fetchImpl } = fakeFetch({});
        const { handlers } = createOpenApiConnector({ document: doc, fetchImpl });
        await handlers.createPet({ body: { name: 'Rex' } }, {});

        expect(calls[0].init.method).toBe('POST');
        expect(calls[0].init.body).toBe(JSON.stringify({ name: 'Rex' }));
    });

    it('throws when no base URL can be determined', () => {
        expect(() => createOpenApiConnector({ document: { info: { title: 'x' }, paths: {} } })).toThrow(/base URL/);
    });
});
