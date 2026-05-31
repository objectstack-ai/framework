import { describe, it, expect } from 'vitest';
import { createOpenApiConnector, type OpenApiDocument } from './openapi-connector';

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

describe('createOpenApiConnector', () => {
    it('derives connector metadata from info + servers', () => {
        const { definition } = createOpenApiConnector({ document: doc });
        expect(definition.name).toBe('pet_store');
        expect(definition.label).toBe('Pet Store');
        expect(definition.description).toBe('A sample pet API');
        expect(definition.type).toBe('api');
    });

    it('maps each operation to an action and falls back to a slug name', () => {
        const { definition } = createOpenApiConnector({ document: doc });
        const names = definition.actions.map((a) => a.name);
        expect(names).toContain('getPetById');
        expect(names).toContain('createPet');
        expect(names).toContain('get_pets'); // GET /pets has no operationId
    });

    it('assembles input schema sections from parameters and requestBody', () => {
        const { definition } = createOpenApiConnector({ document: doc });
        const get = definition.actions.find((a) => a.name === 'getPetById');
        expect(get?.inputSchema).toMatchObject({
            type: 'object',
            properties: {
                path: { type: 'object', properties: { petId: { type: 'integer' } }, required: ['petId'] },
                query: { type: 'object', properties: { detail: { type: 'string' } } },
            },
            required: ['path'],
        });

        const post = definition.actions.find((a) => a.name === 'createPet');
        expect(post?.inputSchema).toMatchObject({
            properties: { body: { type: 'object', properties: { name: { type: 'string' } } } },
            required: ['body'],
        });
    });

    it('picks the success response schema as the output schema', () => {
        const { definition } = createOpenApiConnector({ document: doc });
        const get = definition.actions.find((a) => a.name === 'getPetById');
        expect(get?.outputSchema).toMatchObject({ type: 'object', properties: { id: { type: 'integer' } } });
    });

    it('infers the declared security scheme when no auth is supplied', () => {
        const { definition } = createOpenApiConnector({ document: doc });
        expect(definition.authentication).toEqual({ kind: 'api-key', name: 'X-API-Key', in: 'header' });
    });

    it('reflects supplied credentialed auth in the definition metadata', () => {
        const { definition } = createOpenApiConnector({ document: doc, auth: { kind: 'bearer', token: 'secret' } });
        expect(definition.authentication).toEqual({ kind: 'bearer' });
    });

    it('honors an include allowlist', () => {
        const { definition } = createOpenApiConnector({ document: doc, include: (op) => (op.tags ?? []).includes('pets') });
        expect(definition.actions.map((a) => a.name)).toEqual(['getPetById', 'createPet']);
    });

    it('handler interpolates path params and forwards query via the REST request', async () => {
        const calls: Array<{ url: string; init: { method?: string; body?: unknown } }> = [];
        const fetchImpl = (async (url: string, init: { method?: string; body?: unknown }) => {
            calls.push({ url, init });
            return { status: 200, ok: true, text: async () => JSON.stringify({ id: 42 }) };
        }) as unknown as typeof fetch;

        const { handlers } = createOpenApiConnector({ document: doc, fetchImpl });
        const result = await handlers.getPetById({ path: { petId: 42 }, query: { detail: 'full' } });

        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe('https://api.pets.example.com/v1/pets/42?detail=full');
        expect(calls[0].init.method).toBe('GET');
        expect(result).toEqual({ status: 200, ok: true, body: { id: 42 } });
    });

    it('handler sends a JSON body for write operations', async () => {
        const calls: Array<{ url: string; init: { method?: string; body?: unknown } }> = [];
        const fetchImpl = (async (url: string, init: { method?: string; body?: unknown }) => {
            calls.push({ url, init });
            return { status: 201, ok: true, text: async () => '' };
        }) as unknown as typeof fetch;

        const { handlers } = createOpenApiConnector({ document: doc, fetchImpl });
        await handlers.createPet({ body: { name: 'Rex' } });

        expect(calls[0].init.method).toBe('POST');
        expect(calls[0].init.body).toBe(JSON.stringify({ name: 'Rex' }));
    });

    it('throws when no base URL can be determined', () => {
        expect(() => createOpenApiConnector({ document: { info: { title: 'x' }, paths: {} } })).toThrow(/base URL/);
    });
});
