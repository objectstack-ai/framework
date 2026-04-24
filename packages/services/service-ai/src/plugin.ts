// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/core';
import type { IAIService, IAIConversationService, IDataEngine, IMetadataService, LLMAdapter } from '@objectstack/spec/contracts';
import { AIService } from './ai-service.js';
import type { AIServiceConfig } from './ai-service.js';
import { buildAIRoutes } from './routes/ai-routes.js';
import { buildAgentRoutes } from './routes/agent-routes.js';
import { buildToolRoutes } from './routes/tool-routes.js';
import { ObjectQLConversationService } from './conversation/objectql-conversation-service.js';
import { AiConversationObject, AiMessageObject } from './objects/index.js';
import { registerDataTools } from './tools/data-tools.js';
import { registerMetadataTools } from './tools/metadata-tools.js';
import { AgentRuntime } from './agent-runtime.js';
import { DATA_CHAT_AGENT, METADATA_ASSISTANT_AGENT } from './agents/index.js';
import { VercelLLMAdapter } from './adapters/vercel-adapter.js';
import { MemoryLLMAdapter } from './adapters/memory-adapter.js';

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

  /**
   * Auto-detect LLM provider from environment variables.
   *
   * Priority order:
   * 1. AI_GATEWAY_MODEL → Vercel AI Gateway
   * 2. OPENAI_API_KEY → OpenAI
   * 3. ANTHROPIC_API_KEY → Anthropic
   * 4. GOOGLE_GENERATIVE_AI_API_KEY → Google
   * 5. Fallback → MemoryLLMAdapter
   *
   * Returns the adapter and a description for logging.
   */
  private async detectAdapter(ctx: PluginContext): Promise<{ adapter: LLMAdapter; description: string }> {
    // 1. Vercel AI Gateway — works with any provider via gateway('provider/model')
    const gatewayModel = process.env.AI_GATEWAY_MODEL;
    if (gatewayModel) {
      try {
        const gatewayPkg = '@ai-sdk/gateway';
        const { gateway } = await import(/* webpackIgnore: true */ gatewayPkg);
        const adapter = new VercelLLMAdapter({ model: gateway(gatewayModel) });
        return { adapter, description: `Vercel AI Gateway (model: ${gatewayModel})` };
      } catch (err) {
        ctx.logger.warn(
          `[AI] Failed to load @ai-sdk/gateway for AI_GATEWAY_MODEL=${gatewayModel}, trying next provider`,
          err instanceof Error ? { error: err.message } : undefined
        );
      }
    }

    // 2. Direct provider SDKs
    const providerConfigs: Array<{
      envKey: string;
      pkg: string;
      factory: string;
      defaultModel: string;
      displayName: string;
    }> = [
      {
        envKey: 'OPENAI_API_KEY',
        pkg: '@ai-sdk/openai',
        factory: 'openai',
        defaultModel: 'gpt-4o',
        displayName: 'OpenAI'
      },
      {
        envKey: 'ANTHROPIC_API_KEY',
        pkg: '@ai-sdk/anthropic',
        factory: 'anthropic',
        defaultModel: 'claude-sonnet-4-20250514',
        displayName: 'Anthropic'
      },
      {
        envKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
        pkg: '@ai-sdk/google',
        factory: 'google',
        defaultModel: 'gemini-2.0-flash',
        displayName: 'Google'
      },
    ];

    for (const { envKey, pkg, factory, defaultModel, displayName } of providerConfigs) {
      if (process.env[envKey]) {
        try {
          const mod = await import(/* webpackIgnore: true */ pkg);
          const createModel = mod[factory] ?? mod.default;
          if (typeof createModel === 'function') {
            const modelId = process.env.AI_MODEL ?? defaultModel;
            const adapter = new VercelLLMAdapter({ model: createModel(modelId) });
            return { adapter, description: `${displayName} (model: ${modelId})` };
          }
        } catch (err) {
          ctx.logger.warn(
            `[AI] Failed to load ${pkg} for ${envKey}, trying next provider`,
            err instanceof Error ? { error: err.message } : undefined
          );
        }
      }
    }

    // 3. Fallback to MemoryLLMAdapter
    ctx.logger.warn('[AI] No LLM provider configured via environment variables. Falling back to MemoryLLMAdapter (echo mode). Set AI_GATEWAY_MODEL, OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY to use a real LLM.');
    return { adapter: new MemoryLLMAdapter(), description: 'MemoryLLMAdapter (echo mode - for testing only)' };
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

    // Determine LLM adapter: explicit > auto-detect from env > MemoryLLMAdapter fallback
    let adapter: LLMAdapter;
    let adapterDescription: string;

    if (this.options.adapter) {
      // User provided an explicit adapter
      adapter = this.options.adapter;
      adapterDescription = `${adapter.name} (explicitly configured)`;
    } else {
      // Auto-detect from environment variables
      const detected = await this.detectAdapter(ctx);
      adapter = detected.adapter;
      adapterDescription = detected.description;
    }

    // Log the selected adapter
    ctx.logger.info(`[AI] Using LLM adapter: ${adapterDescription}`);

    const config: AIServiceConfig = {
      adapter,
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
      scope: 'platform',
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
            { id: 'nav_ai_conversations', type: 'object', label: 'Conversations', objectName: 'ai_conversations', icon: 'message-square', order: 10 },
            { id: 'nav_ai_messages', type: 'object', label: 'Messages', objectName: 'ai_messages', icon: 'messages-square', order: 20 },
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
    // Helper: race a promise against a timeout, resolving null on timeout
    const withTimeout = <T>(promise: Promise<T>, ms = 2000): Promise<T | null> =>
      Promise.race([promise, new Promise<null>(resolve => setTimeout(() => resolve(null), ms))]);
    try {
      metadataService = ctx.getService<IMetadataService>('metadata');
      console.log('[AI Plugin] Retrieved metadata service:', !!metadataService, 'has getRegisteredTypes:', typeof (metadataService as any)?.getRegisteredTypes);
    } catch (e: any) {
      console.log('[AI] Metadata service not available:', e.message);
      ctx.logger.debug('[AI] Metadata service not available');
    }

    // Probe metadata service reachability with a short timeout.
    // If the backing store (e.g. Turso) is unreachable, exists() will hang.
    // A single probe determines whether persistence is available for all subsequent calls.
    if (metadataService && typeof metadataService.exists === 'function') {
      const probeResult = await withTimeout(metadataService.exists('tool', '__probe__'), 3000);
      if (probeResult === null) {
        ctx.logger.warn('[AI] Metadata service unreachable (timed out) — AI tools/agents will work but Studio visibility unavailable');
        metadataService = undefined; // disable persistence for this boot
      }
    }

    // Data tools require only the data engine
    try {
      const dataEngine = ctx.getService<IDataEngine>('data');
      if (dataEngine) {
        registerDataTools(this.service.toolRegistry, { dataEngine });
        ctx.logger.info('[AI] Built-in data tools registered');

        // Register data tools as metadata (for Studio visibility)
        if (metadataService) {
          const { DATA_TOOL_DEFINITIONS } = await import('./tools/data-tools.js');
          for (const toolDef of DATA_TOOL_DEFINITIONS) {
            const toolExists =
              typeof metadataService.exists === 'function'
                ? await withTimeout(metadataService.exists('tool', toolDef.name))
                : false;

            if (toolExists === null) {
              ctx.logger.warn('[AI] Metadata service timed out checking tool existence (non-fatal), skipping persistence');
              break;
            }

            if (!toolExists) {
              try {
                await withTimeout(metadataService.register('tool', toolDef.name, toolDef));
              } catch (err) {
                ctx.logger.warn('[AI] Failed to persist tool metadata (non-fatal)',
                  err instanceof Error ? { tool: toolDef.name, error: err.message } : { tool: toolDef.name });
              }
            }
          }
          ctx.logger.info(`[AI] ${DATA_TOOL_DEFINITIONS.length} data tools registered as metadata`);
        }

        // Register the built-in data_chat agent (requires metadata service)
        if (metadataService) {
          try {
            const agentExists =
              typeof metadataService.exists === 'function'
                ? await withTimeout(metadataService.exists('agent', DATA_CHAT_AGENT.name))
                : false;

            if (agentExists === null) {
              ctx.logger.warn('[AI] Metadata service timed out checking data_chat agent, skipping');
            } else if (!agentExists) {
              await withTimeout(metadataService.register('agent', DATA_CHAT_AGENT.name, DATA_CHAT_AGENT));
              console.log('[AI] Registered data_chat agent to metadataService');
              ctx.logger.info('[AI] data_chat agent registered');
            } else {
              console.log('[AI] data_chat agent already exists, skipping');
              ctx.logger.debug('[AI] data_chat agent already exists, skipping auto-registration');
            }
          } catch (err) {
            ctx.logger.warn('[AI] Failed to register data_chat agent', err instanceof Error ? { error: err.message, stack: err.stack } : { error: String(err) });
          }
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

        // Register metadata tools as metadata (for Studio visibility)
        const { METADATA_TOOL_DEFINITIONS } = await import('./tools/metadata-tools.js');
        for (const toolDef of METADATA_TOOL_DEFINITIONS) {
          const toolExists =
            typeof metadataService.exists === 'function'
              ? await withTimeout(metadataService.exists('tool', toolDef.name))
              : false;

          if (toolExists === null) {
            ctx.logger.warn('[AI] Metadata service timed out checking tool existence (non-fatal), skipping persistence');
            break;
          }

          if (!toolExists) {
            try {
              await withTimeout(metadataService.register('tool', toolDef.name, toolDef));
            } catch (err) {
              ctx.logger.warn('[AI] Failed to persist tool metadata (non-fatal)',
                err instanceof Error ? { tool: toolDef.name, error: err.message } : { tool: toolDef.name });
            }
          }
        }
        ctx.logger.info(`[AI] ${METADATA_TOOL_DEFINITIONS.length} metadata tools registered as metadata`);

        // Register the built-in metadata_assistant agent
        try {
          const agentExists =
            typeof metadataService.exists === 'function'
              ? await withTimeout(metadataService.exists('agent', METADATA_ASSISTANT_AGENT.name))
              : false;

          if (agentExists === null) {
            ctx.logger.warn('[AI] Metadata service timed out checking metadata_assistant agent, skipping');
          } else if (!agentExists) {
            await withTimeout(metadataService.register('agent', METADATA_ASSISTANT_AGENT.name, METADATA_ASSISTANT_AGENT));
            console.log('[AI] Registered metadata_assistant agent to metadataService');
            ctx.logger.info('[AI] metadata_assistant agent registered');
          } else {
            console.log('[AI] metadata_assistant agent already exists, skipping');
            ctx.logger.debug('[AI] metadata_assistant agent already exists, skipping auto-registration');
          }
        } catch (err) {
          ctx.logger.warn('[AI] Failed to register metadata_assistant agent', err instanceof Error ? { error: err.message, stack: err.stack } : { error: String(err) });
        }
      } catch (err) {
        ctx.logger.debug('[AI] Failed to register metadata tools', err instanceof Error ? err : undefined);
      }
    }

    // Trigger hook to notify AI service is ready — other plugins can register tools
    await ctx.trigger('ai:ready', this.service);

    // Build and expose route definitions
    const routes = buildAIRoutes(this.service, this.service.conversationService, ctx.logger);

    // Build tool routes
    const toolRoutes = buildToolRoutes(this.service, ctx.logger);
    routes.push(...toolRoutes);
    ctx.logger.info(`[AI] Tool routes registered (${toolRoutes.length} routes)`);

    // Build agent routes if metadata service is available
    if (metadataService) {
      const agentRuntime = new AgentRuntime(metadataService);
      const agentRoutes = buildAgentRoutes(this.service, agentRuntime, ctx.logger);
      routes.push(...agentRoutes);
      ctx.logger.info(`[AI] Agent routes registered (${agentRoutes.length} routes)`);
    } else {
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
