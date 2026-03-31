// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/core';
import type { IAIService, LLMAdapter } from '@objectstack/spec/contracts';
import { AIService } from './ai-service.js';
import type { AIServiceConfig } from './ai-service.js';
import { buildAIRoutes } from './routes/ai-routes.js';

/**
 * Configuration options for the AIServicePlugin.
 */
export interface AIServicePluginOptions {
  /** LLM adapter to use (defaults to MemoryLLMAdapter). */
  adapter?: LLMAdapter;
  /** Enable debug logging. */
  debug?: boolean;
}

/**
 * AIServicePlugin — Kernel plugin for the unified AI capability service.
 *
 * Lifecycle:
 * 1. **init** — Creates {@link AIService}, registers as `'ai'` service.
 *    If an existing AI service is already registered, it is replaced.
 * 2. **start** — Triggers `'ai:ready'` hook so other plugins can register
 *    tools or extend the service.  Registers REST/SSE routes.
 * 3. **destroy** — Cleans up references.
 *
 * @example
 * ```ts
 * import { LiteKernel } from '@objectstack/core';
 * import { AIServicePlugin } from '@objectstack/service-ai';
 *
 * const kernel = new LiteKernel();
 * kernel.use(new AIServicePlugin());
 * await kernel.bootstrap();
 *
 * const ai = kernel.getService<IAIService>('ai');
 * const result = await ai.chat([{ role: 'user', content: 'Hello' }]);
 * ```
 */
export class AIServicePlugin implements Plugin {
  name = 'com.objectstack.service-ai';
  version = '1.0.0';
  type = 'standard' as const;
  dependencies: string[] = [];

  private service?: AIService;
  private readonly options: AIServicePluginOptions;

  constructor(options: AIServicePluginOptions = {}) {
    this.options = options;
  }

  async init(ctx: PluginContext): Promise<void> {
    // Check if there is an existing AI service (e.g. from dev-plugin)
    let hasExisting = false;
    try {
      const existing = ctx.getService<IAIService>('ai');
      if (existing && typeof existing.chat === 'function') {
        hasExisting = true;
        ctx.logger.debug('[AI] Found existing AI service, replacing');
      }
    } catch {
      // No existing service — that's fine
    }

    const config: AIServiceConfig = {
      adapter: this.options.adapter,
      logger: ctx.logger,
    };

    this.service = new AIService(config);

    // Register or replace the AI service
    if (hasExisting) {
      ctx.replaceService('ai', this.service);
    } else {
      ctx.registerService('ai', this.service);
    }

    if (this.options.debug) {
      ctx.hook('ai:beforeChat', async (messages: unknown) => {
        ctx.logger.debug('[AI] Before chat', { messages });
      });
    }

    ctx.logger.info('[AI] Service initialized');
  }

  async start(ctx: PluginContext): Promise<void> {
    if (!this.service) return;

    // Trigger hook to notify AI service is ready — other plugins can register tools
    await ctx.trigger('ai:ready', this.service);

    // Build and expose route definitions
    const routes = buildAIRoutes(this.service, this.service.conversationService, ctx.logger);

    // Trigger hook so HTTP server plugins can mount these routes
    await ctx.trigger('ai:routes', routes);

    ctx.logger.info(
      `[AI] Service started — adapter="${this.service.adapterName}", ` +
      `tools=${this.service.toolRegistry.size}, ` +
      `routes=${routes.length}`,
    );
  }

  async destroy(): Promise<void> {
    this.service = undefined;
  }
}
