// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { LiteKernel } from '@objectstack/core';
import { AutomationServicePlugin, type AutomationEngine } from '@objectstack/service-automation';
import { ConnectorMcpPlugin } from './connector-mcp-plugin.js';
import type { McpClientLike, McpToolDescriptor } from './mcp-connector.js';

const TOOLS: McpToolDescriptor[] = [
    {
        name: 'create_issue',
        description: 'Create a GitHub issue',
        inputSchema: {
            type: 'object',
            properties: { repo: { type: 'string' }, title: { type: 'string' } },
            required: ['repo', 'title'],
        },
    },
];

/** A fake MCP client recording calls; injected via the plugin's clientFactory. */
function fakeClient() {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    let closed = false;
    const client: McpClientLike = {
        listTools: async () => TOOLS,
        callTool: async (name, args) => {
            calls.push({ name, args });
            return { content: [{ type: 'text', text: 'created #42' }], structuredContent: { number: 42 } };
        },
        close: async () => { closed = true; },
    };
    return { client, calls, isClosed: () => closed };
}

describe('ConnectorMcpPlugin — end to end with the automation engine', () => {
    it('registers the MCP-backed connector so a connector_action flow dispatches to tools/call', async () => {
        const { client, calls, isClosed } = fakeClient();

        const kernel = new LiteKernel();
        kernel.use(new AutomationServicePlugin());
        kernel.use(
            new ConnectorMcpPlugin({
                // NOTE deliberately no `declarativeStdio`: the #3055 default-deny
                // policy gates DECLARATIVE instances only — this hand-wired stdio
                // transport (host code, not metadata) must keep working un-gated.
                name: 'github_mcp',
                label: 'GitHub MCP',
                transport: { kind: 'stdio', command: 'noop' },
                clientFactory: async () => client,
            }),
        );
        await kernel.bootstrap();

        const engine = kernel.getService<AutomationEngine>('automation');

        // The baseline node and the MCP-backed connector are both present; to the
        // registry it is an ordinary connector.
        expect(engine.getRegisteredNodeTypes()).toContain('connector_action');
        expect(engine.getRegisteredConnectors()).toContain('github_mcp');

        engine.registerFlow('open_issue', {
            name: 'open_issue',
            label: 'Open an issue via MCP',
            type: 'autolaunched',
            variables: [{ name: 'call.structuredContent', type: 'json', isOutput: true }],
            nodes: [
                { id: 'start', type: 'start', label: 'Start' },
                {
                    id: 'call',
                    type: 'connector_action',
                    label: 'create_issue',
                    connectorConfig: {
                        connectorId: 'github_mcp',
                        actionId: 'create_issue',
                        input: { repo: 'acme/app', title: 'Bug' },
                    },
                },
                { id: 'end', type: 'end', label: 'End' },
            ],
            edges: [
                { id: 'e1', source: 'start', target: 'call' },
                { id: 'e2', source: 'call', target: 'end' },
            ],
        });

        const result = await engine.execute('open_issue');

        expect(result.success).toBe(true);
        // The MCP connector handled the dispatch: one tools/call with the input.
        expect(calls).toEqual([{ name: 'create_issue', args: { repo: 'acme/app', title: 'Bug' } }]);
        // The normalised structuredContent propagated back into the flow.
        expect(result.output).toEqual({ 'call.structuredContent': { number: 42 } });

        // Shutdown tears the MCP connection down.
        await kernel.shutdown();
        expect(isClosed()).toBe(true);
    });

    it('plumbs declarativeStdio through to the registered provider factory (#3055)', async () => {
        const { client } = fakeClient();
        let registered: ((ctx: unknown) => Promise<unknown>) | undefined;
        const automationStub = {
            registerConnector: () => {},
            unregisterConnector: () => {},
            registerConnectorProvider: (_key: string, factory: never) => { registered = factory; },
        };
        const plugin = new ConnectorMcpPlugin({
            clientFactory: async () => client,
            declarativeStdio: ['trusted-mcp'],
        });
        await plugin.init({
            getService: () => automationStub,
            logger: { info: () => {}, warn: () => {} },
        } as never);
        expect(registered).toBeDefined();

        const provider = registered!;
        const declarativeCtx = (command: string) => ({
            name: 'x', label: 'X', type: 'api',
            providerConfig: { transport: { kind: 'stdio', command } },
        });
        // Allowlisted command materializes; anything else is denied by policy.
        await expect(provider(declarativeCtx('trusted-mcp'))).resolves.toBeDefined();
        await expect(provider(declarativeCtx('bash'))).rejects.toThrow(/declarativeStdio allowlist/);
    });
});
