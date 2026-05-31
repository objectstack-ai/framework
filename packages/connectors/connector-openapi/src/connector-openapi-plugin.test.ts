import { describe, it, expect, vi } from 'vitest';
import { registerOpenApiConnector } from './connector-openapi-plugin';
import type { AutomationEngine } from '@objectstack/service-automation';
import type { OpenApiDocument } from './openapi-connector';

const doc: OpenApiDocument = {
    info: { title: 'Mini' },
    servers: [{ url: 'https://api.mini.example.com' }],
    paths: {
        '/ping': { get: { operationId: 'ping', responses: { '200': { description: 'ok' } } } },
    },
};

describe('registerOpenApiConnector', () => {
    it('registers the generated definition + handlers on the engine', () => {
        const registerConnector = vi.fn();
        const engine = { registerConnector } as unknown as AutomationEngine;
        registerOpenApiConnector(engine, { document: doc });
        expect(registerConnector).toHaveBeenCalledTimes(1);
        const [def, handlers] = registerConnector.mock.calls[0];
        expect(def.name).toBe('mini');
        expect(typeof handlers.ping).toBe('function');
    });
});
