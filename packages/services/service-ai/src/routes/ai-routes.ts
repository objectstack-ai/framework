// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { IAIService, IAIConversationService, AIMessage } from '@objectstack/spec/contracts';
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
  /**
   * Handler receives a plain request-like object and returns a response-like
   * object.  SSE responses set `stream: true` and provide an async iterable.
   */
  handler: (req: RouteRequest) => Promise<RouteResponse>;
}

export interface RouteRequest {
  /** Parsed JSON body (for POST requests) */
  body?: unknown;
  /** Route/query parameters */
  params?: Record<string, string>;
  /** Query string parameters */
  query?: Record<string, string>;
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
}

/** Valid message roles accepted by the AI routes. */
const VALID_ROLES = new Set<string>(['system', 'user', 'assistant', 'tool']);

/**
 * Validate that `raw` is a well-formed AIMessage.
 * Returns null on success, or an error string on failure.
 */
function validateMessage(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) {
    return 'each message must be an object';
  }
  const msg = raw as Record<string, unknown>;
  if (typeof msg.role !== 'string' || !VALID_ROLES.has(msg.role)) {
    return `message.role must be one of ${[...VALID_ROLES].map(r => `"${r}"`).join(', ')}`;
  }
  if (typeof msg.content !== 'string') {
    return 'message.content must be a string';
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
    {
      method: 'POST',
      path: '/api/v1/ai/chat',
      description: 'Synchronous chat completion',
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
          const result = await aiService.chat(messages as AIMessage[], options as any);
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
          const events = aiService.streamChat(messages as AIMessage[], options as any);
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
      handler: async (req) => {
        try {
          const options = (req.body ?? {}) as Record<string, unknown>;
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
          const conversation = await conversationService.addMessage(id, message as AIMessage);
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
      handler: async (req) => {
        const id = req.params?.id;
        if (!id) {
          return { status: 400, body: { error: 'conversation id is required' } };
        }

        try {
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
