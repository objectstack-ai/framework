// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  ModelMessage,
  AIRequestOptions,
  AIResult,
  TextStreamPart,
  ToolSet,
} from '@objectstack/spec/contracts';
import type { LLMAdapter } from '@objectstack/spec/contracts';

/**
 * MemoryLLMAdapter — deterministic in-memory adapter for testing & development.
 *
 * Always echoes back the last user message prefixed with "[memory] ".
 * Useful for unit tests, CI pipelines, and local dev without an LLM key.
 */
export class MemoryLLMAdapter implements LLMAdapter {
  readonly name = 'memory';

  async chat(messages: ModelMessage[], options?: AIRequestOptions): Promise<AIResult> {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    const userContent = lastUserMessage?.content;
    const text = typeof userContent === 'string' ? userContent : '(complex content)';
    const content = lastUserMessage
      ? `[memory] ${text}`
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
    messages: ModelMessage[],
    _options?: AIRequestOptions,
  ): AsyncIterable<TextStreamPart<ToolSet>> {
    const result = await this.chat(messages);
    // Emit word-by-word deltas for realistic streaming simulation
    const words = result.content.split(' ');
    for (let i = 0; i < words.length; i++) {
      const wordText = i === 0 ? words[i] : ` ${words[i]}`;
      yield { type: 'text-delta', id: `delta_${i}`, text: wordText } as TextStreamPart<ToolSet>;
    }
    yield {
      type: 'finish',
      finishReason: 'stop' as const,
      totalUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      rawFinishReason: 'stop',
    } as unknown as TextStreamPart<ToolSet>;
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
