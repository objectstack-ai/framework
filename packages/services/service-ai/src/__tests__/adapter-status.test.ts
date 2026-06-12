// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.
//
// Adapter provenance — `GET /api/v1/ai/status` and the settings-apply
// status tracking on AIServicePlugin. Persisted settings silently override
// env auto-detection, so the plugin must expose WHICH config is live and
// WHY a saved config was not applied (broken settings used to be
// indistinguishable from working ones).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIServicePlugin } from '../plugin.js';
import { AIService } from '../ai-service.js';
import { buildAIRoutes } from '../routes/ai-routes.js';
import { InMemoryConversationService } from '../conversation/in-memory-conversation-service.js';
import { MemoryLLMAdapter } from '../adapters/memory-adapter.js';
import type { Logger } from '@objectstack/spec/contracts';

const silentLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
};

function createMockContext() {
  const services = new Map<string, unknown>();
  const hooks = new Map<string, Function[]>();
  services.set('manifest', { register: vi.fn() });

  return {
    services,
    hooks,
    registerService: vi.fn((name: string, service: unknown) => services.set(name, service)),
    replaceService: vi.fn((name: string, service: unknown) => services.set(name, service)),
    getService: vi.fn(<T,>(name: string): T => {
      if (!services.has(name)) throw new Error(`Service "${name}" not found`);
      return services.get(name) as T;
    }),
    getServices: vi.fn(() => services),
    hook: vi.fn((name: string, handler: Function) => {
      if (!hooks.has(name)) hooks.set(name, []);
      hooks.get(name)!.push(handler);
    }),
    trigger: vi.fn(async () => {}),
    logger: silentLogger,
    getKernel: vi.fn(),
  } as any;
}

async function fireHook(ctx: any, name: string): Promise<void> {
  for (const handler of ctx.hooks.get(name) ?? []) await handler();
}

/** Settings-service stub returning the given `ai` namespace values. */
function settingsStub(values: Record<string, { value: unknown; source?: string }>) {
  const actions = new Map<string, Function>();
  return {
    actions,
    getNamespace: vi.fn(async () => ({ values })),
    subscribe: vi.fn(),
    registerAction: vi.fn((ns: string, id: string, fn: Function) => actions.set(`${ns}/${id}`, fn)),
    resetNamespace: vi.fn(async () => 3),
  };
}

const AI_ENV_KEYS = [
  'AI_GATEWAY_MODEL',
  'AI_GATEWAY_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
];

describe('GET /api/v1/ai/status route', () => {
  it('returns adapter name plus the provenance from getAdapterStatus', async () => {
    const service = new AIService({
      adapter: new MemoryLLMAdapter(),
      conversationService: new InMemoryConversationService(),
    });
    const routes = buildAIRoutes(service, service.conversationService, silentLogger, {
      getAdapterStatus: () => ({
        description: 'Vercel AI Gateway (model: anthropic/claude-sonnet-4.6)',
        source: 'env',
        provider: 'gateway',
        model: 'anthropic/claude-sonnet-4.6',
        settingsError: null,
      }),
    });
    const statusRoute = routes.find(r => r.method === 'GET' && r.path === '/api/v1/ai/status');
    expect(statusRoute).toBeDefined();
    expect(statusRoute!.permissions).toEqual(['ai:read']);

    const response = await statusRoute!.handler({});
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      adapter: 'memory',
      source: 'env',
      provider: 'gateway',
      model: 'anthropic/claude-sonnet-4.6',
      settingsError: null,
    });
  });

  it('still serves adapter name when no status getter is wired', async () => {
    const service = new AIService({
      adapter: new MemoryLLMAdapter(),
      conversationService: new InMemoryConversationService(),
    });
    const routes = buildAIRoutes(service, service.conversationService, silentLogger);
    const statusRoute = routes.find(r => r.path === '/api/v1/ai/status')!;
    const response = await statusRoute.handler({});
    expect(response.status).toBe(200);
    expect((response.body as any).adapter).toBe('memory');
  });
});

describe('AIServicePlugin adapter provenance', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of AI_ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of AI_ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  async function statusOf(ctx: any): Promise<Record<string, unknown>> {
    // The plugin caches routes on trigger('ai:routes', routes).
    const call = ctx.trigger.mock.calls.find((c: unknown[]) => c[0] === 'ai:routes');
    const routes = call![1] as Array<{ path: string; handler: (req: object) => Promise<{ body?: unknown }> }>;
    const route = routes.find(r => r.path === '/api/v1/ai/status')!;
    return (await route.handler({})).body as Record<string, unknown>;
  }

  it('reports source=fallback when nothing is configured', async () => {
    const plugin = new AIServicePlugin();
    const ctx = createMockContext();
    await plugin.init(ctx);
    await plugin.start!(ctx);

    const body = await statusOf(ctx);
    expect(body.adapter).toBe('memory');
    expect(body.source).toBe('fallback');
    expect(body.provider).toBe('memory');
  });

  it('reports source=explicit for a constructor-supplied adapter', async () => {
    const plugin = new AIServicePlugin({
      adapter: {
        name: 'custom-test',
        chat: async () => ({ content: 'ok' }),
        complete: async () => ({ content: '' }),
      },
    });
    const ctx = createMockContext();
    await plugin.init(ctx);
    await plugin.start!(ctx);

    const body = await statusOf(ctx);
    expect(body.adapter).toBe('custom-test');
    expect(body.source).toBe('explicit');
  });

  it('flags settingsError when saved settings cannot build an adapter (broken cloudflare)', async () => {
    const plugin = new AIServicePlugin();
    const ctx = createMockContext();
    // provider=cloudflare with an empty key — exactly the broken leftover
    // a half-filled Setup form produces.
    ctx.services.set('settings', settingsStub({
      provider: { value: 'cloudflare', source: 'database' },
      cloudflare_account_id: { value: '2846eb40a60f4738e292b90dcd8cce10', source: 'database' },
      cloudflare_api_key: { value: '', source: 'database' },
      cloudflare_model: { value: 'claude/sonnet-4.6', source: 'database' },
    }));

    await plugin.init(ctx);
    await plugin.start!(ctx);
    await fireHook(ctx, 'kernel:ready');

    const body = await statusOf(ctx);
    // The broken settings must NOT have replaced the fallback adapter…
    expect(body.adapter).toBe('memory');
    expect(body.source).toBe('fallback');
    // …and the failure must be visible, naming the saved provider.
    expect(body.settingsProvider).toBe('cloudflare');
    expect(String(body.settingsError)).toContain('cloudflare');
  });

  it('reports source=settings when saved settings apply cleanly', async () => {
    const plugin = new AIServicePlugin();
    const ctx = createMockContext();
    // `memory` stored explicitly (source=database) is a valid, buildable choice.
    ctx.services.set('settings', settingsStub({
      provider: { value: 'memory', source: 'database' },
    }));

    await plugin.init(ctx);
    await plugin.start!(ctx);
    await fireHook(ctx, 'kernel:ready');

    const body = await statusOf(ctx);
    expect(body.source).toBe('settings');
    expect(body.settingsProvider).toBe('memory');
    expect(body.settingsError).toBeNull();
  });

  it('ai/reset clears saved values and re-runs env adapter detection', async () => {
    const plugin = new AIServicePlugin();
    const ctx = createMockContext();
    const settings = settingsStub({
      provider: { value: 'memory', source: 'database' },
    });
    ctx.services.set('settings', settings);

    await plugin.init(ctx);
    await plugin.start!(ctx);
    await fireHook(ctx, 'kernel:ready');

    // Saved settings are in effect…
    expect((await statusOf(ctx)).source).toBe('settings');

    // …then the operator hits "Reset to environment defaults".
    const reset = settings.actions.get('ai/reset');
    expect(reset).toBeDefined();
    const result = await reset!({ ctx: {} });
    expect(result.ok).toBe(true);
    expect(result.message).toContain('Cleared 3');
    expect(settings.resetNamespace).toHaveBeenCalledWith('ai', {});

    const body = await statusOf(ctx);
    // No AI env vars in this test → detection falls back to echo mode.
    expect(body.source).toBe('fallback');
    expect(body.settingsProvider).toBeUndefined();
    expect(body.settingsError).toBeNull();
  });

  it('keeps env provenance and clears settingsError when no settings are saved', async () => {
    const plugin = new AIServicePlugin();
    const ctx = createMockContext();
    ctx.services.set('settings', settingsStub({
      provider: { value: 'memory', source: 'default' },
    }));

    await plugin.init(ctx);
    await plugin.start!(ctx);
    await fireHook(ctx, 'kernel:ready');

    const body = await statusOf(ctx);
    expect(body.source).toBe('fallback');
    expect(body.settingsProvider).toBeUndefined();
    expect(body.settingsError).toBeNull();
  });
});
