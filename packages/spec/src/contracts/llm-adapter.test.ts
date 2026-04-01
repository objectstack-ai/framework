// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import type {
  LLMAdapter,
} from './llm-adapter';
import type {
  AIRequestOptions,
  AIResult,
} from './ai-service';
import type {
  ModelMessage,
  TextStreamPart,
  ToolSet,
} from 'ai';

describe('LLM Adapter Contract', () => {
  it('should allow a minimal LLMAdapter implementation with required methods', () => {
    const adapter: LLMAdapter = {
      name: 'test',
      chat: async (_messages: ModelMessage[], _options?: AIRequestOptions): Promise<AIResult> => ({
        content: 'hello',
      }),
      complete: async (_prompt: string, _options?: AIRequestOptions): Promise<AIResult> => ({
        content: 'completed',
      }),
    };

    expect(adapter.name).toBe('test');
    expect(typeof adapter.chat).toBe('function');
    expect(typeof adapter.complete).toBe('function');
  });

  it('should allow a full implementation with all optional methods', () => {
    const adapter: LLMAdapter = {
      name: 'full',
      chat: async () => ({ content: '' }),
      complete: async () => ({ content: '' }),
      async *streamChat(_messages: ModelMessage[], _options?: AIRequestOptions): AsyncIterable<TextStreamPart<ToolSet>> {
        yield { type: 'text-delta', id: '1', text: 'hi' } as TextStreamPart<ToolSet>;
      },
      embed: async (input: string | string[]) => {
        const texts = Array.isArray(input) ? input : [input];
        return texts.map(() => [0.1, 0.2, 0.3]);
      },
      listModels: async () => ['gpt-4', 'claude-3'],
    };

    expect(adapter.name).toBe('full');
    expect(adapter.streamChat).toBeDefined();
    expect(adapter.embed).toBeDefined();
    expect(adapter.listModels).toBeDefined();
  });

  it('should generate a chat completion with ModelMessage', async () => {
    const adapter: LLMAdapter = {
      name: 'echo',
      chat: async (messages) => {
        const last = messages[messages.length - 1];
        const text = typeof last.content === 'string' ? last.content : 'complex';
        return { content: `Echo: ${text}`, model: 'echo' };
      },
      complete: async () => ({ content: '' }),
    };

    const result = await adapter.chat([
      { role: 'user', content: 'Hello' },
    ]);

    expect(result.content).toBe('Echo: Hello');
    expect(result.model).toBe('echo');
  });

  it('should generate a text completion', async () => {
    const adapter: LLMAdapter = {
      name: 'completer',
      chat: async () => ({ content: '' }),
      complete: async (prompt) => ({ content: `Done: ${prompt}` }),
    };

    const result = await adapter.complete('Tell me');
    expect(result.content).toBe('Done: Tell me');
  });

  it('should stream chat events (Vercel TextStreamPart)', async () => {
    const adapter: LLMAdapter = {
      name: 'streamer',
      chat: async () => ({ content: '' }),
      complete: async () => ({ content: '' }),
      async *streamChat() {
        yield { type: 'text-delta' as const, id: '1', text: 'Hello' } as TextStreamPart<ToolSet>;
        yield { type: 'text-delta' as const, id: '1', text: ' world' } as TextStreamPart<ToolSet>;
      },
    };

    const events: TextStreamPart<ToolSet>[] = [];
    for await (const event of adapter.streamChat!([], {})) {
      events.push(event);
    }

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('text-delta');
  });

  it('should generate embeddings', async () => {
    const adapter: LLMAdapter = {
      name: 'embedder',
      chat: async () => ({ content: '' }),
      complete: async () => ({ content: '' }),
      embed: async (input) => {
        const texts = Array.isArray(input) ? input : [input];
        return texts.map(() => [0.5, 0.5]);
      },
    };

    const embeddings = await adapter.embed!('test');
    expect(embeddings).toHaveLength(1);
    expect(embeddings[0]).toEqual([0.5, 0.5]);

    const batch = await adapter.embed!(['a', 'b']);
    expect(batch).toHaveLength(2);
  });

  it('should list available models', async () => {
    const adapter: LLMAdapter = {
      name: 'lister',
      chat: async () => ({ content: '' }),
      complete: async () => ({ content: '' }),
      listModels: async () => ['model-a', 'model-b'],
    };

    const models = await adapter.listModels!();
    expect(models).toHaveLength(2);
    expect(models).toContain('model-a');
  });

  it('should have readonly name property', () => {
    const adapter: LLMAdapter = {
      name: 'immutable',
      chat: async () => ({ content: '' }),
      complete: async () => ({ content: '' }),
    };

    // The name property is readonly — attempting to assign should fail at compile time
    // This runtime check verifies the value is accessible
    expect(adapter.name).toBe('immutable');
  });
});
