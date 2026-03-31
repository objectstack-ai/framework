// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  AIMessage,
  AIRequestOptions,
  AIRequestOptionsWithTools,
  AIResult,
  AIStreamEvent,
} from '@objectstack/spec/contracts';
import type { LLMAdapter } from './types.js';

/**
 * MemoryLLMAdapter — deterministic in-memory adapter for testing & development.
 *
 * Always echoes back the last user message prefixed with "[memory] ".
 * Useful for unit tests, CI pipelines, and local dev without an LLM key.
 */
export class MemoryLLMAdapter implements LLMAdapter {
  readonly name = 'memory';

  async chat(messages: AIMessage[], options?: AIRequestOptions): Promise<AIResult> {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    const content = lastUserMessage
      ? `[memory] ${lastUserMessage.content}`
      : '[memory] (no user message)';

    return {
      content,
      model: options?.model ?? 'memory',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }

  async complete(prompt: string, options?: AIRequestOptions): Promise<AIResult> {
    return {
      content: `[memory] ${prompt}`,
      model: options?.model ?? 'memory',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }

  async *streamChat(
    messages: AIMessage[],
    _options?: AIRequestOptionsWithTools,
  ): AsyncIterable<AIStreamEvent> {
    const result = await this.chat(messages);
    // Emit word-by-word deltas for realistic streaming simulation
    const words = result.content.split(' ');
    for (let i = 0; i < words.length; i++) {
      const textDelta = i === 0 ? words[i] : ` ${words[i]}`;
      yield { type: 'text-delta', textDelta };
    }
    yield { type: 'finish', result };
  }

  async embed(input: string | string[]): Promise<number[][]> {
    const texts = Array.isArray(input) ? input : [input];
    // Return deterministic zero vectors of dimension 3
    return texts.map(() => [0, 0, 0]);
  }

  async listModels(): Promise<string[]> {
    return ['memory'];
  }
}
