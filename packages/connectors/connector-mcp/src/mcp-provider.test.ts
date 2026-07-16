// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// ADR-0097 — the `mcp` provider factory: materialize a declarative
// `provider: 'mcp'` connector instance by connecting to the server (an injected
// fake client here), listing its tools, and mapping them to actions.

import { describe, it, expect } from 'vitest';
import type { ConnectorProviderContext } from '@objectstack/spec/integration';
import { isConnectorUpstreamUnavailable } from '@objectstack/spec/integration';
import type { McpClientLike, McpToolDescriptor, McpTransport } from './mcp-connector.js';
import { createMcpProviderFactory, MCP_PROVIDER_KEY } from './mcp-provider.js';

const TOOLS: McpToolDescriptor[] = [
    { name: 'create_issue', description: 'Create an issue', inputSchema: { type: 'object' } },
    { name: 'list_issues', description: 'List issues' },
];

/** Capture the transport the factory built, and serve fixed tools. */
function fakeClientFactory() {
    const seen: { transport?: McpTransport } = {};
    let closed = false;
    const factory = async (transport: McpTransport): Promise<McpClientLike> => {
        seen.transport = transport;
        return {
            listTools: async () => TOOLS,
            callTool: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
            close: async () => { closed = true; },
        };
    };
    return { factory, seen, isClosed: () => closed };
}

function ctx(partial: Partial<ConnectorProviderContext> & Pick<ConnectorProviderContext, 'providerConfig'>): ConnectorProviderContext {
    return { name: 'github', label: 'GitHub', type: 'api', ...partial };
}

describe('mcp provider factory (ADR-0097)', () => {
    it('advertises the mcp provider key', () => {
        expect(MCP_PROVIDER_KEY).toBe('mcp');
    });

    it('connects, lists tools, and maps them to actions', async () => {
        const { factory: clientFactory } = fakeClientFactory();
        const factory = createMcpProviderFactory({ clientFactory });
        const mat = await factory(ctx({ providerConfig: { transport: { kind: 'stdio', command: 'my-mcp' } } }));
        expect(mat.def.name).toBe('github');
        expect(Object.keys(mat.handlers).sort()).toEqual(['create_issue', 'list_issues']);
        expect(typeof mat.close).toBe('function');
    });

    it('applies the tool allowlist from providerConfig.include', async () => {
        const { factory: clientFactory } = fakeClientFactory();
        const factory = createMcpProviderFactory({ clientFactory });
        const mat = await factory(
            ctx({ providerConfig: { transport: { kind: 'stdio', command: 'my-mcp' }, include: ['create_issue'] } }),
        );
        expect(Object.keys(mat.handlers)).toEqual(['create_issue']);
    });

    it('folds resolved bearer auth into an http transport header', async () => {
        const captured = fakeClientFactory();
        const factory = createMcpProviderFactory({ clientFactory: captured.factory });
        await factory(
            ctx({
                providerConfig: { transport: { kind: 'http', url: 'https://mcp.example.com' } },
                auth: { type: 'bearer', token: 'tok' },
            }),
        );
        const t = captured.seen.transport;
        expect(t?.kind).toBe('http');
        expect(t?.kind === 'http' && t.headers?.Authorization).toBe('Bearer tok');
    });

    it('throws when the transport is missing', async () => {
        const factory = createMcpProviderFactory();
        await expect(factory(ctx({ providerConfig: {} }))).rejects.toThrow(/providerConfig\.transport/);
    });

    it('throws for an unknown transport kind', async () => {
        const factory = createMcpProviderFactory();
        await expect(
            factory(ctx({ providerConfig: { transport: { kind: 'carrier-pigeon' } } })),
        ).rejects.toThrow(/kind must be 'stdio' or 'http'/);
    });
});

// ── #3017 — fault classification: config stays fatal, upstream degrades ─────

describe('mcp provider fault classification (#3017)', () => {
    const stdio = { transport: { kind: 'stdio', command: 'my-mcp' } };

    it('classifies a connect failure as upstream-unavailable (retryable), keeping the cause', async () => {
        const boom = new Error('connect ECONNREFUSED 127.0.0.1:9999');
        const clientFactory = async (): Promise<McpClientLike> => { throw boom; };
        const factory = createMcpProviderFactory({ clientFactory });

        const err = await factory(ctx({ providerConfig: stdio })).then(
            () => { throw new Error('expected rejection'); },
            (e: unknown) => e,
        );
        expect(isConnectorUpstreamUnavailable(err)).toBe(true);
        expect((err as Error).message).toMatch(/'github' could not reach its MCP server/);
        expect((err as Error).message).toContain('ECONNREFUSED');
        expect((err as { cause?: unknown }).cause).toBe(boom);
    });

    it('classifies a tools/list failure as upstream-unavailable and closes the client', async () => {
        let closed = false;
        const clientFactory = async (): Promise<McpClientLike> => ({
            listTools: async () => { throw new Error('request timed out'); },
            callTool: async () => ({}),
            close: async () => { closed = true; },
        });
        const factory = createMcpProviderFactory({ clientFactory });

        const err = await factory(ctx({ providerConfig: stdio })).then(
            () => { throw new Error('expected rejection'); },
            (e: unknown) => e,
        );
        expect(isConnectorUpstreamUnavailable(err)).toBe(true);
        expect(closed).toBe(true); // discovery failure must not leak the connection
    });

    it('keeps transport-shape faults plain — configuration errors stay fatal at boot', async () => {
        const factory = createMcpProviderFactory();
        const err = await factory(ctx({ providerConfig: {} })).then(
            () => { throw new Error('expected rejection'); },
            (e: unknown) => e,
        );
        expect(isConnectorUpstreamUnavailable(err)).toBe(false);
    });
});
