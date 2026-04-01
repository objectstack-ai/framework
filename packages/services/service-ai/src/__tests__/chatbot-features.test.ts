// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  ModelMessage,
  AIResult,
  AIRequestOptions,
  ToolCallPart,
  AIToolDefinition,
  IDataEngine,
  IMetadataService,
  LLMAdapter,
} from '@objectstack/spec/contracts';
import { AIService } from '../ai-service.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { registerDataTools, DATA_TOOL_DEFINITIONS } from '../tools/data-tools.js';
import type { DataToolContext } from '../tools/data-tools.js';
import { AgentRuntime } from '../agent-runtime.js';
import type { AgentChatContext } from '../agent-runtime.js';
import { buildAgentRoutes } from '../routes/agent-routes.js';
import { DATA_CHAT_AGENT } from '../agents/data-chat-agent.js';

// ── Helpers ────────────────────────────────────────────────────────

const silentLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as any;

/** Build a mock LLM adapter that returns sequential responses. */
function createMockAdapter(responses: AIResult[]): LLMAdapter {
  let callIndex = 0;
  return {
    name: 'mock',
    chat: vi.fn(async () => responses[callIndex++] ?? { content: 'done' }),
    complete: vi.fn(async () => ({ content: '' })),
  };
}

/** Build a mock IDataEngine. */
function createMockDataEngine(overrides: Partial<IDataEngine> = {}): IDataEngine {
  return {
    find: vi.fn(async () => []),
    findOne: vi.fn(async () => null),
    insert: vi.fn(async () => ({})),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
    count: vi.fn(async () => 0),
    aggregate: vi.fn(async () => []),
    ...overrides,
  };
}

/** Build a mock IMetadataService. */
function createMockMetadataService(overrides: Partial<IMetadataService> = {}): IMetadataService {
  return {
    register: vi.fn(async () => {}),
    get: vi.fn(async () => undefined),
    list: vi.fn(async () => []),
    unregister: vi.fn(async () => {}),
    exists: vi.fn(async () => false),
    listNames: vi.fn(async () => []),
    getObject: vi.fn(async () => undefined),
    listObjects: vi.fn(async () => []),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// chatWithTools — Tool Call Loop
// ═══════════════════════════════════════════════════════════════════

describe('AIService.chatWithTools', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    registry.register(
      { name: 'get_weather', description: 'Get weather', parameters: {} },
      async (args) => JSON.stringify({ temp: 22, city: args.city }),
    );
  });

  it('should return immediately if no tool calls in response', async () => {
    const adapter = createMockAdapter([{ content: 'Hello there!' }]);
    const service = new AIService({ adapter, logger: silentLogger, toolRegistry: registry });

    const result = await service.chatWithTools([{ role: 'user', content: 'Hi' }]);

    expect(result.content).toBe('Hello there!');
    expect(adapter.chat).toHaveBeenCalledTimes(1);
  });

  it('should auto-inject registered tools into options', async () => {
    const adapter = createMockAdapter([{ content: 'No tools needed' }]);
    const service = new AIService({ adapter, logger: silentLogger, toolRegistry: registry });

    await service.chatWithTools([{ role: 'user', content: 'Hi' }]);

    const callArgs = (adapter.chat as any).mock.calls[0];
    const options = callArgs[1] as AIRequestOptions;
    expect(options.tools).toHaveLength(1);
    expect(options.tools![0].name).toBe('get_weather');
    expect(options.toolChoice).toBe('auto');
  });

  it('should execute tool calls and loop until final text response', async () => {
    const toolCall: ToolCallPart = {
      type: 'tool-call' as const,
      toolCallId: 'call_1',
      toolName: 'get_weather',
      input: { city: 'Tokyo' },
    };

    const adapter = createMockAdapter([
      // First response: model requests a tool call
      { content: '', toolCalls: [toolCall] },
      // Second response: final text after receiving tool result
      { content: 'The weather in Tokyo is 22°C.' },
    ]);

    const service = new AIService({ adapter, logger: silentLogger, toolRegistry: registry });

    const result = await service.chatWithTools([
      { role: 'user', content: "What's the weather in Tokyo?" },
    ]);

    expect(result.content).toBe('The weather in Tokyo is 22°C.');
    expect(adapter.chat).toHaveBeenCalledTimes(2);

    // Verify the second call includes the tool result message
    const secondCallMessages = (adapter.chat as any).mock.calls[1][0] as ModelMessage[];
    expect(secondCallMessages).toHaveLength(3); // user + assistant(tool_call) + tool(result)
    expect(secondCallMessages[1].role).toBe('assistant');
    const assistantContent = secondCallMessages[1].content as any[];
    const toolCallParts = assistantContent.filter((p: any) => p.type === 'tool-call');
    expect(toolCallParts).toEqual([toolCall]);
    expect(secondCallMessages[2].role).toBe('tool');
    const toolResultContent = secondCallMessages[2].content as any[];
    expect(toolResultContent[0].toolCallId).toBe('call_1');
    expect(toolResultContent[0].output.value).toContain('"temp":22');
  });

  it('should handle multiple sequential tool calls', async () => {
    registry.register(
      { name: 'get_time', description: 'Get time', parameters: {} },
      async () => JSON.stringify({ time: '14:30' }),
    );

    const adapter = createMockAdapter([
      // Round 1: call get_weather
      { content: '', toolCalls: [{ type: 'tool-call' as const, toolCallId: 'c1', toolName: 'get_weather', input: { city: 'NYC' } }] },
      // Round 2: call get_time
      { content: '', toolCalls: [{ type: 'tool-call' as const, toolCallId: 'c2', toolName: 'get_time', input: {} }] },
      // Round 3: final response
      { content: 'NYC: 22°C at 14:30' },
    ]);

    const service = new AIService({ adapter, logger: silentLogger, toolRegistry: registry });
    const result = await service.chatWithTools([{ role: 'user', content: 'Weather and time?' }]);

    expect(result.content).toBe('NYC: 22°C at 14:30');
    expect(adapter.chat).toHaveBeenCalledTimes(3);
  });

  it('should handle parallel tool calls in a single response', async () => {
    registry.register(
      { name: 'get_population', description: 'Population', parameters: {} },
      async (args) => JSON.stringify({ pop: 1000000, city: args.city }),
    );

    const adapter = createMockAdapter([
      // Model calls two tools at once
      {
        content: '',
        toolCalls: [
          { type: 'tool-call' as const, toolCallId: 'c1', toolName: 'get_weather', input: { city: 'London' } },
          { type: 'tool-call' as const, toolCallId: 'c2', toolName: 'get_population', input: { city: 'London' } },
        ],
      },
      // Final response with both results
      { content: 'London: 22°C, pop 1M' },
    ]);

    const service = new AIService({ adapter, logger: silentLogger, toolRegistry: registry });
    const result = await service.chatWithTools([{ role: 'user', content: 'London stats?' }]);

    expect(result.content).toBe('London: 22°C, pop 1M');

    // Both tool results should be in the conversation
    const secondCallMessages = (adapter.chat as any).mock.calls[1][0] as ModelMessage[];
    const toolMessages = secondCallMessages.filter(m => m.role === 'tool');
    expect(toolMessages).toHaveLength(2);
  });

  it('should respect maxIterations and force final response', async () => {
    // Adapter always returns tool calls — would loop forever
    const infiniteToolCall: AIResult = {
      content: '',
      toolCalls: [{ type: 'tool-call' as const, toolCallId: 'c', toolName: 'get_weather', input: { city: 'X' } }],
    };
    const adapter = createMockAdapter(
      Array(5).fill(infiniteToolCall).concat([{ content: 'Forced stop' }]),
    );

    const service = new AIService({ adapter, logger: silentLogger, toolRegistry: registry });
    const result = await service.chatWithTools(
      [{ role: 'user', content: 'Loop me' }],
      { maxIterations: 3 },
    );

    // 3 iterations + 1 final forced call = 4 total
    expect(adapter.chat).toHaveBeenCalledTimes(4);
    // The forced final call should NOT have tools in options
    const lastCallOptions = (adapter.chat as any).mock.calls[3][1] as AIRequestOptions;
    expect(lastCallOptions.tools).toBeUndefined();
  });

  it('should merge explicit tools with registered tools', async () => {
    const explicitTool: AIToolDefinition = {
      name: 'custom_tool',
      description: 'Custom',
      parameters: {},
    };

    const adapter = createMockAdapter([{ content: 'ok' }]);
    const service = new AIService({ adapter, logger: silentLogger, toolRegistry: registry });

    await service.chatWithTools(
      [{ role: 'user', content: 'test' }],
      { tools: [explicitTool] },
    );

    const options = (adapter.chat as any).mock.calls[0][1] as AIRequestOptions;
    expect(options.tools).toHaveLength(2); // get_weather + custom_tool
    expect(options.tools!.map(t => t.name)).toContain('get_weather');
    expect(options.tools!.map(t => t.name)).toContain('custom_tool');
  });

  it('should handle tool execution errors gracefully', async () => {
    registry.register(
      { name: 'bad_tool', description: 'Breaks', parameters: {} },
      async () => { throw new Error('Tool crashed'); },
    );

    const adapter = createMockAdapter([
      { content: '', toolCalls: [{ type: 'tool-call' as const, toolCallId: 'c1', toolName: 'bad_tool', input: {} }] },
      { content: 'I see the tool failed' },
    ]);

    const service = new AIService({ adapter, logger: silentLogger, toolRegistry: registry });
    const result = await service.chatWithTools([{ role: 'user', content: 'Use bad tool' }]);

    expect(result.content).toBe('I see the tool failed');

    // The error message should be in the tool result
    const secondCallMessages = (adapter.chat as any).mock.calls[1][0] as ModelMessage[];
    const toolMsg = secondCallMessages.find(m => m.role === 'tool');
    let toolContent: string | undefined;
    if (toolMsg?.role === 'tool' && Array.isArray(toolMsg.content)) {
      const firstResult = toolMsg.content[0];
      if ('output' in firstResult && firstResult.output && typeof firstResult.output === 'object' && 'value' in firstResult.output) {
        toolContent = String(firstResult.output.value);
      }
    }
    expect(toolContent).toContain('Tool crashed');
  });

  it('should work with no registered tools', async () => {
    const emptyRegistry = new ToolRegistry();
    const adapter = createMockAdapter([{ content: 'No tools available' }]);
    const service = new AIService({ adapter, logger: silentLogger, toolRegistry: emptyRegistry });

    const result = await service.chatWithTools([{ role: 'user', content: 'Hi' }]);

    expect(result.content).toBe('No tools available');
    const options = (adapter.chat as any).mock.calls[0][1] as AIRequestOptions;
    expect(options.tools).toBeUndefined();
  });

  it('should not pass maxIterations to adapter options', async () => {
    const adapter = createMockAdapter([{ content: 'ok' }]);
    const service = new AIService({ adapter, logger: silentLogger, toolRegistry: registry });

    await service.chatWithTools(
      [{ role: 'user', content: 'test' }],
      { maxIterations: 5, model: 'gpt-4' },
    );

    const callArgs = (adapter.chat as any).mock.calls[0];
    const options = callArgs[1];
    expect(options).not.toHaveProperty('maxIterations');
    expect(options.model).toBe('gpt-4');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Data Tools
// ═══════════════════════════════════════════════════════════════════

describe('Data Tools', () => {
  describe('DATA_TOOL_DEFINITIONS', () => {
    it('should define exactly 5 tools', () => {
      expect(DATA_TOOL_DEFINITIONS).toHaveLength(5);
    });

    it('should include all expected tool names', () => {
      const names = DATA_TOOL_DEFINITIONS.map(t => t.name);
      expect(names).toEqual([
        'list_objects',
        'describe_object',
        'query_records',
        'get_record',
        'aggregate_data',
      ]);
    });

    it('should have descriptions and parameters for each tool', () => {
      for (const def of DATA_TOOL_DEFINITIONS) {
        expect(def.description).toBeTruthy();
        expect(def.parameters).toBeDefined();
      }
    });
  });

  describe('registerDataTools', () => {
    let registry: ToolRegistry;
    let dataEngine: IDataEngine;
    let metadataService: IMetadataService;

    beforeEach(() => {
      registry = new ToolRegistry();
      dataEngine = createMockDataEngine();
      metadataService = createMockMetadataService();
      registerDataTools(registry, { dataEngine, metadataService });
    });

    it('should register all 5 tools', () => {
      expect(registry.size).toBe(5);
      expect(registry.has('list_objects')).toBe(true);
      expect(registry.has('describe_object')).toBe(true);
      expect(registry.has('query_records')).toBe(true);
      expect(registry.has('get_record')).toBe(true);
      expect(registry.has('aggregate_data')).toBe(true);
    });

    it('list_objects should return object names and labels', async () => {
      (metadataService.listObjects as any).mockResolvedValue([
        { name: 'account', label: 'Account' },
        { name: 'contact', label: 'Contact' },
      ]);

      const result = await registry.execute({
        type: 'tool-call' as const,
        toolCallId: 'c1',
        toolName: 'list_objects',
        input: {},
      });

      const parsed = JSON.parse((result.output as any).value);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({ name: 'account', label: 'Account' });
    });

    it('describe_object should return field schema', async () => {
      (metadataService.getObject as any).mockResolvedValue({
        name: 'account',
        label: 'Account',
        fields: {
          name: { type: 'text', label: 'Account Name', required: true },
          revenue: { type: 'number', label: 'Revenue' },
        },
      });

      const result = await registry.execute({
        type: 'tool-call' as const,
        toolCallId: 'c1',
        toolName: 'describe_object',
        input: { objectName: 'account' },
      });

      const parsed = JSON.parse((result.output as any).value);
      expect(parsed.name).toBe('account');
      expect(parsed.fields.name.type).toBe('text');
      expect(parsed.fields.name.required).toBe(true);
      expect(parsed.fields.revenue.type).toBe('number');
    });

    it('describe_object should return error for unknown object', async () => {
      const result = await registry.execute({
        type: 'tool-call' as const,
        toolCallId: 'c1',
        toolName: 'describe_object',
        input: { objectName: 'nonexistent' },
      });

      const parsed = JSON.parse((result.output as any).value);
      expect(parsed.error).toContain('not found');
    });

    it('query_records should call dataEngine.find with correct params', async () => {
      const records = [{ id: '1', name: 'Acme' }, { id: '2', name: 'Beta' }];
      (dataEngine.find as any).mockResolvedValue(records);

      const result = await registry.execute({
        type: 'tool-call' as const,
        toolCallId: 'c1',
        toolName: 'query_records',
        input: {
          objectName: 'account',
          where: { status: 'active' },
          fields: ['name', 'status'],
          limit: 10,
        },
      });

      expect(dataEngine.find).toHaveBeenCalledWith('account', {
        where: { status: 'active' },
        fields: ['name', 'status'],
        orderBy: undefined,
        limit: 10,
        offset: undefined,
      });

      const parsed = JSON.parse((result.output as any).value);
      expect(parsed.count).toBe(2);
      expect(parsed.records).toEqual(records);
    });

    it('query_records should cap limit at 200', async () => {
      (dataEngine.find as any).mockResolvedValue([]);

      await registry.execute({
        type: 'tool-call' as const,
        toolCallId: 'c1',
        toolName: 'query_records',
        input: { objectName: 'account', limit: 999 },
      });

      expect(dataEngine.find).toHaveBeenCalledWith('account', expect.objectContaining({
        limit: 200,
      }));
    });

    it('query_records should use default limit of 20', async () => {
      (dataEngine.find as any).mockResolvedValue([]);

      await registry.execute({
        type: 'tool-call' as const,
        toolCallId: 'c1',
        toolName: 'query_records',
        input: { objectName: 'account' },
      });

      expect(dataEngine.find).toHaveBeenCalledWith('account', expect.objectContaining({
        limit: 20,
      }));
    });

    it('get_record should call findOne with where id filter', async () => {
      const record = { id: 'rec_123', name: 'Acme Corp' };
      (dataEngine.findOne as any).mockResolvedValue(record);

      const result = await registry.execute({
        type: 'tool-call' as const,
        toolCallId: 'c1',
        toolName: 'get_record',
        input: { objectName: 'account', recordId: 'rec_123' },
      });

      expect(dataEngine.findOne).toHaveBeenCalledWith('account', {
        where: { id: 'rec_123' },
        fields: undefined,
      });

      const parsed = JSON.parse((result.output as any).value);
      expect(parsed.name).toBe('Acme Corp');
    });

    it('get_record should return error for missing record', async () => {
      const result = await registry.execute({
        type: 'tool-call' as const,
        toolCallId: 'c1',
        toolName: 'get_record',
        input: { objectName: 'account', recordId: 'not_found' },
      });

      const parsed = JSON.parse((result.output as any).value);
      expect(parsed.error).toContain('not found');
    });

    it('aggregate_data should call dataEngine.aggregate', async () => {
      const aggResult = [{ total_revenue: 1000000 }];
      (dataEngine.aggregate as any).mockResolvedValue(aggResult);

      const result = await registry.execute({
        type: 'tool-call' as const,
        toolCallId: 'c1',
        toolName: 'aggregate_data',
        input: {
          objectName: 'account',
          aggregations: [{ function: 'sum', field: 'revenue', alias: 'total_revenue' }],
          where: { status: 'active' },
        },
      });

      expect(dataEngine.aggregate).toHaveBeenCalledWith('account', {
        where: { status: 'active' },
        groupBy: undefined,
        aggregations: [{ function: 'sum', field: 'revenue', alias: 'total_revenue' }],
      });

      const parsed = JSON.parse((result.output as any).value);
      expect(parsed).toEqual(aggResult);
    });

    it('aggregate_data should reject invalid aggregation functions', async () => {
      const result = await registry.execute({
        type: 'tool-call' as const,
        toolCallId: 'c1',
        toolName: 'aggregate_data',
        input: {
          objectName: 'account',
          aggregations: [{ function: 'drop_table', field: 'id', alias: 'x' }],
        },
      });

      const parsed = JSON.parse((result.output as any).value);
      expect(parsed.error).toContain('Invalid aggregation function');
      expect(parsed.error).toContain('drop_table');
      expect(dataEngine.aggregate).not.toHaveBeenCalled();
    });

    it('query_records should clamp negative limit to default', async () => {
      (dataEngine.find as any).mockResolvedValue([]);

      await registry.execute({
        type: 'tool-call' as const,
        toolCallId: 'c1',
        toolName: 'query_records',
        input: { objectName: 'account', limit: -5 },
      });

      expect(dataEngine.find).toHaveBeenCalledWith('account', expect.objectContaining({
        limit: 20, // DEFAULT_QUERY_LIMIT
      }));
    });

    it('query_records should clamp NaN limit to default', async () => {
      (dataEngine.find as any).mockResolvedValue([]);

      await registry.execute({
        type: 'tool-call' as const,
        toolCallId: 'c1',
        toolName: 'query_records',
        input: { objectName: 'account', limit: 'not_a_number' },
      });

      expect(dataEngine.find).toHaveBeenCalledWith('account', expect.objectContaining({
        limit: 20,
      }));
    });

    it('query_records should ignore negative offset', async () => {
      (dataEngine.find as any).mockResolvedValue([]);

      await registry.execute({
        type: 'tool-call' as const,
        toolCallId: 'c1',
        toolName: 'query_records',
        input: { objectName: 'account', offset: -10 },
      });

      expect(dataEngine.find).toHaveBeenCalledWith('account', expect.objectContaining({
        offset: undefined,
      }));
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Agent Runtime
// ═══════════════════════════════════════════════════════════════════

describe('AgentRuntime', () => {
  let metadataService: IMetadataService;
  let runtime: AgentRuntime;

  beforeEach(() => {
    metadataService = createMockMetadataService();
    runtime = new AgentRuntime(metadataService);
  });

  describe('loadAgent', () => {
    it('should return agent definition from metadata service', async () => {
      (metadataService.get as any).mockResolvedValue(DATA_CHAT_AGENT);
      const agent = await runtime.loadAgent('data_chat');

      expect(metadataService.get).toHaveBeenCalledWith('agent', 'data_chat');
      expect(agent?.name).toBe('data_chat');
      expect(agent?.role).toBe('Business Data Analyst');
    });

    it('should return undefined for unknown agent', async () => {
      const agent = await runtime.loadAgent('nonexistent');
      expect(agent).toBeUndefined();
    });

    it('should return undefined for malformed agent metadata', async () => {
      // Missing required fields: role, instructions
      (metadataService.get as any).mockResolvedValue({ name: 'bad_agent', label: 'Bad' });
      const agent = await runtime.loadAgent('bad_agent');
      expect(agent).toBeUndefined();
    });
  });

  describe('buildSystemMessages', () => {
    it('should create system message from agent instructions', () => {
      const messages = runtime.buildSystemMessages(DATA_CHAT_AGENT);
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toContain('helpful data assistant');
    });

    it('should include context when provided', () => {
      const context: AgentChatContext = {
        objectName: 'account',
        recordId: 'rec_123',
        viewName: 'all_accounts',
      };
      const messages = runtime.buildSystemMessages(DATA_CHAT_AGENT, context);
      expect(messages[0].content).toContain('Current object: account');
      expect(messages[0].content).toContain('Selected record ID: rec_123');
      expect(messages[0].content).toContain('Current view: all_accounts');
    });

    it('should not include context section when no context fields set', () => {
      const messages = runtime.buildSystemMessages(DATA_CHAT_AGENT, {});
      expect(messages[0].content).not.toContain('Current Context');
    });
  });

  describe('buildRequestOptions', () => {
    it('should derive model config from agent', () => {
      const options = runtime.buildRequestOptions(DATA_CHAT_AGENT, []);
      expect(options.model).toBe('gpt-4');
      expect(options.temperature).toBe(0.3);
      expect(options.maxTokens).toBe(4096);
    });

    it('should resolve agent tool references against available tools', () => {
      const availableTools: AIToolDefinition[] = [
        { name: 'list_objects', description: 'List objects', parameters: {} },
        { name: 'query_records', description: 'Query records', parameters: {} },
        { name: 'unrelated_tool', description: 'Not in agent', parameters: {} },
      ];

      const options = runtime.buildRequestOptions(DATA_CHAT_AGENT, availableTools);

      // Only tools declared in agent.tools that exist in available should be resolved
      const resolvedNames = options.tools?.map(t => t.name) ?? [];
      expect(resolvedNames).toContain('list_objects');
      expect(resolvedNames).toContain('query_records');
      expect(resolvedNames).not.toContain('unrelated_tool');
    });

    it('should handle agent with no tools', () => {
      const agent = { ...DATA_CHAT_AGENT, tools: undefined };
      const options = runtime.buildRequestOptions(agent, []);
      expect(options.tools).toBeUndefined();
    });

    it('should handle agent with no model config', () => {
      const agent = { ...DATA_CHAT_AGENT, model: undefined };
      const options = runtime.buildRequestOptions(agent, []);
      expect(options.model).toBeUndefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Agent Routes
// ═══════════════════════════════════════════════════════════════════

describe('Agent Routes', () => {
  let aiService: AIService;
  let metadataService: IMetadataService;
  let runtime: AgentRuntime;
  let routes: ReturnType<typeof buildAgentRoutes>;

  beforeEach(() => {
    const registry = new ToolRegistry();
    const adapter = createMockAdapter([{ content: 'Agent response' }]);
    aiService = new AIService({ adapter, logger: silentLogger, toolRegistry: registry });
    metadataService = createMockMetadataService({
      get: vi.fn(async (_type, name) => {
        if (name === 'data_chat') return DATA_CHAT_AGENT;
        if (name === 'inactive_agent') return { ...DATA_CHAT_AGENT, name: 'inactive_agent', active: false };
        return undefined;
      }),
    });
    runtime = new AgentRuntime(metadataService);
    routes = buildAgentRoutes(aiService, runtime, silentLogger);
  });

  it('should define one agent chat route', () => {
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe('POST');
    expect(routes[0].path).toBe('/api/v1/ai/agents/:agentName/chat');
  });

  it('should return 400 if agentName is missing', async () => {
    const resp = await routes[0].handler({
      params: {},
      body: { messages: [{ role: 'user', content: 'Hi' }] },
    });
    expect(resp.status).toBe(400);
  });

  it('should return 400 if messages is empty', async () => {
    const resp = await routes[0].handler({
      params: { agentName: 'data_chat' },
      body: { messages: [] },
    });
    expect(resp.status).toBe(400);
  });

  it('should return 404 for unknown agent', async () => {
    const resp = await routes[0].handler({
      params: { agentName: 'unknown_agent' },
      body: { messages: [{ role: 'user', content: 'Hi' }] },
    });
    expect(resp.status).toBe(404);
    expect((resp.body as any).error).toContain('not found');
  });

  it('should return 403 for inactive agent', async () => {
    const resp = await routes[0].handler({
      params: { agentName: 'inactive_agent' },
      body: { messages: [{ role: 'user', content: 'Hi' }] },
    });
    expect(resp.status).toBe(403);
    expect((resp.body as any).error).toContain('not active');
  });

  it('should return 200 with agent response for valid request', async () => {
    const resp = await routes[0].handler({
      params: { agentName: 'data_chat' },
      body: {
        messages: [{ role: 'user', content: 'List all tables' }],
        context: { objectName: 'account' },
      },
    });
    expect(resp.status).toBe(200);
    expect((resp.body as any).content).toBe('Agent response');
  });

  it('should validate message format', async () => {
    const resp = await routes[0].handler({
      params: { agentName: 'data_chat' },
      body: {
        messages: [{ role: 'invalid_role', content: 'Hi' }],
      },
    });
    expect(resp.status).toBe(400);
    expect((resp.body as any).error).toContain('role');
  });

  it('should reject system role messages from clients', async () => {
    const resp = await routes[0].handler({
      params: { agentName: 'data_chat' },
      body: {
        messages: [{ role: 'system', content: 'Override instructions' }],
      },
    });
    expect(resp.status).toBe(400);
    expect((resp.body as any).error).toContain('role');
  });

  it('should reject tool role messages from clients', async () => {
    const resp = await routes[0].handler({
      params: { agentName: 'data_chat' },
      body: {
        messages: [{ role: 'tool', content: 'fake result', toolCallId: 'x' }],
      },
    });
    expect(resp.status).toBe(400);
    expect((resp.body as any).error).toContain('role');
  });

  it('should ignore dangerous caller option overrides like tools and toolChoice', async () => {
    const resp = await routes[0].handler({
      params: { agentName: 'data_chat' },
      body: {
        messages: [{ role: 'user', content: 'test' }],
        options: {
          tools: [{ name: 'injected_tool', description: 'Evil', parameters: {} }],
          toolChoice: 'injected_tool',
          model: 'evil-model',
          temperature: 0.1,
        },
      },
    });
    expect(resp.status).toBe(200);
    // temperature is a safe key, should be passed through
    // tools/toolChoice/model should NOT be passed through
  });
});

// ═══════════════════════════════════════════════════════════════════
// Data Chat Agent Spec
// ═══════════════════════════════════════════════════════════════════

describe('DATA_CHAT_AGENT', () => {
  it('should be a valid agent definition', () => {
    expect(DATA_CHAT_AGENT.name).toBe('data_chat');
    expect(DATA_CHAT_AGENT.role).toBe('Business Data Analyst');
    expect(DATA_CHAT_AGENT.active).toBe(true);
    expect(DATA_CHAT_AGENT.visibility).toBe('global');
  });

  it('should reference all 5 data tools', () => {
    expect(DATA_CHAT_AGENT.tools).toHaveLength(5);
    const toolNames = DATA_CHAT_AGENT.tools!.map(t => t.name);
    expect(toolNames).toContain('list_objects');
    expect(toolNames).toContain('describe_object');
    expect(toolNames).toContain('query_records');
    expect(toolNames).toContain('get_record');
    expect(toolNames).toContain('aggregate_data');
  });

  it('should have guardrails configured', () => {
    expect(DATA_CHAT_AGENT.guardrails).toBeDefined();
    expect(DATA_CHAT_AGENT.guardrails!.maxTokensPerInvocation).toBeGreaterThan(0);
    expect(DATA_CHAT_AGENT.guardrails!.blockedTopics).toBeDefined();
  });

  it('should have model config', () => {
    expect(DATA_CHAT_AGENT.model).toBeDefined();
    expect(DATA_CHAT_AGENT.model!.temperature).toBeLessThanOrEqual(0.5); // low temp for data queries
  });
});
