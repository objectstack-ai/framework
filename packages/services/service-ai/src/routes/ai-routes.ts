// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { IAIService, IAIConversationService, ModelMessage } from '@objectstack/spec/contracts';
import type { Logger } from '@objectstack/spec/contracts';

/**
 * Minimal HTTP handler abstraction so routes stay framework-agnostic.
 *
 * Consumers wire these handlers to their HTTP server of choice
 * (Hono, Express, Fastify, etc.) via the kernel's HTTP server service.
 */
export interface RouteDefinition {
  /** HTTP method */
  method: 'GET' | 'POST' | 'DELETE';
  /** Path pattern (e.g. '/api/v1/ai/chat') */
  path: string;
  /** Human-readable description */
  description: string;
  /** Whether this route requires authentication (default: true). */
  auth?: boolean;
  /** Required permissions for accessing this route. */
  permissions?: string[];
  /**
   * Handler receives a plain request-like object and returns a response-like
   * object.  SSE responses set `stream: true` and provide an async iterable.
   */
  handler: (req: RouteRequest) => Promise<RouteResponse>;
}

/**
 * Authenticated user context attached to a route request.
 *
 * Populated by the auth middleware when `RouteDefinition.auth` is `true`.
 */
export interface RouteUserContext {
  /** Unique user identifier. */
  userId: string;
  /** User display name (optional). */
  displayName?: string;
  /** Roles assigned to the user (e.g. `['admin', 'user']`). */
  roles?: string[];
  /** Fine-grained permissions (e.g. `['ai:chat', 'ai:admin']`). */
  permissions?: string[];
}

export interface RouteRequest {
  /** Parsed JSON body (for POST requests) */
  body?: unknown;
  /** Route/query parameters */
  params?: Record<string, string>;
  /** Query string parameters */
  query?: Record<string, string>;
  /** Authenticated user context (populated by auth middleware). */
  user?: RouteUserContext;
}

export interface RouteResponse {
  /** HTTP status code */
  status: number;
  /** JSON-serializable body (for non-streaming responses) */
  body?: unknown;
  /** If true, `stream` provides SSE events */
  stream?: boolean;
  /** Async iterable of SSE events (when stream=true) */
  events?: AsyncIterable<unknown>;
  /**
   * When `true`, the HTTP server layer should encode the `events` iterable
   * using the Vercel AI Data Stream Protocol frame format (`0:`, `9:`, `d:`, …)
   * instead of generic SSE `data:` lines.
   *
   * @see https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
   */
  vercelDataStream?: boolean;
}

/** Valid message roles accepted by the AI routes. */
const VALID_ROLES = new Set<string>(['system', 'user', 'assistant', 'tool']);

/**
 * Validate that `raw` is a well-formed message.
 * Returns null on success, or an error string on failure.
 *
 * Accepts both simple string content (legacy) and Vercel AI SDK array content
 * (e.g. `[{ type: 'text', text: '...' }]`).
 */
function validateMessage(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) {
    return 'each message must be an object';
  }
  const msg = raw as Record<string, unknown>;
  if (typeof msg.role !== 'string' || !VALID_ROLES.has(msg.role)) {
    return `message.role must be one of ${[...VALID_ROLES].map(r => `"${r}"`).join(', ')}`;
  }
  // Accept string content (legacy) or array content (Vercel multi-part)
  if (typeof msg.content !== 'string' && !Array.isArray(msg.content)) {
    return 'message.content must be a string or an array';
  }
  return null;
}

/**
 * Build the standard AI REST/SSE routes.
 *
 * Depends on contracts ({@link IAIService} + {@link IAIConversationService})
 * rather than concrete implementations, so any compliant service pair can
 * be wired in.
 *
 * Routes:
 * | Method | Path | Description |
 * |:---|:---|:---|
 * | POST | /api/v1/ai/chat | Synchronous chat completion |
 * | POST | /api/v1/ai/chat/stream | SSE streaming chat completion |
 * | POST | /api/v1/ai/complete | Text completion |
 * | GET  | /api/v1/ai/models | List available models |
 * | POST | /api/v1/ai/conversations | Create a conversation |
 * | GET  | /api/v1/ai/conversations | List conversations |
 * | POST | /api/v1/ai/conversations/:id/messages | Add message to conversation |
 * | DELETE | /api/v1/ai/conversations/:id | Delete conversation |
 */
export function buildAIRoutes(
  aiService: IAIService,
  conversationService: IAIConversationService,
  logger: Logger,
): RouteDefinition[] {
  return [
    // ── Chat ────────────────────────────────────────────────────
    //
    // Dual-mode endpoint compatible with both the legacy ObjectStack
    // format (`{ messages, options }`) and the Vercel AI SDK useChat
    // flat format (`{ messages, system, model, stream, … }`).
    //
    // Behaviour:
    //   • `stream !== false` → Vercel Data Stream Protocol (SSE)
    //   • `stream === false`  → JSON response (legacy)
    //
    {
      method: 'POST',
      path: '/api/v1/ai/chat',
      description: 'Chat completion (supports Vercel AI Data Stream Protocol)',
      auth: true,
      permissions: ['ai:chat'],
      handler: async (req) => {
        const body = (req.body ?? {}) as Record<string, unknown>;

        // ── Parse messages ───────────────────────────────────
        const messages = body.messages as unknown[] | undefined;
        if (!Array.isArray(messages) || messages.length === 0) {
          return { status: 400, body: { error: 'messages array is required' } };
        }

        for (const msg of messages) {
          const err = validateMessage(msg);
          if (err) return { status: 400, body: { error: err } };
        }

        // ── Resolve options ──────────────────────────────────
        // Accept legacy nested `options` object **or** Vercel-style
        // flat fields (`model`, `temperature`, `maxTokens`).
        const nested = (body.options ?? {}) as Record<string, unknown>;
        const resolvedOptions: Record<string, unknown> = {
          ...nested,
          ...(body.model != null && { model: body.model }),
          ...(body.temperature != null && { temperature: body.temperature }),
          ...(body.maxTokens != null && { maxTokens: body.maxTokens }),
        };

        // ── Prepend system prompt ────────────────────────────
        // Vercel useChat sends `system` (or the deprecated `systemPrompt`)
        // as a top-level field.  We prepend it as a system message.
        const systemPrompt = (body.system ?? body.systemPrompt) as string | undefined;
        const finalMessages: ModelMessage[] = [
          ...(systemPrompt
            ? [{ role: 'system' as const, content: systemPrompt }]
            : []),
          ...(messages as ModelMessage[]),
        ];

        // ── Choose response mode ─────────────────────────────
        const wantStream = body.stream !== false;

        if (wantStream) {
          // Vercel Data Stream Protocol (SSE)
          try {
            if (!aiService.streamChat) {
              return { status: 501, body: { error: 'Streaming is not supported by the configured AI service' } };
            }
            const events = aiService.streamChat(finalMessages, resolvedOptions as any);
            return { status: 200, stream: true, vercelDataStream: true, events };
          } catch (err) {
            logger.error('[AI Route] /chat stream error', err instanceof Error ? err : undefined);
            return { status: 500, body: { error: 'Internal AI service error' } };
          }
        }

        // JSON response (non-streaming)
        try {
          const result = await aiService.chat(finalMessages, resolvedOptions as any);
          return { status: 200, body: result };
        } catch (err) {
          logger.error('[AI Route] /chat error', err instanceof Error ? err : undefined);
          return { status: 500, body: { error: 'Internal AI service error' } };
        }
      },
    },

    // ── Stream Chat (SSE) ──────────────────────────────────────
    {
      method: 'POST',
      path: '/api/v1/ai/chat/stream',
      description: 'SSE streaming chat completion',
      auth: true,
      permissions: ['ai:chat'],
      handler: async (req) => {
        const { messages, options } = (req.body ?? {}) as {
          messages?: unknown[];
          options?: Record<string, unknown>;
        };

        if (!Array.isArray(messages) || messages.length === 0) {
          return { status: 400, body: { error: 'messages array is required' } };
        }

        for (const msg of messages) {
          const err = validateMessage(msg);
          if (err) return { status: 400, body: { error: err } };
        }

        try {
          if (!aiService.streamChat) {
            return { status: 501, body: { error: 'Streaming is not supported by the configured AI service' } };
          }
          const events = aiService.streamChat(messages as ModelMessage[], options as any);
          return { status: 200, stream: true, events };
        } catch (err) {
          logger.error('[AI Route] /chat/stream error', err instanceof Error ? err : undefined);
          return { status: 500, body: { error: 'Internal AI service error' } };
        }
      },
    },

    // ── Complete ────────────────────────────────────────────────
    {
      method: 'POST',
      path: '/api/v1/ai/complete',
      description: 'Text completion',
      auth: true,
      permissions: ['ai:complete'],
      handler: async (req) => {
        const { prompt, options } = (req.body ?? {}) as {
          prompt?: string;
          options?: Record<string, unknown>;
        };

        if (!prompt || typeof prompt !== 'string') {
          return { status: 400, body: { error: 'prompt string is required' } };
        }

        try {
          const result = await aiService.complete(prompt, options as any);
          return { status: 200, body: result };
        } catch (err) {
          logger.error('[AI Route] /complete error', err instanceof Error ? err : undefined);
          return { status: 500, body: { error: 'Internal AI service error' } };
        }
      },
    },

    // ── Models ──────────────────────────────────────────────────
    {
      method: 'GET',
      path: '/api/v1/ai/models',
      description: 'List available models',
      auth: true,
      permissions: ['ai:read'],
      handler: async () => {
        try {
          const models = aiService.listModels ? await aiService.listModels() : [];
          return { status: 200, body: { models } };
        } catch (err) {
          logger.error('[AI Route] /models error', err instanceof Error ? err : undefined);
          return { status: 500, body: { error: 'Internal AI service error' } };
        }
      },
    },

    // ── Conversations ──────────────────────────────────────────
    {
      method: 'POST',
      path: '/api/v1/ai/conversations',
      description: 'Create a conversation',
      auth: true,
      permissions: ['ai:conversations'],
      handler: async (req) => {
        try {
          // Ensure the request body is a non-null object before mutating it
          if (req.body !== undefined && req.body !== null && (typeof req.body !== 'object' || Array.isArray(req.body))) {
            return { status: 400, body: { error: 'Invalid request payload' } };
          }

          const options: Record<string, unknown> = { ...((req.body ?? {}) as Record<string, unknown>) };
          // Bind the conversation to the authenticated user
          if (req.user?.userId) {
            options.userId = req.user.userId;
          }
          const conversation = await conversationService.create(options as any);
          return { status: 201, body: conversation };
        } catch (err) {
          logger.error('[AI Route] POST /conversations error', err instanceof Error ? err : undefined);
          return { status: 500, body: { error: 'Internal AI service error' } };
        }
      },
    },
    {
      method: 'GET',
      path: '/api/v1/ai/conversations',
      description: 'List conversations',
      auth: true,
      permissions: ['ai:conversations'],
      handler: async (req) => {
        try {
          const rawQuery = req.query ?? {};
          const options: Record<string, unknown> = { ...rawQuery };

          if (typeof rawQuery.limit === 'string') {
            const parsedLimit = Number(rawQuery.limit);
            if (!Number.isFinite(parsedLimit) || parsedLimit <= 0 || !Number.isInteger(parsedLimit)) {
              return { status: 400, body: { error: 'Invalid limit parameter' } };
            }
            options.limit = parsedLimit;
          }

          // Scope to the authenticated user's conversations
          if (req.user?.userId) {
            options.userId = req.user.userId;
          }

          const conversations = await conversationService.list(options as any);
          return { status: 200, body: { conversations } };
        } catch (err) {
          logger.error('[AI Route] GET /conversations error', err instanceof Error ? err : undefined);
          return { status: 500, body: { error: 'Internal AI service error' } };
        }
      },
    },
    {
      method: 'POST',
      path: '/api/v1/ai/conversations/:id/messages',
      description: 'Add message to a conversation',
      auth: true,
      permissions: ['ai:conversations'],
      handler: async (req) => {
        const id = req.params?.id;
        if (!id) {
          return { status: 400, body: { error: 'conversation id is required' } };
        }

        const message = req.body;
        const validationError = validateMessage(message);
        if (validationError) {
          return { status: 400, body: { error: validationError } };
        }

        try {
          // Ownership check: verify the conversation belongs to the current user
          if (req.user?.userId) {
            const existing = await conversationService.get(id);
            if (!existing) {
              return { status: 404, body: { error: `Conversation "${id}" not found` } };
            }
            if (existing.userId && existing.userId !== req.user.userId) {
              return { status: 403, body: { error: 'You do not have access to this conversation' } };
            }
          }

          const conversation = await conversationService.addMessage(id, message as ModelMessage);
          return { status: 200, body: conversation };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('not found')) {
            return { status: 404, body: { error: msg } };
          }
          logger.error('[AI Route] POST /conversations/:id/messages error', err instanceof Error ? err : undefined);
          return { status: 500, body: { error: 'Internal AI service error' } };
        }
      },
    },
    {
      method: 'DELETE',
      path: '/api/v1/ai/conversations/:id',
      description: 'Delete a conversation',
      auth: true,
      permissions: ['ai:conversations'],
      handler: async (req) => {
        const id = req.params?.id;
        if (!id) {
          return { status: 400, body: { error: 'conversation id is required' } };
        }

        try {
          // Ownership check: verify the conversation belongs to the current user
          if (req.user?.userId) {
            const existing = await conversationService.get(id);
            if (!existing) {
              return { status: 404, body: { error: `Conversation "${id}" not found` } };
            }
            if (existing.userId && existing.userId !== req.user.userId) {
              return { status: 403, body: { error: 'You do not have access to this conversation' } };
            }
          }

          await conversationService.delete(id);
          return { status: 204 };
        } catch (err) {
          logger.error('[AI Route] DELETE /conversations/:id error', err instanceof Error ? err : undefined);
          return { status: 500, body: { error: 'Internal AI service error' } };
        }
      },
    },
  ];
}
