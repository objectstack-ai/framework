// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  AIMessage,
  AIRequestOptions,
  AIRequestOptionsWithTools,
  AIResult,
  AIStreamEvent,
} from '@objectstack/spec/contracts';

/**
 * LLM Provider Adapter Interface
 *
 * Adapters translate between the ObjectStack AI protocol and concrete
 * LLM provider SDKs (OpenAI, Anthropic, Ollama, etc.).
 *
 * Each adapter is a thin wrapper — all orchestration, conversation
 * management, and tool execution logic lives in the AI service layer.
 */
export interface LLMAdapter {
  /** Unique adapter identifier (e.g. 'openai', 'anthropic', 'memory') */
  readonly name: string;

  /**
   * Generate a chat completion.
   * @param messages - Conversation messages
   * @param options  - Request configuration
   */
  chat(messages: AIMessage[], options?: AIRequestOptions): Promise<AIResult>;

  /**
   * Generate a text completion from a single prompt.
   * @param prompt  - Input prompt string
   * @param options - Request configuration
   */
  complete(prompt: string, options?: AIRequestOptions): Promise<AIResult>;

  /**
   * Stream a chat completion as an async iterable of events.
   * Implementations that do not support streaming may omit this method.
   */
  streamChat?(messages: AIMessage[], options?: AIRequestOptionsWithTools): AsyncIterable<AIStreamEvent>;

  /**
   * Generate embedding vectors.
   */
  embed?(input: string | string[], model?: string): Promise<number[][]>;

  /**
   * List models available through this adapter.
   */
  listModels?(): Promise<string[]>;
}
