// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/core';
import type { IAIService, IAIConversationService, IDataEngine, IMetadataService, LLMAdapter } from '@objectstack/spec/contracts';
import { AIService } from './ai-service.js';
import type { AIServiceConfig } from './ai-service.js';
import { buildAIRoutes } from './routes/ai-routes.js';
import { buildAgentRoutes } from './routes/agent-routes.js';
import { ObjectQLConversationService } from './conversation/objectql-conversation-service.js';
import { AiConversationObject, AiMessageObject } from './objects/index.js';
import { registerDataTools } from './tools/data-tools.js';
import { registerMetadataTools } from './tools/metadata-tools.js';
import { AgentRuntime } from './agent-runtime.js';
import { DATA_CHAT_AGENT, METADATA_ASSISTANT_AGENT } from './agents/index.js';

/**
 * Configuration options for the AIServicePlugin.
 */
export interface AIServicePluginOptions {
  /** LLM adapter to use (defaults to MemoryLLMAdapter). */
  adapter?: LLMAdapter;
  /** Enable debug logging. */
  debug?: boolean;
  /** Explicit conversation service override. When set, auto-detection is skipped. */
  conversationService?: IAIConversationService;
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
  dependencies: string[] = ['com.objectstack.engine.objectql']; // manifest service required

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

    // Determine conversation service: explicit > auto-detect IDataEngine > InMemory fallback
    let conversationService: IAIConversationService | undefined = this.options.conversationService;
    if (!conversationService) {
      try {
        const engine = ctx.getService<IDataEngine>('data');
        if (engine && typeof engine.find === 'function') {
          conversationService = new ObjectQLConversationService(engine);
          ctx.logger.info('[AI] Using ObjectQLConversationService (IDataEngine detected)');
        }
      } catch {
        // No data engine — fall back to InMemory
      }
    }

    const config: AIServiceConfig = {
      adapter: this.options.adapter,
      logger: ctx.logger,
      conversationService,
    };

    this.service = new AIService(config);

    // Register or replace the AI service
    if (hasExisting) {
      ctx.replaceService('ai', this.service);
    } else {
      ctx.registerService('ai', this.service);
    }

    // Register AI system objects via the manifest service.
    ctx.getService<{ register(m: any): void }>('manifest').register({
      id: 'com.objectstack.service-ai',
      name: 'AI Service',
      version: '1.0.0',
      type: 'plugin',
      namespace: 'ai',
      objects: [AiConversationObject, AiMessageObject],
    });

    if (this.options.debug) {
      ctx.hook('ai:beforeChat', async (messages: unknown) => {
        ctx.logger.debug('[AI] Before chat', { messages });
      });
    }

    // Contribute navigation items to the Setup App (if SetupPlugin is loaded).
    try {
      const setupNav = ctx.getService<{ contribute(c: any): void }>('setupNav');
      if (setupNav) {
        setupNav.contribute({
          areaId: 'area_ai',
          items: [
            { id: 'nav_ai_conversations', type: 'object', label: { key: 'setup.nav.ai_conversations', defaultValue: 'Conversations' }, objectName: 'conversations', icon: 'message-square', order: 10 },
            { id: 'nav_ai_messages', type: 'object', label: { key: 'setup.nav.ai_messages', defaultValue: 'Messages' }, objectName: 'messages', icon: 'messages-square', order: 20 },
          ],
        });
        ctx.logger.info('[AI] Navigation items contributed to Setup App');
      }
    } catch {
      // SetupPlugin not loaded — skip silently
    }

    ctx.logger.info('[AI] Service initialized');
  }

  async start(ctx: PluginContext): Promise<void> {
    if (!this.service) return;

    // ── Auto-register built-in tools & agents when services are available ──
    let metadataService: IMetadataService | undefined;
    try {
      metadataService = ctx.getService<IMetadataService>('metadata');
    } catch {
      ctx.logger.debug('[AI] Metadata service not available');
    }

    // Data tools require both data engine and metadata service
    try {
      const dataEngine = ctx.getService<IDataEngine>('data');
      if (dataEngine && metadataService) {
        registerDataTools(this.service.toolRegistry, { dataEngine, metadataService });
        ctx.logger.info('[AI] Built-in data tools registered');

        // Register the built-in data_chat agent only if it does not already exist
        const agentExists =
          typeof metadataService.exists === 'function'
            ? await metadataService.exists('agent', DATA_CHAT_AGENT.name)
            : false;

        if (!agentExists) {
          await metadataService.register('agent', DATA_CHAT_AGENT.name, DATA_CHAT_AGENT);
          ctx.logger.info('[AI] data_chat agent registered');
        } else {
          ctx.logger.debug('[AI] data_chat agent already exists, skipping auto-registration');
        }
      }
    } catch {
      ctx.logger.debug('[AI] Data engine not available, skipping data tools');
    }

    // Metadata tools require only the metadata service
    if (metadataService) {
      try {
        registerMetadataTools(this.service.toolRegistry, { metadataService });
        ctx.logger.info('[AI] Built-in metadata tools registered');

        // Register the built-in metadata_assistant agent
        const agentExists =
          typeof metadataService.exists === 'function'
            ? await metadataService.exists('agent', METADATA_ASSISTANT_AGENT.name)
            : false;

        if (!agentExists) {
          await metadataService.register('agent', METADATA_ASSISTANT_AGENT.name, METADATA_ASSISTANT_AGENT);
          ctx.logger.info('[AI] metadata_assistant agent registered');
        } else {
          ctx.logger.debug('[AI] metadata_assistant agent already exists, skipping auto-registration');
        }
      } catch (err) {
        ctx.logger.debug('[AI] Failed to register metadata tools', err instanceof Error ? err : undefined);
      }
    }

    // Trigger hook to notify AI service is ready — other plugins can register tools
    await ctx.trigger('ai:ready', this.service);

    // Build and expose route definitions
    const routes = buildAIRoutes(this.service, this.service.conversationService, ctx.logger);

    // Build agent routes if metadata service is available
    try {
      const metadataService = ctx.getService<IMetadataService>('metadata');
      if (metadataService) {
        const agentRuntime = new AgentRuntime(metadataService);
        const agentRoutes = buildAgentRoutes(this.service, agentRuntime, ctx.logger);
        routes.push(...agentRoutes);
      }
    } catch {
      ctx.logger.debug('[AI] Metadata service not available, skipping agent routes');
    }

    // Trigger hook so HTTP server plugins can mount these routes
    await ctx.trigger('ai:routes', routes);

    // Cache routes on the kernel so HttpDispatcher can find them
    const kernel = ctx.getKernel();
    if (kernel) {
      (kernel as any).__aiRoutes = routes;
    }

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
