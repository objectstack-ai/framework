// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  ModelMessage,
  AIRequestOptions,
  AIResult,
  TextStreamPart,
  ToolSet,
} from '@objectstack/spec/contracts';
import type { LLMAdapter } from '@objectstack/spec/contracts';
import type { AIToolDefinition } from '@objectstack/spec/contracts';
import type { LanguageModelV2 } from '@ai-sdk/provider';
import { generateText, streamText, tool as vercelTool, jsonSchema } from 'ai';

/**
 * Convert ObjectStack `AIRequestOptions` into the subset of Vercel AI SDK
 * options supported by `generateText` / `streamText`.
 *
 * Forwards: temperature, maxTokens, stop (→ stopSequences), tools, toolChoice.
 */
function buildVercelOptions(options?: AIRequestOptions): Record<string, unknown> {
  if (!options) return {};

  const opts: Record<string, unknown> = {};

  if (options.temperature != null) opts.temperature = options.temperature;
  if (options.maxTokens != null) opts.maxTokens = options.maxTokens;
  if (options.stop?.length) opts.stopSequences = options.stop;

  if (options.tools?.length) {
    const tools: Record<string, unknown> = {};
    for (const t of options.tools as AIToolDefinition[]) {
      tools[t.name] = vercelTool({
        description: t.description,
        inputSchema: jsonSchema(t.parameters as any),
      });
    }
    opts.tools = tools;
  }

  if (options.toolChoice != null) {
    opts.toolChoice = options.toolChoice;
  }

  return opts;
}

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

  private readonly model: LanguageModelV2;

  constructor(config: VercelLLMAdapterConfig) {
    this.model = config.model;
  }

  async chat(messages: ModelMessage[], options?: AIRequestOptions): Promise<AIResult> {
    const result = await generateText({
      model: this.model,
      messages,
      ...buildVercelOptions(options),
    });

    return {
      content: result.text,
      model: result.response?.modelId,
      toolCalls: result.toolCalls?.length ? result.toolCalls : undefined,
      usage: result.usage ? {
        promptTokens: result.usage.inputTokens ?? 0,
        completionTokens: result.usage.outputTokens ?? 0,
        totalTokens: result.usage.totalTokens ?? 0,
      } : undefined,
    };
  }

  async complete(prompt: string, options?: AIRequestOptions): Promise<AIResult> {
    const result = await generateText({
      model: this.model,
      prompt,
      ...buildVercelOptions(options),
    });

    return {
      content: result.text,
      model: result.response?.modelId,
      usage: result.usage ? {
        promptTokens: result.usage.inputTokens ?? 0,
        completionTokens: result.usage.outputTokens ?? 0,
        totalTokens: result.usage.totalTokens ?? 0,
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
      ...buildVercelOptions(options),
    });

    for await (const part of result.fullStream) {
      yield part as TextStreamPart<ToolSet>;
    }
  }

  async embed(_input: string | string[]): Promise<number[][]> {
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
  model: LanguageModelV2;
}
