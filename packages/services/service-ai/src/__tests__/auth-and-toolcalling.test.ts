// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  AIMessage,
  AIResult,
  AIRequestOptions,
  AIStreamEvent,
  AIToolCall,
  LLMAdapter,
} from '@objectstack/spec/contracts';
import { AIService } from '../ai-service.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { buildAIRoutes } from '../routes/ai-routes.js';
import type { RouteDefinition, RouteUserContext } from '../routes/ai-routes.js';
import { InMemoryConversationService } from '../conversation/in-memory-conversation-service.js';

// ── Helpers ────────────────────────────────────────────────────────

const silentLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as any;

function createMockAdapter(responses: AIResult[]): LLMAdapter {
  let callIndex = 0;
  return {
    name: 'mock',
    chat: vi.fn(async () => responses[callIndex++] ?? { content: 'done' }),
    complete: vi.fn(async () => ({ content: '' })),
  };
}

function makeUser(userId: string, overrides: Partial<RouteUserContext> = {}): RouteUserContext {
  return { userId, ...overrides };
}

// ═══════════════════════════════════════════════════════════════════
// Auth / Permissions Metadata Tests (≥5)
// ═══════════════════════════════════════════════════════════════════

describe('Route Auth/Permissions Metadata', () => {
  let routes: RouteDefinition[];

  beforeEach(() => {
    const service = new AIService({ logger: silentLogger });
    routes = buildAIRoutes(service, service.conversationService, silentLogger);
  });

  it('should declare auth=true on all routes', () => {
    for (const route of routes) {
      expect(route.auth).toBe(true);
    }
  });

  it('should declare permissions on every route', () => {
    for (const route of routes) {
      expect(route.permissions).toBeDefined();
      expect(Array.isArray(route.permissions)).toBe(true);
      expect(route.permissions!.length).toBeGreaterThan(0);
    }
  });

  it('should declare ai:chat permission for chat routes', () => {
    const chatRoutes = routes.filter(
      r => r.path === '/api/v1/ai/chat' || r.path === '/api/v1/ai/chat/stream',
    );
    expect(chatRoutes.length).toBe(2);
    for (const route of chatRoutes) {
      expect(route.permissions).toContain('ai:chat');
    }
  });

  it('should declare ai:conversations permission for conversation routes', () => {
    const convRoutes = routes.filter(r => r.path.includes('/conversations'));
    expect(convRoutes.length).toBe(4);
    for (const route of convRoutes) {
      expect(route.permissions).toContain('ai:conversations');
    }
  });

  it('should declare ai:read permission for models route', () => {
    const modelsRoute = routes.find(r => r.path === '/api/v1/ai/models');
    expect(modelsRoute).toBeDefined();
    expect(modelsRoute!.permissions).toContain('ai:read');
  });

  it('should declare ai:complete permission for complete route', () => {
    const completeRoute = routes.find(r => r.path === '/api/v1/ai/complete');
    expect(completeRoute).toBeDefined();
    expect(completeRoute!.permissions).toContain('ai:complete');
  });

  it('should include description on every route', () => {
    for (const route of routes) {
      expect(typeof route.description).toBe('string');
      expect(route.description.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// User Context / Ownership Tests
// ═══════════════════════════════════════════════════════════════════

describe('Conversation Ownership Enforcement', () => {
  let service: AIService;
  let routes: RouteDefinition[];

  beforeEach(() => {
    service = new AIService({ logger: silentLogger });
    routes = buildAIRoutes(service, service.conversationService, silentLogger);
  });

  // Helper to find routes
  const getRoute = (method: string, path: string) =>
    routes.find(r => r.method === method && r.path === path)!;

  it('should bind userId to conversation when user context is present on create', async () => {
    const createRoute = getRoute('POST', '/api/v1/ai/conversations');
    const response = await createRoute.handler({
      body: { title: 'Test' },
      user: makeUser('user_1'),
    });
    expect(response.status).toBe(201);
    expect((response.body as any).userId).toBe('user_1');
  });

  it('should scope conversation listing to authenticated user', async () => {
    const createRoute = getRoute('POST', '/api/v1/ai/conversations');
    const listRoute = getRoute('GET', '/api/v1/ai/conversations');

    // Create conversations for two different users
    await createRoute.handler({ body: { title: 'User A conv' }, user: makeUser('user_a') });
    await createRoute.handler({ body: { title: 'User B conv' }, user: makeUser('user_b') });
    await createRoute.handler({ body: { title: 'User A conv 2' }, user: makeUser('user_a') });

    // User A should only see their own conversations
    const responseA = await listRoute.handler({ user: makeUser('user_a') });
    expect(responseA.status).toBe(200);
    expect((responseA.body as any).conversations).toHaveLength(2);

    // User B should only see their own conversations
    const responseB = await listRoute.handler({ user: makeUser('user_b') });
    expect(responseB.status).toBe(200);
    expect((responseB.body as any).conversations).toHaveLength(1);
  });

  it('should reject adding a message to another user conversation', async () => {
    const createRoute = getRoute('POST', '/api/v1/ai/conversations');
    const addMsgRoute = getRoute('POST', '/api/v1/ai/conversations/:id/messages');

    // Create a conversation owned by user_a
    const created = await createRoute.handler({
      body: {},
      user: makeUser('user_a'),
    });
    const convId = (created.body as any).id;

    // user_b tries to add a message → 403
    const response = await addMsgRoute.handler({
      params: { id: convId },
      body: { role: 'user', content: 'Sneaky' },
      user: makeUser('user_b'),
    });
    expect(response.status).toBe(403);
    expect((response.body as any).error).toContain('do not have access');
  });

  it('should reject deleting another user conversation', async () => {
    const createRoute = getRoute('POST', '/api/v1/ai/conversations');
    const deleteRoute = getRoute('DELETE', '/api/v1/ai/conversations/:id');

    const created = await createRoute.handler({
      body: {},
      user: makeUser('user_a'),
    });
    const convId = (created.body as any).id;

    // user_b tries to delete → 403
    const response = await deleteRoute.handler({
      params: { id: convId },
      user: makeUser('user_b'),
    });
    expect(response.status).toBe(403);
    expect((response.body as any).error).toContain('do not have access');
  });

  it('should allow owner to add message to their own conversation', async () => {
    const createRoute = getRoute('POST', '/api/v1/ai/conversations');
    const addMsgRoute = getRoute('POST', '/api/v1/ai/conversations/:id/messages');

    const created = await createRoute.handler({
      body: {},
      user: makeUser('user_a'),
    });
    const convId = (created.body as any).id;

    const response = await addMsgRoute.handler({
      params: { id: convId },
      body: { role: 'user', content: 'Hello' },
      user: makeUser('user_a'),
    });
    expect(response.status).toBe(200);
  });

  it('should allow owner to delete their own conversation', async () => {
    const createRoute = getRoute('POST', '/api/v1/ai/conversations');
    const deleteRoute = getRoute('DELETE', '/api/v1/ai/conversations/:id');

    const created = await createRoute.handler({
      body: {},
      user: makeUser('user_a'),
    });
    const convId = (created.body as any).id;

    const response = await deleteRoute.handler({
      params: { id: convId },
      user: makeUser('user_a'),
    });
    expect(response.status).toBe(204);
  });

  it('should return 404 when adding message to non-existent conversation (with user context)', async () => {
    const addMsgRoute = getRoute('POST', '/api/v1/ai/conversations/:id/messages');

    const response = await addMsgRoute.handler({
      params: { id: 'non_existent' },
      body: { role: 'user', content: 'Hello' },
      user: makeUser('user_a'),
    });
    expect(response.status).toBe(404);
  });

  it('should return 404 when deleting non-existent conversation (with user context)', async () => {
    const deleteRoute = getRoute('DELETE', '/api/v1/ai/conversations/:id');

    const response = await deleteRoute.handler({
      params: { id: 'non_existent' },
      user: makeUser('user_a'),
    });
    expect(response.status).toBe(404);
  });

  it('should still work without user context (backward compatible)', async () => {
    const createRoute = getRoute('POST', '/api/v1/ai/conversations');
    const listRoute = getRoute('GET', '/api/v1/ai/conversations');
    const addMsgRoute = getRoute('POST', '/api/v1/ai/conversations/:id/messages');
    const deleteRoute = getRoute('DELETE', '/api/v1/ai/conversations/:id');

    // Create without user context
    const created = await createRoute.handler({ body: { title: 'No user' } });
    expect(created.status).toBe(201);
    const convId = (created.body as any).id;

    // List without user context
    const listed = await listRoute.handler({});
    expect(listed.status).toBe(200);

    // Add message without user context
    const added = await addMsgRoute.handler({
      params: { id: convId },
      body: { role: 'user', content: 'Hi' },
    });
    expect(added.status).toBe(200);

    // Delete without user context
    const deleted = await deleteRoute.handler({ params: { id: convId } });
    expect(deleted.status).toBe(204);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Tool-Calling Enhancement Tests (≥8)
// ═══════════════════════════════════════════════════════════════════

describe('chatWithTools — Enhanced Error Handling', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    registry.register(
      { name: 'get_weather', description: 'Get weather', parameters: {} },
      async (args) => JSON.stringify({ temp: 22, city: args.city }),
    );
  });

  it('should invoke onToolError callback when a tool fails', async () => {
    registry.register(
      { name: 'bad_tool', description: 'Fails', parameters: {} },
      async () => { throw new Error('boom'); },
    );

    const onToolError = vi.fn().mockReturnValue('continue');
    const adapter = createMockAdapter([
      { content: '', toolCalls: [{ id: 'c1', name: 'bad_tool', arguments: '{}' }] },
      { content: 'Recovered' },
    ]);

    const service = new AIService({ adapter, logger: silentLogger, toolRegistry: registry });
    const result = await service.chatWithTools(
      [{ role: 'user', content: 'Use tool' }],
      { onToolError },
    );

    expect(onToolError).toHaveBeenCalledTimes(1);
    expect(onToolError).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'bad_tool' }),
      'boom',
    );
    expect(result.content).toBe('Recovered');
  });

  it('should abort the tool-call loop when onToolError returns abort', async () => {
    registry.register(
      { name: 'abort_tool', description: 'Abort', parameters: {} },
      async () => { throw new Error('critical failure'); },
    );

    const adapter = createMockAdapter([
      { content: '', toolCalls: [{ id: 'c1', name: 'abort_tool', arguments: '{}' }] },
      // This would be the forced-final call
      { content: 'Aborted cleanly' },
    ]);

    const service = new AIService({ adapter, logger: silentLogger, toolRegistry: registry });
    const result = await service.chatWithTools(
      [{ role: 'user', content: 'Critical' }],
      { onToolError: () => 'abort' },
    );

    // Should have called chat twice: once for the tool call, once for forced final
    expect(adapter.chat).toHaveBeenCalledTimes(2);
    expect(result.content).toBe('Aborted cleanly');
  });

  it('should not pass onToolError to adapter options', async () => {
    const adapter = createMockAdapter([{ content: 'ok' }]);
    const service = new AIService({ adapter, logger: silentLogger, toolRegistry: registry });

    await service.chatWithTools(
      [{ role: 'user', content: 'test' }],
      { onToolError: () => 'continue', model: 'gpt-4' },
    );

    const options = (adapter.chat as any).mock.calls[0][1];
    expect(options).not.toHaveProperty('onToolError');
    expect(options.model).toBe('gpt-4');
  });

  it('should continue by default when tool error and no onToolError callback', async () => {
    registry.register(
      { name: 'fail_tool', description: 'Fails', parameters: {} },
      async () => { throw new Error('oops'); },
    );

    const adapter = createMockAdapter([
      { content: '', toolCalls: [{ id: 'c1', name: 'fail_tool', arguments: '{}' }] },
      { content: 'Error was fed back to model' },
    ]);

    const service = new AIService({ adapter, logger: silentLogger, toolRegistry: registry });
    const result = await service.chatWithTools([{ role: 'user', content: 'test' }]);

    expect(adapter.chat).toHaveBeenCalledTimes(2);
    expect(result.content).toBe('Error was fed back to model');
  });

  it('should track tool errors and log them on max iterations', async () => {
    registry.register(
      { name: 'flaky_tool', description: 'Flaky', parameters: {} },
      async () => { throw new Error('flaky'); },
    );

    const infiniteToolCall: AIResult = {
      content: '',
      toolCalls: [{ id: 'c', name: 'flaky_tool', arguments: '{}' }],
    };
    const adapter = createMockAdapter(
      Array(2).fill(infiniteToolCall).concat([{ content: 'Forced' }]),
    );

    const service = new AIService({ adapter, logger: silentLogger, toolRegistry: registry });
    const result = await service.chatWithTools(
      [{ role: 'user', content: 'loop' }],
      { maxIterations: 2 },
    );

    // Should warn about max iterations with tool errors
    expect(silentLogger.warn).toHaveBeenCalledWith(
      '[AI] chatWithTools max iterations reached, forcing final response',
      expect.objectContaining({ toolErrors: expect.any(Array) }),
    );
    expect(result.content).toBe('Forced');
  });

  it('should handle mixed success and error tool calls in one round', async () => {
    registry.register(
      { name: 'bad_tool', description: 'Bad', parameters: {} },
      async () => { throw new Error('fail'); },
    );

    const adapter = createMockAdapter([
      {
        content: '',
        toolCalls: [
          { id: 'c1', name: 'get_weather', arguments: '{"city":"NYC"}' },
          { id: 'c2', name: 'bad_tool', arguments: '{}' },
        ],
      },
      { content: 'Weather ok, tool failed' },
    ]);

    const onToolError = vi.fn().mockReturnValue('continue');
    const service = new AIService({ adapter, logger: silentLogger, toolRegistry: registry });
    const result = await service.chatWithTools(
      [{ role: 'user', content: 'Both tools' }],
      { onToolError },
    );

    // Only called for the failing tool
    expect(onToolError).toHaveBeenCalledTimes(1);
    expect(onToolError).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'bad_tool' }),
      'fail',
    );

    // Both tool results fed back
    const secondCallMessages = (adapter.chat as any).mock.calls[1][0] as AIMessage[];
    const toolMessages = secondCallMessages.filter(m => m.role === 'tool');
    expect(toolMessages).toHaveLength(2);
    expect(result.content).toBe('Weather ok, tool failed');
  });
});

describe('streamChatWithTools', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    registry.register(
      { name: 'get_weather', description: 'Get weather', parameters: {} },
      async (args) => JSON.stringify({ temp: 22, city: args.city }),
    );
  });

  it('should stream final response when no tool calls', async () => {
    const adapter: LLMAdapter = {
      name: 'mock-stream',
      chat: vi.fn(async () => ({ content: 'Hello!' })),
      complete: vi.fn(async () => ({ content: '' })),
      async *streamChat() {
        yield { type: 'text-delta' as const, textDelta: 'Hello!' };
        yield { type: 'finish' as const, result: { content: 'Hello!' } };
      },
    };

    const service = new AIService({ adapter, logger: silentLogger, toolRegistry: registry });
    const events: AIStreamEvent[] = [];
    for await (const event of service.streamChatWithTools([{ role: 'user', content: 'Hi' }])) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[events.length - 1].type).toBe('finish');
  });

  it('should emit tool-call events during tool resolution', async () => {
    const toolCall: AIToolCall = {
      id: 'call_1',
      name: 'get_weather',
      arguments: JSON.stringify({ city: 'Tokyo' }),
    };

    let chatCallIndex = 0;
    const adapter: LLMAdapter = {
      name: 'mock-stream',
      chat: vi.fn(async () => {
        chatCallIndex++;
        if (chatCallIndex === 1) {
          return { content: '', toolCalls: [toolCall] };
        }
        return { content: 'Tokyo is 22°C' };
      }),
      complete: vi.fn(async () => ({ content: '' })),
      async *streamChat() {
        yield { type: 'text-delta' as const, textDelta: 'Tokyo is 22°C' };
        yield { type: 'finish' as const, result: { content: 'Tokyo is 22°C' } };
      },
    };

    const service = new AIService({ adapter, logger: silentLogger, toolRegistry: registry });
    const events: AIStreamEvent[] = [];
    for await (const event of service.streamChatWithTools(
      [{ role: 'user', content: 'Weather in Tokyo?' }],
    )) {
      events.push(event);
    }

    // Should have tool-call event followed by streaming events
    const toolCallEvents = events.filter(e => e.type === 'tool-call');
    expect(toolCallEvents).toHaveLength(1);
    expect(toolCallEvents[0].toolCall?.name).toBe('get_weather');

    const finishEvent = events.find(e => e.type === 'finish');
    expect(finishEvent).toBeDefined();
  });

  it('should fall back to non-streaming when adapter has no streamChat', async () => {
    const adapter: LLMAdapter = {
      name: 'no-stream',
      chat: vi.fn(async () => ({ content: 'Fallback response' })),
      complete: vi.fn(async () => ({ content: '' })),
      // no streamChat
    };

    const emptyRegistry = new ToolRegistry();
    const service = new AIService({ adapter, logger: silentLogger, toolRegistry: emptyRegistry });
    const events: AIStreamEvent[] = [];
    for await (const event of service.streamChatWithTools(
      [{ role: 'user', content: 'Hi' }],
    )) {
      events.push(event);
    }

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('text-delta');
    expect(events[0].textDelta).toBe('Fallback response');
    expect(events[1].type).toBe('finish');
  });

  it('should respect maxIterations in streaming tool loop', async () => {
    const infiniteToolCall: AIResult = {
      content: '',
      toolCalls: [{ id: 'c', name: 'get_weather', arguments: '{"city":"X"}' }],
    };

    let callIndex = 0;
    const adapter: LLMAdapter = {
      name: 'mock',
      chat: vi.fn(async () => {
        callIndex++;
        if (callIndex <= 5) return infiniteToolCall;
        return { content: 'Forced stop' };
      }),
      complete: vi.fn(async () => ({ content: '' })),
      async *streamChat() {
        yield { type: 'text-delta' as const, textDelta: 'Forced stop' };
        yield { type: 'finish' as const, result: { content: 'Forced stop' } };
      },
    };

    const service = new AIService({ adapter, logger: silentLogger, toolRegistry: registry });
    const events: AIStreamEvent[] = [];
    for await (const event of service.streamChatWithTools(
      [{ role: 'user', content: 'Loop' }],
      { maxIterations: 2 },
    )) {
      events.push(event);
    }

    // 2 iterations of tool calls via adapter.chat, then forced streaming via adapter.streamChat
    expect(adapter.chat).toHaveBeenCalledTimes(2);
    expect(events.some(e => e.type === 'finish')).toBe(true);
  });

  it('should abort streaming tool loop on onToolError returning abort', async () => {
    registry.register(
      { name: 'critical_fail', description: 'Fails critically', parameters: {} },
      async () => { throw new Error('critical'); },
    );

    let chatCallIndex = 0;
    const adapter: LLMAdapter = {
      name: 'mock-stream',
      chat: vi.fn(async () => {
        chatCallIndex++;
        if (chatCallIndex === 1) {
          return {
            content: '',
            toolCalls: [{ id: 'c1', name: 'critical_fail', arguments: '{}' }],
          };
        }
        return { content: 'Aborted' };
      }),
      complete: vi.fn(async () => ({ content: '' })),
      async *streamChat() {
        yield { type: 'text-delta' as const, textDelta: 'Aborted' };
        yield { type: 'finish' as const, result: { content: 'Aborted' } };
      },
    };

    const service = new AIService({ adapter, logger: silentLogger, toolRegistry: registry });
    const events: AIStreamEvent[] = [];
    for await (const event of service.streamChatWithTools(
      [{ role: 'user', content: 'Critical' }],
      { onToolError: () => 'abort' },
    )) {
      events.push(event);
    }

    // Should have the tool-call event + forced streaming final
    expect(events.some(e => e.type === 'finish')).toBe(true);
  });
});
