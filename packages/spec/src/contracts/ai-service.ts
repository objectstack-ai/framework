// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * IAIService - AI Engine Service Contract
 *
 * Defines the interface for AI capabilities (NLQ, chat, suggestions, embeddings)
 * in ObjectStack. Concrete implementations (OpenAI, Anthropic, Ollama, etc.)
 * should implement this interface.
 *
 * Follows Dependency Inversion Principle - plugins depend on this interface,
 * not on concrete AI/LLM provider implementations.
 *
 * Aligned with CoreServiceName 'ai' in core-services.zod.ts.
 *
 * ## Vercel AI SDK Alignment
 *
 * Message, tool-call, and streaming types are re-exported directly from the
 * Vercel AI SDK (`ai`) so that ObjectStack's wire protocol is fully aligned
 * with the ecosystem used by `@ai-sdk/react/useChat` on the frontend.
 *
 * - `ModelMessage` replaces the former custom `AIMessage`
 * - `ToolCallPart` replaces `AIToolCall`
 * - `ToolResultPart` replaces `AIToolResult`
 * - `TextStreamPart` replaces `AIStreamEvent`
 */

// ---------------------------------------------------------------------------
// Re-exports from Vercel AI SDK (canonical types)
// ---------------------------------------------------------------------------

export type {
    ModelMessage,
    SystemModelMessage,
    UserModelMessage,
    AssistantModelMessage,
    ToolModelMessage,
    ToolCallPart,
    ToolResultPart,
    TextStreamPart,
    ToolSet,
    FinishReason,
} from 'ai';

// ---------------------------------------------------------------------------
// Deprecated aliases — kept for backward compatibility
// ---------------------------------------------------------------------------

import type {
    ModelMessage,
    ToolCallPart,
    ToolResultPart,
    TextStreamPart,
    ToolSet,
} from 'ai';

/**
 * @deprecated Use `ModelMessage` from `ai` instead.
 *
 * Previously a flat interface with `role`, `content: string`, `toolCalls?`,
 * and `toolCallId?`. The Vercel AI SDK uses a discriminated union where each
 * role has its own content type.
 */
export type AIMessage = ModelMessage;

/**
 * @deprecated Use `ToolCallPart` from `ai` instead.
 *
 * The Vercel type uses `toolCallId` / `toolName` / `input` rather than
 * `id` / `name` / `arguments`.
 */
export type AIToolCall = ToolCallPart;

/**
 * @deprecated Use `ToolResultPart` from `ai` instead.
 */
export type AIToolResult = ToolResultPart;

/**
 * @deprecated Use `AIMessage` directly — tool fields are now on the base type.
 */
export type AIMessageWithTools = ModelMessage;

/**
 * @deprecated Use `AIRequestOptions` directly — tool fields are now on the base type.
 */
export type AIRequestOptionsWithTools = AIRequestOptions;

/**
 * @deprecated Use `TextStreamPart<ToolSet>` from `ai` instead.
 *
 * The Vercel AI SDK uses a rich discriminated union for stream parts.
 */
export type AIStreamEvent = TextStreamPart<ToolSet>;

// ---------------------------------------------------------------------------
// ObjectStack-specific types (no Vercel equivalent)
// ---------------------------------------------------------------------------

/**
 * Options for AI completion/chat requests.
 *
 * Includes tool-related configuration so that tool calling works in both
 * streaming (`streamChat`) and non-streaming (`chat`) modes.
 */
export interface AIRequestOptions {
    /** Model identifier to use */
    model?: string;
    /** Sampling temperature (0-2) */
    temperature?: number;
    /** Maximum tokens to generate */
    maxTokens?: number;
    /** Stop sequences */
    stop?: string[];
    /** Tool definitions available to the model */
    tools?: AIToolDefinition[];
    /** How the model should use tools: 'auto', 'none', or a specific tool name */
    toolChoice?: 'auto' | 'none' | string;
}

/**
 * Result of an AI completion/chat request
 */
export interface AIResult {
    /** Generated text content */
    content: string;
    /** Model used for generation */
    model?: string;
    /** Tool calls requested by the model (present when the model invokes tools) */
    toolCalls?: ToolCallPart[];
    /** Token usage statistics */
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

// ---------------------------------------------------------------------------
// Tool Calling Protocol
// ---------------------------------------------------------------------------

/**
 * Definition of a tool that can be invoked by the AI model.
 *
 * This is an ObjectStack-specific simplified definition used by the
 * `IAIService` contract. For the full Vercel AI SDK tool definition,
 * use `Tool` from `ai`.
 */
export interface AIToolDefinition {
    /** Tool name (snake_case identifier) */
    name: string;
    /** Human-readable description */
    description: string;
    /** JSON Schema describing the tool parameters */
    parameters: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// IAIService
// ---------------------------------------------------------------------------

export interface IAIService {
    /**
     * Generate a chat completion from a conversation.
     *
     * Accepts Vercel AI SDK `ModelMessage[]` for full ecosystem alignment.
     *
     * @param messages - Array of conversation messages (Vercel `ModelMessage`)
     * @param options - Optional request configuration
     * @returns AI-generated response
     */
    chat(messages: ModelMessage[], options?: AIRequestOptions): Promise<AIResult>;

    /**
     * Generate a text completion from a prompt
     * @param prompt - Input prompt string
     * @param options - Optional request configuration
     * @returns AI-generated response
     */
    complete(prompt: string, options?: AIRequestOptions): Promise<AIResult>;

    /**
     * Generate embeddings for a text input
     * @param input - Text or array of texts to embed
     * @param model - Optional embedding model identifier
     * @returns Array of embedding vectors
     */
    embed?(input: string | string[], model?: string): Promise<number[][]>;

    /**
     * List available models
     * @returns Array of model identifiers
     */
    listModels?(): Promise<string[]>;

    /**
     * Stream a chat completion as an async iterable of Vercel AI SDK stream parts.
     *
     * @param messages - Array of conversation messages (Vercel `ModelMessage`)
     * @param options - Optional request configuration (supports tool definitions)
     * @returns Async iterable of `TextStreamPart` events
     */
    streamChat?(messages: ModelMessage[], options?: AIRequestOptions): AsyncIterable<TextStreamPart<ToolSet>>;

    /**
     * Chat with automatic tool call resolution.
     *
     * Sends messages to the LLM with tool definitions, automatically
     * executes any returned tool calls, feeds the results back, and
     * repeats until the model returns a final text response or the
     * maximum number of iterations is reached.
     *
     * @param messages - Conversation messages (Vercel `ModelMessage`)
     * @param options  - Request options (tools are auto-injected from the registry)
     * @returns Final AI result after all tool calls have been resolved
     */
    chatWithTools?(messages: ModelMessage[], options?: ChatWithToolsOptions): Promise<AIResult>;
}

/**
 * Options for the `chatWithTools()` tool call loop.
 */
export interface ChatWithToolsOptions extends AIRequestOptions {
    /** Maximum number of tool call loop iterations (default: 10) */
    maxIterations?: number;
    /**
     * Optional callback invoked when a tool execution fails.
     *
     * Receives the tool call that failed and the error message.
     * Return `'continue'` (default) to feed the error back to the model,
     * or `'abort'` to immediately stop the tool call loop.
     */
    onToolError?: (toolCall: ToolCallPart, error: string) => 'continue' | 'abort';
}

// ---------------------------------------------------------------------------
// Conversation Management
// ---------------------------------------------------------------------------

/**
 * A persistent AI conversation with message history
 */
export interface AIConversation {
    /** Conversation ID */
    id: string;
    /** Title / summary */
    title?: string;
    /** Associated agent ID */
    agentId?: string;
    /** User who owns the conversation */
    userId?: string;
    /** Messages in the conversation */
    messages: ModelMessage[];
    /** Creation timestamp (ISO 8601) */
    createdAt: string;
    /** Last update timestamp (ISO 8601) */
    updatedAt: string;
    /** Conversation metadata */
    metadata?: Record<string, unknown>;
}

/**
 * IAIConversationService - Manages persistent AI conversations
 *
 * Provides CRUD operations for conversations and their messages.
 */
export interface IAIConversationService {
    /**
     * Create a new conversation
     * @param options - Initial conversation properties
     * @returns The created conversation
     */
    create(options?: {
        title?: string;
        agentId?: string;
        userId?: string;
        metadata?: Record<string, unknown>;
    }): Promise<AIConversation>;

    /**
     * Get a conversation by ID
     * @param conversationId - Conversation identifier
     * @returns The conversation, or null if not found
     */
    get(conversationId: string): Promise<AIConversation | null>;

    /**
     * List conversations with optional filters
     * @param options - Filter and pagination options
     * @returns Array of matching conversations
     */
    list(options?: {
        userId?: string;
        agentId?: string;
        limit?: number;
        cursor?: string;
    }): Promise<AIConversation[]>;

    /**
     * Add a message to a conversation
     * @param conversationId - Target conversation ID
     * @param message - Message to append (Vercel `ModelMessage`)
     * @returns The updated conversation
     */
    addMessage(conversationId: string, message: ModelMessage): Promise<AIConversation>;

    /**
     * Delete a conversation
     * @param conversationId - Conversation to delete
     */
    delete(conversationId: string): Promise<void>;
}
