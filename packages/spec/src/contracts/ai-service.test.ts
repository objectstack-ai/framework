import { describe, it, expect } from 'vitest';
import type {
  IAIService,
  AIMessage,
  AIResult,
  AIToolDefinition,
  AIToolCall,
  AIToolResult,
  AIRequestOptions,
  AIStreamEvent,
  AIConversation,
  IAIConversationService,
} from './ai-service';

describe('AI Service Contract', () => {
  it('should allow a minimal IAIService implementation with required methods', () => {
    const service: IAIService = {
      chat: async (_messages, _options?) => ({ content: '' }),
      complete: async (_prompt, _options?) => ({ content: '' }),
    };

    expect(typeof service.chat).toBe('function');
    expect(typeof service.complete).toBe('function');
  });

  it('should allow a full implementation with optional methods', () => {
    const service: IAIService = {
      chat: async () => ({ content: '' }),
      complete: async () => ({ content: '' }),
      embed: async () => [[]],
      listModels: async () => [],
    };

    expect(service.embed).toBeDefined();
    expect(service.listModels).toBeDefined();
  });

  it('should generate a chat completion', async () => {
    const service: IAIService = {
      chat: async (messages): Promise<AIResult> => {
        const lastMessage = messages[messages.length - 1];
        return {
          content: `Echo: ${lastMessage.content}`,
          model: 'test-model',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        };
      },
      complete: async () => ({ content: '' }),
    };

    const messages: AIMessage[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello' },
    ];

    const result = await service.chat(messages);
    expect(result.content).toBe('Echo: Hello');
    expect(result.model).toBe('test-model');
    expect(result.usage?.totalTokens).toBe(15);
  });

  it('should generate a text completion', async () => {
    const service: IAIService = {
      chat: async () => ({ content: '' }),
      complete: async (prompt, options?): Promise<AIResult> => ({
        content: `Completed: ${prompt}`,
        model: options?.model ?? 'default',
      }),
    };

    const result = await service.complete('The sky is', { model: 'gpt-4', maxTokens: 50 });
    expect(result.content).toContain('The sky is');
    expect(result.model).toBe('gpt-4');
  });

  it('should generate embeddings', async () => {
    const service: IAIService = {
      chat: async () => ({ content: '' }),
      complete: async () => ({ content: '' }),
      embed: async (input) => {
        const texts = Array.isArray(input) ? input : [input];
        return texts.map(() => [0.1, 0.2, 0.3]);
      },
    };

    const embeddings = await service.embed!('Hello world');
    expect(embeddings).toHaveLength(1);
    expect(embeddings[0]).toEqual([0.1, 0.2, 0.3]);

    const batch = await service.embed!(['Hello', 'World']);
    expect(batch).toHaveLength(2);
  });

  it('should list available models', async () => {
    const service: IAIService = {
      chat: async () => ({ content: '' }),
      complete: async () => ({ content: '' }),
      listModels: async () => ['gpt-4', 'gpt-3.5-turbo', 'claude-3-sonnet'],
    };

    const models = await service.listModels!();
    expect(models).toHaveLength(3);
    expect(models).toContain('gpt-4');
  });

  // -----------------------------------------------------------------------
  // Tool Calling Types
  // -----------------------------------------------------------------------

  describe('Tool Calling Types', () => {
    it('should construct valid AIToolDefinition values', () => {
      const tool: AIToolDefinition = {
        name: 'get_weather',
        description: 'Get current weather for a location',
        parameters: {
          type: 'object',
          properties: { location: { type: 'string' } },
          required: ['location'],
        },
      };

      expect(tool.name).toBe('get_weather');
      expect(tool.description).toBe('Get current weather for a location');
      expect(tool.parameters).toBeDefined();
    });

    it('should construct valid AIToolCall values', () => {
      const call: AIToolCall = {
        id: 'call_abc123',
        name: 'get_weather',
        arguments: JSON.stringify({ location: 'London' }),
      };

      expect(call.id).toBe('call_abc123');
      expect(JSON.parse(call.arguments)).toEqual({ location: 'London' });
    });

    it('should construct valid AIToolResult values', () => {
      const result: AIToolResult = {
        toolCallId: 'call_abc123',
        content: '{"temp": 18, "unit": "celsius"}',
      };

      expect(result.toolCallId).toBe('call_abc123');
      expect(result.isError).toBeUndefined();

      const errorResult: AIToolResult = {
        toolCallId: 'call_xyz',
        content: 'Tool not found',
        isError: true,
      };

      expect(errorResult.isError).toBe(true);
    });

    it('should support AIMessageWithTools for tool conversations', () => {
      const assistantMsg: AIMessage = {
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: 'call_1', name: 'get_weather', arguments: '{"location":"Paris"}' },
        ],
      };

      expect(assistantMsg.toolCalls).toHaveLength(1);
      expect(assistantMsg.toolCalls![0].name).toBe('get_weather');

      const toolMsg: AIMessage = {
        role: 'tool',
        content: '{"temp": 22}',
        toolCallId: 'call_1',
      };

      expect(toolMsg.role).toBe('tool');
      expect(toolMsg.toolCallId).toBe('call_1');
    });

    it('should support tool options on AIRequestOptions', () => {
      const options: AIRequestOptions = {
        model: 'gpt-4',
        temperature: 0.7,
        tools: [
          {
            name: 'search',
            description: 'Search the web',
            parameters: { type: 'object', properties: {} },
          },
        ],
        toolChoice: 'auto',
      };

      expect(options.tools).toHaveLength(1);
      expect(options.toolChoice).toBe('auto');
    });

    it('should support non-streaming tool calling via chat()', async () => {
      const service: IAIService = {
        chat: async (messages, options?) => {
          // Simulate tool call detection
          if (options?.tools && options.tools.length > 0) {
            return { content: 'Using tools', model: 'gpt-4' };
          }
          return { content: 'No tools' };
        },
        complete: async () => ({ content: '' }),
      };

      const result = await service.chat(
        [{ role: 'user', content: 'What is the weather?' }],
        {
          model: 'gpt-4',
          tools: [{ name: 'get_weather', description: 'Get weather', parameters: {} }],
          toolChoice: 'auto',
        },
      );

      expect(result.content).toBe('Using tools');
    });
  });

  // -----------------------------------------------------------------------
  // Streaming – streamChat
  // -----------------------------------------------------------------------

  describe('streamChat', () => {
    it('should allow IAIService implementation with streamChat', () => {
      const service: IAIService = {
        chat: async () => ({ content: '' }),
        complete: async () => ({ content: '' }),
        async *streamChat(_messages, _options?) {
          yield { type: 'text-delta', textDelta: 'Hello' } satisfies AIStreamEvent;
          yield { type: 'finish', result: { content: 'Hello' } } satisfies AIStreamEvent;
        },
      };

      expect(service.streamChat).toBeDefined();
    });

    it('should stream text-delta events', async () => {
      const service: IAIService = {
        chat: async () => ({ content: '' }),
        complete: async () => ({ content: '' }),
        async *streamChat() {
          yield { type: 'text-delta' as const, textDelta: 'Hello' };
          yield { type: 'text-delta' as const, textDelta: ' world' };
          yield { type: 'finish' as const, result: { content: 'Hello world' } };
        },
      };

      const events: AIStreamEvent[] = [];
      for await (const event of service.streamChat!([], {})) {
        events.push(event);
      }

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('text-delta');
      expect(events[0].textDelta).toBe('Hello');
      expect(events[2].type).toBe('finish');
      expect(events[2].result?.content).toBe('Hello world');
    });

    it('should stream tool-call events', async () => {
      const service: IAIService = {
        chat: async () => ({ content: '' }),
        complete: async () => ({ content: '' }),
        async *streamChat() {
          yield {
            type: 'tool-call-delta' as const,
            toolCall: { id: 'call_1', name: 'get_weather' },
          };
          yield {
            type: 'tool-call' as const,
            toolCall: { id: 'call_1', name: 'get_weather', arguments: '{"location":"NYC"}' },
          };
          yield { type: 'finish' as const, result: { content: '' } };
        },
      };

      const events: AIStreamEvent[] = [];
      for await (const event of service.streamChat!([], {})) {
        events.push(event);
      }

      expect(events[0].type).toBe('tool-call-delta');
      expect(events[1].toolCall?.arguments).toBe('{"location":"NYC"}');
    });

    it('should stream error events', async () => {
      const service: IAIService = {
        chat: async () => ({ content: '' }),
        complete: async () => ({ content: '' }),
        async *streamChat() {
          yield { type: 'error' as const, error: 'Rate limit exceeded' };
        },
      };

      const events: AIStreamEvent[] = [];
      for await (const event of service.streamChat!([], {})) {
        events.push(event);
      }

      expect(events[0].type).toBe('error');
      expect(events[0].error).toBe('Rate limit exceeded');
    });
  });

  // -----------------------------------------------------------------------
  // IAIConversationService
  // -----------------------------------------------------------------------

  describe('IAIConversationService', () => {
    function createMockConversationService(): IAIConversationService {
      const store = new Map<string, AIConversation>();

      return {
        async create(options = {}) {
          const now = new Date().toISOString();
          const conv: AIConversation = {
            id: `conv_${store.size + 1}`,
            title: options.title,
            agentId: options.agentId,
            userId: options.userId,
            messages: [],
            createdAt: now,
            updatedAt: now,
            metadata: options.metadata,
          };
          store.set(conv.id, conv);
          return conv;
        },

        async get(conversationId) {
          return store.get(conversationId) ?? null;
        },

        async list(options = {}) {
          let results = Array.from(store.values());
          if (options.userId) {
            results = results.filter((c) => c.userId === options.userId);
          }
          if (options.agentId) {
            results = results.filter((c) => c.agentId === options.agentId);
          }
          if (options.limit) {
            results = results.slice(0, options.limit);
          }
          return results;
        },

        async addMessage(conversationId, message) {
          const conv = store.get(conversationId);
          if (!conv) throw new Error('Conversation not found');
          conv.messages.push(message);
          conv.updatedAt = new Date().toISOString();
          return conv;
        },

        async delete(conversationId) {
          store.delete(conversationId);
        },
      };
    }

    it('should create a conversation', async () => {
      const svc = createMockConversationService();
      const conv = await svc.create({ title: 'Test Chat', userId: 'user_1' });

      expect(conv.id).toBeDefined();
      expect(conv.title).toBe('Test Chat');
      expect(conv.userId).toBe('user_1');
      expect(conv.messages).toHaveLength(0);
      expect(conv.createdAt).toBeDefined();
    });

    it('should get a conversation by ID', async () => {
      const svc = createMockConversationService();
      const created = await svc.create({ title: 'Lookup Test' });

      const found = await svc.get(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);

      const missing = await svc.get('nonexistent');
      expect(missing).toBeNull();
    });

    it('should list conversations with filters', async () => {
      const svc = createMockConversationService();
      await svc.create({ userId: 'user_a', agentId: 'agent_1' });
      await svc.create({ userId: 'user_b', agentId: 'agent_1' });
      await svc.create({ userId: 'user_a', agentId: 'agent_2' });

      const all = await svc.list();
      expect(all).toHaveLength(3);

      const byUser = await svc.list({ userId: 'user_a' });
      expect(byUser).toHaveLength(2);

      const byAgent = await svc.list({ agentId: 'agent_1' });
      expect(byAgent).toHaveLength(2);

      const limited = await svc.list({ limit: 1 });
      expect(limited).toHaveLength(1);
    });

    it('should add messages to a conversation', async () => {
      const svc = createMockConversationService();
      const conv = await svc.create({ title: 'Message Test' });

      const updated = await svc.addMessage(conv.id, {
        role: 'user',
        content: 'Hello!',
      });

      expect(updated.messages).toHaveLength(1);
      expect(updated.messages[0].content).toBe('Hello!');

      const updated2 = await svc.addMessage(conv.id, {
        role: 'assistant',
        content: 'Hi there!',
      });

      expect(updated2.messages).toHaveLength(2);
    });

    it('should delete a conversation', async () => {
      const svc = createMockConversationService();
      const conv = await svc.create({ title: 'Delete Me' });

      await svc.delete(conv.id);
      const result = await svc.get(conv.id);
      expect(result).toBeNull();
    });

    it('should support metadata on conversations', async () => {
      const svc = createMockConversationService();
      const conv = await svc.create({
        title: 'With Meta',
        metadata: { source: 'web', tags: ['support'] },
      });

      expect(conv.metadata).toEqual({ source: 'web', tags: ['support'] });
    });
  });
});
