// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  ModelMessage,
  AIRequestOptions,
  AIResult,
  TextStreamPart,
  ToolSet,
} from '@objectstack/spec/contracts';
import type { LLMAdapter } from '@objectstack/spec/contracts';
import type { LanguageModelV3 } from '@ai-sdk/provider';
import { generateText, streamText } from 'ai';

/**
 * VercelLLMAdapter — Production LLM adapter powered by the Vercel AI SDK.
 *
 * Wraps `generateText` / `streamText` from the `ai` package, delegating to
 * any Vercel AI SDK–compatible model provider (OpenAI, Anthropic, Google,
 * Ollama, etc.).
 *
 * @example
 * ```typescript
 * import { openai } from '@ai-sdk/openai';
 * import { VercelLLMAdapter } from '@objectstack/service-ai';
 *
 * const adapter = new VercelLLMAdapter({ model: openai('gpt-4o') });
 * ```
 */
export class VercelLLMAdapter implements LLMAdapter {
  readonly name = 'vercel';

  private readonly model: LanguageModelV3;

  constructor(config: VercelLLMAdapterConfig) {
    this.model = config.model;
  }

  async chat(messages: ModelMessage[], options?: AIRequestOptions): Promise<AIResult> {
    const result = await generateText({
      model: this.model,
      messages,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });

    return {
      content: result.text,
      model: result.response?.modelId,
      toolCalls: result.toolCalls?.length ? result.toolCalls : undefined,
      usage: result.usage ? {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      } : undefined,
    };
  }

  async complete(prompt: string, options?: AIRequestOptions): Promise<AIResult> {
    const result = await generateText({
      model: this.model,
      prompt,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });

    return {
      content: result.text,
      model: result.response?.modelId,
      usage: result.usage ? {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      } : undefined,
    };
  }

  async *streamChat(
    messages: ModelMessage[],
    options?: AIRequestOptions,
  ): AsyncIterable<TextStreamPart<ToolSet>> {
    const result = streamText({
      model: this.model,
      messages,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });

    for await (const part of result.fullStream) {
      yield part as TextStreamPart<ToolSet>;
    }
  }

  async embed(input: string | string[]): Promise<number[][]> {
    // Vercel AI SDK uses a separate EmbeddingModel — not supported via this adapter.
    throw new Error(
      '[VercelLLMAdapter] Embeddings require a dedicated EmbeddingModel. ' +
      'Configure an embedding adapter instead.',
    );
  }

  async listModels(): Promise<string[]> {
    // Model listing is provider-specific and not available through the base SDK.
    return [];
  }
}

/**
 * Configuration for the Vercel LLM adapter.
 */
export interface VercelLLMAdapterConfig {
  /**
   * A Vercel AI SDK–compatible language model instance.
   *
   * @example `openai('gpt-4o')` or `anthropic('claude-sonnet-4-20250514')`
   */
  model: LanguageModelV3;
}
