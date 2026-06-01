// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import { registerOpenApiConnector, type ConnectorRegistrySurface } from './connector-openapi-plugin.js';
import type { OpenApiDocument } from './openapi-connector.js';

const doc: OpenApiDocument = {
    info: { title: 'Mini' },
    servers: [{ url: 'https://api.mini.example.com' }],
    paths: {
        '/ping': { get: { operationId: 'ping', responses: { '200': { description: 'ok' } } } },
    },
};

describe('registerOpenApiConnector', () => {
    it('registers the generated definition + handlers on the registry', () => {
        const registerConnector = vi.fn();
        const registry = { registerConnector, unregisterConnector: vi.fn() } as unknown as ConnectorRegistrySurface;

        const name = registerOpenApiConnector(registry, { document: doc });

        expect(name).toBe('mini');
        expect(registerConnector).toHaveBeenCalledTimes(1);
        const [def, handlers] = registerConnector.mock.calls[0];
        expect(def.name).toBe('mini');
        expect(typeof handlers.ping).toBe('function');
    });
});
