// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  AIMessage,
  AIRequestOptions,
  AIResult,
  AIStreamEvent,
  IAIService,
  IAIConversationService,
  ChatWithToolsOptions,
  LLMAdapter,
} from '@objectstack/spec/contracts';
import type { Logger } from '@objectstack/spec/contracts';
import { createLogger } from '@objectstack/core';
import { MemoryLLMAdapter } from './adapters/memory-adapter.js';
import { ToolRegistry } from './tools/tool-registry.js';
import { InMemoryConversationService } from './conversation/in-memory-conversation-service.js';

/**
 * Configuration for AIService.
 */
export interface AIServiceConfig {
  /** LLM adapter to delegate calls to (defaults to MemoryLLMAdapter). */
  adapter?: LLMAdapter;
  /** Logger instance. */
  logger?: Logger;
  /** Pre-registered tools. */
  toolRegistry?: ToolRegistry;
  /** Conversation service (defaults to InMemoryConversationService). */
  conversationService?: IAIConversationService;
}

/**
 * AIService — Unified AI capability service.
 *
 * Implements {@link IAIService} by delegating to a pluggable {@link LLMAdapter}
 * and managing tools and conversations through dedicated sub-components:
 *
 * | Component | Responsibility |
 * |:---|:---|
 * | {@link LLMAdapter} | LLM provider abstraction (chat, complete, stream, embed) |
 * | {@link ToolRegistry} | Tool definition storage & execution |
 * | {@link IAIConversationService} | Conversation CRUD & message persistence |
 *
 * The service is registered as `'ai'` in the kernel service registry by
 * the {@link AIServicePlugin}.
 */
export class AIService implements IAIService {
  private readonly adapter: LLMAdapter;
  private readonly logger: Logger;
  readonly toolRegistry: ToolRegistry;
  readonly conversationService: IAIConversationService;

  constructor(config: AIServiceConfig = {}) {
    this.adapter = config.adapter ?? new MemoryLLMAdapter();
    this.logger = config.logger ?? createLogger({ level: 'info', format: 'pretty' });
    this.toolRegistry = config.toolRegistry ?? new ToolRegistry();
    this.conversationService = config.conversationService ?? new InMemoryConversationService();

    this.logger.info(
      `[AI] Service initialized with adapter="${this.adapter.name}", ` +
      `tools=${this.toolRegistry.size}`,
    );
  }

  /** The name of the active LLM adapter. */
  get adapterName(): string {
    return this.adapter.name;
  }

  // ── IAIService implementation ──────────────────────────────────

  async chat(messages: AIMessage[], options?: AIRequestOptions): Promise<AIResult> {
    this.logger.debug('[AI] chat', { messageCount: messages.length, model: options?.model });
    return this.adapter.chat(messages, options);
  }

  async complete(prompt: string, options?: AIRequestOptions): Promise<AIResult> {
    this.logger.debug('[AI] complete', { promptLength: prompt.length, model: options?.model });
    return this.adapter.complete(prompt, options);
  }

  async *streamChat(
    messages: AIMessage[],
    options?: AIRequestOptions,
  ): AsyncIterable<AIStreamEvent> {
    this.logger.debug('[AI] streamChat', { messageCount: messages.length, model: options?.model });

    if (!this.adapter.streamChat) {
      // Fallback: emit the entire response as a single text-delta + finish
      const result = await this.adapter.chat(messages, options);
      yield { type: 'text-delta', textDelta: result.content };
      yield { type: 'finish', result };
      return;
    }

    yield* this.adapter.streamChat(messages, options);
  }

  async embed(input: string | string[], model?: string): Promise<number[][]> {
    if (!this.adapter.embed) {
      throw new Error(`[AI] Adapter "${this.adapter.name}" does not support embeddings`);
    }
    return this.adapter.embed(input, model);
  }

  async listModels(): Promise<string[]> {
    if (!this.adapter.listModels) {
      return [];
    }
    return this.adapter.listModels();
  }

  // ── Tool Call Loop ────────────────────────────────────────────

  /** Default maximum iterations for the tool call loop. */
  static readonly DEFAULT_MAX_ITERATIONS = 10;

  /**
   * Chat with automatic tool call resolution.
   *
   * 1. Merges registered tool definitions into `options.tools`.
   * 2. Calls the LLM adapter.
   * 3. If the response contains `toolCalls`, executes them via the
   *    {@link ToolRegistry}, appends tool results as `role: 'tool'`
   *    messages, and loops back to step 2.
   * 4. Repeats until the model produces a final text response or the
   *    maximum number of iterations (`maxIterations`) is reached.
   */
  async chatWithTools(
    messages: AIMessage[],
    options?: ChatWithToolsOptions,
  ): Promise<AIResult> {
    const maxIterations = options?.maxIterations ?? AIService.DEFAULT_MAX_ITERATIONS;
    const registeredTools = this.toolRegistry.getAll();

    // Merge registered tools with any explicitly provided tools
    const mergedTools = [
      ...registeredTools,
      ...(options?.tools ?? []),
    ];

    // Build the options that will be sent to every LLM call in the loop
    const chatOptions: AIRequestOptions = {
      ...options,
      tools: mergedTools.length > 0 ? mergedTools : undefined,
      toolChoice: mergedTools.length > 0 ? (options?.toolChoice ?? 'auto') : undefined,
    };

    // Working copy of the conversation
    const conversation = [...messages];

    this.logger.debug('[AI] chatWithTools start', {
      messageCount: conversation.length,
      toolCount: mergedTools.length,
      maxIterations,
    });

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const result = await this.adapter.chat(conversation, chatOptions);

      // If the model did not request any tool calls we're done
      if (!result.toolCalls || result.toolCalls.length === 0) {
        this.logger.debug('[AI] chatWithTools finished', { iteration, content: result.content.slice(0, 80) });
        return result;
      }

      this.logger.debug('[AI] chatWithTools tool calls', {
        iteration,
        calls: result.toolCalls.map(tc => tc.name),
      });

      // Append the assistant's response (with tool call metadata) to the conversation
      conversation.push({
        role: 'assistant',
        content: result.content ?? '',
        toolCalls: result.toolCalls,
      });

      // Execute all tool calls in parallel
      const toolResults = await this.toolRegistry.executeAll(result.toolCalls);

      // Append each tool result as a `role: 'tool'` message
      for (const tr of toolResults) {
        conversation.push({
          role: 'tool',
          content: tr.content,
          toolCallId: tr.toolCallId,
        });
      }
    }

    // If we exhausted the loop without a final response, make one last
    // call *without* tools so the model is forced to produce text.
    this.logger.warn('[AI] chatWithTools max iterations reached, forcing final response');
    const finalResult = await this.adapter.chat(conversation, {
      ...chatOptions,
      tools: undefined,
      toolChoice: undefined,
    });
    return finalResult;
  }
}
