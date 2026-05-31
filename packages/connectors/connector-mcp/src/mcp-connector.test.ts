// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import {
    createMcpConnector,
    type McpClientLike,
    type McpToolDescriptor,
} from './mcp-connector.js';

// ─── Helpers ─────────────────────────────────────────────────────────

interface CapturedCall {
    name: string;
    args: Record<string, unknown>;
}

/** A fake MCP client recording `tools/call` invocations and returning a fixed result. */
function fakeClient(
    tools: McpToolDescriptor[],
    result: unknown = { content: [{ type: 'text', text: 'ok' }] },
) {
    const calls: CapturedCall[] = [];
    let closed = false;
    const client: McpClientLike = {
        listTools: async () => tools,
        callTool: async (name, args) => {
            calls.push({ name, args });
            return result;
        },
        close: async () => {
            closed = true;
        },
    };
    return { client, calls, isClosed: () => closed };
}

const SAMPLE_TOOLS: McpToolDescriptor[] = [
    {
        name: 'create_issue',
        description: 'Create a GitHub issue',
        inputSchema: {
            type: 'object',
            properties: { repo: { type: 'string' }, title: { type: 'string' } },
            required: ['repo', 'title'],
        },
    },
    {
        name: 'list_issues',
        description: 'List issues in a repo',
        inputSchema: { type: 'object', properties: { repo: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { issues: { type: 'array' } } },
    },
];

// ─── tools/list → connector actions ───────────────────────────────────

describe('createMcpConnector — discovery maps tools to actions', () => {
    it('builds a type:api connector with one action per tool, mapping name/description/schemas', async () => {
        const { client } = fakeClient(SAMPLE_TOOLS);
        const { def } = await createMcpConnector({
            name: 'github_mcp',
            label: 'GitHub MCP',
            transport: { kind: 'stdio', command: 'noop' },
            clientFactory: async () => client,
        });

        expect(def.name).toBe('github_mcp');
        expect(def.label).toBe('GitHub MCP');
        expect(def.type).toBe('api');
        // Credentials live with the server — the def carries no upstream auth.
        expect(def.authentication).toEqual({ type: 'none' });

        expect(def.actions).toHaveLength(2);
        const create = def.actions?.find((a) => a.key === 'create_issue');
        expect(create?.description).toBe('Create a GitHub issue');
        expect(create?.label).toBe('Create Issue');
        expect(create?.inputSchema).toEqual(SAMPLE_TOOLS[0].inputSchema);
        // Tools without an outputSchema leave it unset.
        expect(create?.outputSchema).toBeUndefined();

        const list = def.actions?.find((a) => a.key === 'list_issues');
        expect(list?.outputSchema).toEqual(SAMPLE_TOOLS[1].outputSchema);
    });

    it('derives a snake_case name from the label when name is omitted', async () => {
        const { client } = fakeClient(SAMPLE_TOOLS);
        const { def } = await createMcpConnector({
            label: 'My Cool Server!',
            transport: { kind: 'http', url: 'https://mcp.example.com' },
            clientFactory: async () => client,
        });
        expect(def.name).toBe('my_cool_server');
        expect(def.name).toMatch(/^[a-z_][a-z0-9_]*$/);
    });

    it('applies the include allowlist to keep the palette lean', async () => {
        const { client } = fakeClient(SAMPLE_TOOLS);
        const { def, handlers } = await createMcpConnector({
            name: 'gh',
            transport: { kind: 'stdio', command: 'noop' },
            include: (tool) => tool === 'create_issue',
            clientFactory: async () => client,
        });
        expect(def.actions).toHaveLength(1);
        expect(def.actions?.[0].key).toBe('create_issue');
        expect(Object.keys(handlers)).toEqual(['create_issue']);
    });

    it('passes the configured transport and client info to the factory', async () => {
        const { client } = fakeClient(SAMPLE_TOOLS);
        const factory = vi.fn(async () => client);
        const transport = { kind: 'http' as const, url: 'https://mcp.example.com', headers: { Authorization: 'Bearer t' } };
        await createMcpConnector({
            name: 'gh',
            transport,
            clientInfo: { name: 'tester', version: '9.9.9' },
            clientFactory: factory,
        });
        expect(factory).toHaveBeenCalledWith(transport, { name: 'tester', version: '9.9.9' });
    });
});

// ─── tools/call dispatch + result normalisation ───────────────────────

describe('createMcpConnector — handlers dispatch to tools/call', () => {
    it('forwards input to callTool and normalises the result to an { ok, content } envelope', async () => {
        const { client, calls } = fakeClient(SAMPLE_TOOLS, {
            content: [{ type: 'text', text: 'created #1' }],
            structuredContent: { number: 1 },
        });
        const { handlers } = await createMcpConnector({
            name: 'gh',
            transport: { kind: 'stdio', command: 'noop' },
            clientFactory: async () => client,
        });

        const out = await handlers.create_issue({ repo: 'acme/app', title: 'Bug' }, {});

        expect(calls).toEqual([{ name: 'create_issue', args: { repo: 'acme/app', title: 'Bug' } }]);
        expect(out).toEqual({
            ok: true,
            content: [{ type: 'text', text: 'created #1' }],
            structuredContent: { number: 1 },
        });
    });

    it('surfaces a tool error as ok:false without throwing', async () => {
        const { client } = fakeClient(SAMPLE_TOOLS, {
            isError: true,
            content: [{ type: 'text', text: 'boom' }],
        });
        const { handlers } = await createMcpConnector({
            name: 'gh',
            transport: { kind: 'stdio', command: 'noop' },
            clientFactory: async () => client,
        });

        const out = await handlers.list_issues({ repo: 'acme/app' }, {});
        expect(out).toEqual({ ok: false, content: [{ type: 'text', text: 'boom' }], isError: true });
    });
});

// ─── lifecycle ────────────────────────────────────────────────────────

describe('createMcpConnector — lifecycle', () => {
    it('exposes close() that tears the client down', async () => {
        const { client, isClosed } = fakeClient(SAMPLE_TOOLS);
        const { close } = await createMcpConnector({
            name: 'gh',
            transport: { kind: 'stdio', command: 'noop' },
            clientFactory: async () => client,
        });
        expect(isClosed()).toBe(false);
        await close();
        expect(isClosed()).toBe(true);
    });

    it('closes the client when discovery (tools/list) fails', async () => {
        let closed = false;
        const client: McpClientLike = {
            listTools: async () => { throw new Error('list boom'); },
            callTool: async () => ({}),
            close: async () => { closed = true; },
        };
        await expect(
            createMcpConnector({
                name: 'gh',
                transport: { kind: 'stdio', command: 'noop' },
                clientFactory: async () => client,
            }),
        ).rejects.toThrow('list boom');
        expect(closed).toBe(true);
    });
});
