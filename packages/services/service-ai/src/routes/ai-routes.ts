// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { AIService } from '../ai-service.js';
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

/**
 * Build the standard AI REST/SSE routes.
 *
 * Returns an array of {@link RouteDefinition}s that can be self-registered
 * with the kernel's HTTP server during the plugin `start` phase.
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
export function buildAIRoutes(service: AIService, logger: Logger): RouteDefinition[] {
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

        try {
          const result = await service.chat(messages as any, options as any);
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

        try {
          const events = service.streamChat(messages as any, options as any);
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
          const result = await service.complete(prompt, options as any);
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
          const models = await service.listModels();
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
          const conversation = await service.conversationService.create(options as any);
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
          const conversations = await service.conversationService.list(req.query as any);
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

        const message = req.body as Record<string, unknown> | undefined;
        if (!message || typeof message.content !== 'string') {
          return { status: 400, body: { error: 'message with content string is required' } };
        }

        try {
          const conversation = await service.conversationService.addMessage(id, message as any);
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
          await service.conversationService.delete(id);
          return { status: 204 };
        } catch (err) {
          logger.error('[AI Route] DELETE /conversations/:id error', err instanceof Error ? err : undefined);
          return { status: 500, body: { error: 'Internal AI service error' } };
        }
      },
    },
  ];
}
