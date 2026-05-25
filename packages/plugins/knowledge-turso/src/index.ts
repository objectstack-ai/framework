// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `@objectstack/knowledge-turso`
 *
 * Turso / libSQL native-vector knowledge adapter. Implements the
 * `IKnowledgeAdapter` contract on top of `F32_BLOB` columns +
 * `libsql_vector_idx` (DiskANN). Each `KnowledgeSource` gets its own
 * `knowledge_<source.id>` table, bootstrapped lazily.
 */

import type { Plugin, PluginContext } from '@objectstack/core';
import type { IKnowledgeService } from '@objectstack/spec/contracts';
import { KNOWLEDGE_SERVICE } from '@objectstack/spec/contracts';
import { createClient, type Client } from '@libsql/client';

import { TursoKnowledgeAdapter, type TursoAdapterOptions } from './turso-adapter';
import type { EmbeddingProvider } from './embedding';

export { TursoKnowledgeAdapter } from './turso-adapter';
export type { TursoAdapterOptions } from './turso-adapter';
export {
  HashEmbeddingProvider,
  OpenAIEmbeddingProvider,
  type EmbeddingProvider,
  type OpenAIEmbeddingOptions,
} from './embedding';

export interface KnowledgeTursoPluginOptions {
  /** Adapter id used in `KnowledgeSource.adapter`. @default 'turso' */
  id?: string;
  /**
   * Either a libsql connection url (`libsql://…`, `file:…`, `:memory:`)
   * with optional auth token, OR a pre-constructed client. The latter is
   * useful when the kernel already owns a Turso connection (e.g. shared
   * with `driver-turso`).
   */
  url?: string;
  authToken?: string;
  client?: Client;
  /** Embedding provider — required. */
  embedding: EmbeddingProvider;
  /** Forwarded to the adapter. */
  chunkTarget?: TursoAdapterOptions['chunkTarget'];
  /** Forwarded to the adapter. */
  overFetch?: TursoAdapterOptions['overFetch'];
}

/**
 * `KnowledgeTursoPlugin` — registers a `TursoKnowledgeAdapter` with the
 * host's `IKnowledgeService` during `start()`. If the service is not
 * installed the plugin no-ops with a warning so the host can boot.
 */
export class KnowledgeTursoPlugin implements Plugin {
  name = 'com.objectstack.plugin.knowledge-turso';
  version = '0.1.0';
  type = 'standard' as const;

  private readonly adapter: TursoKnowledgeAdapter;
  private readonly ownsClient: boolean;
  private readonly client: Client;

  constructor(opts: KnowledgeTursoPluginOptions) {
    if (!opts.embedding) {
      throw new Error('KnowledgeTursoPlugin: `embedding` provider is required.');
    }
    if (opts.client) {
      this.client = opts.client;
      this.ownsClient = false;
    } else {
      if (!opts.url) {
        throw new Error('KnowledgeTursoPlugin: provide either `client` or `url`.');
      }
      this.client = createClient({ url: opts.url, authToken: opts.authToken });
      this.ownsClient = true;
    }
    this.adapter = new TursoKnowledgeAdapter({
      id: opts.id ?? 'turso',
      client: this.client,
      embedder: opts.embedding,
      chunkTarget: opts.chunkTarget,
      overFetch: opts.overFetch,
    });
  }

  async init(_ctx: PluginContext): Promise<void> {
    // No-op: registration deferred to start() once IKnowledgeService is up.
  }

  async start(ctx: PluginContext): Promise<void> {
    let svc: IKnowledgeService | undefined;
    try {
      svc = ctx.getService<IKnowledgeService>(KNOWLEDGE_SERVICE);
    } catch {
      ctx.logger.warn?.(
        'KnowledgeTursoPlugin: IKnowledgeService not registered — install KnowledgeServicePlugin first.',
      );
      return;
    }
    svc.registerAdapter(this.adapter.id, this.adapter);
    ctx.logger.info?.(`KnowledgeTursoPlugin: adapter '${this.adapter.id}' registered.`);
  }

  async stop(_ctx: PluginContext): Promise<void> {
    if (this.ownsClient) {
      try {
        this.client.close();
      } catch {
        /* noop */
      }
    }
  }
}

export default KnowledgeTursoPlugin;
