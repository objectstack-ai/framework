// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// Tiny in-repo MCP server (stdio) — the deterministic target for the
// showcase's declarative `provider: 'mcp'` connector instance (#3056,
// completing the live demo deferred from #3017 / ADR-0097 §6).
//
// Why a fixture instead of a real server: the demo must materialize during
// BOOT in CI (the Dogfood Regression Gate), so the target has to exist with
// no network, no ports, and no boot-ordering coupling. A stdio child process
// spawned at materialization is exactly that. The spawn is allowlisted by the
// host via `new ConnectorMcpPlugin({ declarativeStdio: ['node'] })` in
// objectstack.config.ts — dogfooding the #3055 opt-in.
//
// One deliberately boring, deterministic tool: `echo_upper` upper-cases the
// input text, so the flow run's captured output proves the whole chain
// (metadata entry → mcp provider factory → tools/list → connector_action
// dispatch → tools/call) with zero flakiness.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'showcase-mcp-fixture', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'echo_upper',
      description: 'Upper-case the input text (deterministic showcase demo tool).',
      inputSchema: {
        type: 'object',
        properties: { text: { type: 'string', description: 'Text to upper-case' } },
        required: ['text'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name !== 'echo_upper') {
    return { content: [{ type: 'text', text: `unknown tool: ${req.params.name}` }], isError: true };
  }
  const text = String(req.params.arguments?.text ?? '');
  const upper = text.toUpperCase();
  return {
    content: [{ type: 'text', text: upper }],
    structuredContent: { upper },
  };
});

await server.connect(new StdioServerTransport());
