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
 */

/**
 * A chat message in a conversation.
 *
 * Supports the standard `system`, `user`, and `assistant` roles as well as
 * the `tool` role used to return tool execution results to the model.
 * Tool-call metadata (`toolCalls`, `toolCallId`) is optional so that plain
 * messages remain simple while tool-using conversations can carry the
 * necessary context.
 */
export interface AIMessage {
    /** Message role */
    role: 'system' | 'user' | 'assistant' | 'tool';
    /** Message content */
    content: string;
    /** Tool calls requested by the assistant (present when role='assistant') */
    toolCalls?: AIToolCall[];
    /** ID of the tool call this message responds to (present when role='tool') */
    toolCallId?: string;
}

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
 * Definition of a tool that can be invoked by the AI model
 */
export interface AIToolDefinition {
    /** Tool name (snake_case identifier) */
    name: string;
    /** Human-readable description */
    description: string;
    /** JSON Schema describing the tool parameters */
    parameters: Record<string, unknown>;
}

/**
 * A tool call requested by the AI model
 */
export interface AIToolCall {
    /** Unique ID for this tool call */
    id: string;
    /** Tool name (must match an AIToolDefinition name, snake_case) */
    name: string;
    /** JSON-stringified arguments */
    arguments: string;
}

/**
 * Result returned after executing a tool call
 */
export interface AIToolResult {
    /** Tool call ID this result corresponds to */
    toolCallId: string;
    /** Tool output content */
    content: string;
    /** Whether the tool execution errored */
    isError?: boolean;
}

// ---------------------------------------------------------------------------
// Extended message & request types (backward-compatible aliases)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use {@link AIMessage} directly — tool fields are now on the base type.
 */
export type AIMessageWithTools = AIMessage;

/**
 * @deprecated Use {@link AIRequestOptions} directly — tool fields are now on the base type.
 */
export type AIRequestOptionsWithTools = AIRequestOptions;

// ---------------------------------------------------------------------------
// Streaming Protocol
// ---------------------------------------------------------------------------

/**
 * A single event emitted during a streaming AI response
 */
export interface AIStreamEvent {
    /** Event type */
    type: 'text-delta' | 'tool-call-delta' | 'tool-call' | 'finish' | 'error';
    /** Text content delta (for type='text-delta') */
    textDelta?: string;
    /** Tool call info (for type='tool-call-delta' or 'tool-call') */
    toolCall?: Partial<AIToolCall>;
    /** Final result (for type='finish') */
    result?: AIResult;
    /** Error message (for type='error') */
    error?: string;
}

// ---------------------------------------------------------------------------
// IAIService
// ---------------------------------------------------------------------------

export interface IAIService {
    /**
     * Generate a chat completion from a conversation
     * @param messages - Array of conversation messages
     * @param options - Optional request configuration
     * @returns AI-generated response
     */
    chat(messages: AIMessage[], options?: AIRequestOptions): Promise<AIResult>;

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
     * Stream a chat completion as an async iterable of events
     * @param messages - Array of conversation messages
     * @param options - Optional request configuration (supports tool definitions)
     * @returns Async iterable of stream events
     */
    streamChat?(messages: AIMessage[], options?: AIRequestOptions): AsyncIterable<AIStreamEvent>;
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
    messages: AIMessage[];
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
     * @param message - Message to append
     * @returns The updated conversation
     */
    addMessage(conversationId: string, message: AIMessage): Promise<AIConversation>;

    /**
     * Delete a conversation
     * @param conversationId - Conversation to delete
     */
    delete(conversationId: string): Promise<void>;
}
