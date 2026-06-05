// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `@objectstack/embedder-openai`
 *
 * OpenAI-compatible embedder. Drop-in for any endpoint that speaks the
 * `POST /v1/embeddings` shape:
 *
 *   - OpenAI                  https://api.openai.com/v1
 *   - Azure OpenAI            https://{resource}.openai.azure.com/openai/deployments/{deployment}
 *   - 阿里通义 DashScope       https://dashscope.aliyuncs.com/compatible-mode/v1
 *   - 智谱 BigModel            https://open.bigmodel.cn/api/paas/v4
 *   - 硅基流动 SiliconFlow     https://api.siliconflow.cn/v1
 *   - 火山引擎 Doubao          https://ark.cn-beijing.volces.com/api/v3
 *   - MiniMax                 https://api.minimax.chat/v1
 *   - Ollama (openai shim)    http://localhost:11434/v1
 *   - LiteLLM / vLLM / 任何兼容服务
 *
 * Implements the `IEmbedder` contract from `@objectstack/spec/contracts`.
 */

import type { IEmbedder } from '@objectstack/spec/contracts';
import { resilientFetch } from '@objectstack/spec/shared';

export interface OpenAIEmbedderOptions {
  /** Bearer token sent as `Authorization: Bearer <apiKey>`. Required. */
  apiKey: string;
  /**
   * Model id sent in the request body. Choose to match your provider:
   *  - OpenAI:        `'text-embedding-3-small'` (default), `'text-embedding-3-large'`
   *  - 阿里通义:       `'text-embedding-v3'`
   *  - 智谱:           `'embedding-3'`
   *  - 硅基流动:       `'BAAI/bge-m3'`, `'BAAI/bge-large-zh-v1.5'`
   *  - 火山 Doubao:    `'doubao-embedding-large-text-240915'`
   *  - Ollama:        `'bge-m3'`, `'nomic-embed-text'`
   *
   * @default 'text-embedding-3-small'
   */
  model?: string;
  /**
   * Override dimensions. Only Matryoshka-style models (OpenAI v3, 智谱 embedding-3,
   * BGE-m3 dense) support truncation. When set, also forwarded to the upstream
   * `dimensions` body field for providers that honour it.
   */
  dimensions?: number;
  /**
   * Endpoint base URL (without `/embeddings`). Defaults to OpenAI's. Set this
   * to point at any compatible provider.
   *
   * @default 'https://api.openai.com/v1'
   */
  baseUrl?: string;
  /** Stable id surfaced as `IEmbedder.id`. @default 'openai' */
  id?: string;
  /** Inject for tests. Defaults to `globalThis.fetch`. */
  fetch?: typeof fetch;
  /** Additional headers (e.g. provider-specific keys, tracing). */
  headers?: Record<string, string>;
}

/**
 * Known dimensions for popular models. Used as the default when the
 * caller doesn't pass `dimensions` explicitly.
 */
const KNOWN_DIMENSIONS: Record<string, number> = {
  // OpenAI
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
  // 阿里通义
  'text-embedding-v3': 1024,
  'text-embedding-v2': 1536,
  'text-embedding-v1': 1536,
  // 智谱
  'embedding-3': 2048,
  'embedding-2': 1024,
  // 硅基流动 / BGE 家族
  'BAAI/bge-m3': 1024,
  'BAAI/bge-large-zh-v1.5': 1024,
  'BAAI/bge-large-en-v1.5': 1024,
  'BAAI/bge-base-zh-v1.5': 768,
  'BAAI/bge-small-zh-v1.5': 512,
  'bge-m3': 1024,
  // 火山 Doubao
  'doubao-embedding-large-text-240915': 4096,
  'doubao-embedding-text-240715': 2048,
  // Nomic / Ollama defaults
  'nomic-embed-text': 768,
  // MiniMax
  'embo-01': 1536,
};

/**
 * `OpenAIEmbedder` — OpenAI-compatible embedder. One instance per
 * upstream provider + model combination. Pass into any knowledge
 * adapter that expects `IEmbedder`.
 *
 * @example
 * // OpenAI
 * new OpenAIEmbedder({ apiKey: process.env.OPENAI_API_KEY! });
 *
 * @example
 * // 阿里通义 DashScope
 * new OpenAIEmbedder({
 *   apiKey: process.env.DASHSCOPE_API_KEY!,
 *   baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
 *   model: 'text-embedding-v3',
 * });
 *
 * @example
 * // 硅基流动 SiliconFlow + BGE-m3
 * new OpenAIEmbedder({
 *   apiKey: process.env.SILICONFLOW_API_KEY!,
 *   baseUrl: 'https://api.siliconflow.cn/v1',
 *   model: 'BAAI/bge-m3',
 * });
 *
 * @example
 * // Local Ollama
 * new OpenAIEmbedder({
 *   apiKey: 'ollama',
 *   baseUrl: 'http://localhost:11434/v1',
 *   model: 'bge-m3',
 * });
 */
export class OpenAIEmbedder implements IEmbedder {
  readonly id: string;
  readonly dimensions: number;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestedDims?: number;
  private readonly extraHeaders: Record<string, string>;

  constructor(opts: OpenAIEmbedderOptions) {
    if (!opts.apiKey) throw new Error('OpenAIEmbedder: apiKey required');
    this.apiKey = opts.apiKey;
    this.id = opts.id ?? 'openai';
    this.model = opts.model ?? 'text-embedding-3-small';
    this.baseUrl = (opts.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.fetchImpl = opts.fetch ?? (globalThis.fetch as typeof fetch);
    this.requestedDims = opts.dimensions;
    this.extraHeaders = opts.headers ?? {};
    this.dimensions =
      opts.dimensions ?? KNOWN_DIMENSIONS[this.model] ?? 1536;
    if (!this.fetchImpl) {
      throw new Error(
        'OpenAIEmbedder: no fetch available; pass options.fetch or run on Node 18+ / a fetch-capable runtime',
      );
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const body: Record<string, unknown> = { model: this.model, input: texts };
    if (this.requestedDims) body.dimensions = this.requestedDims;
    const res = await resilientFetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
        ...this.extraHeaders,
      },
      body: JSON.stringify(body),
    }, { fetchImpl: this.fetchImpl });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `OpenAIEmbedder (${this.baseUrl}) → ${res.status} ${res.statusText}${text ? `: ${text.slice(0, 200)}` : ''}`,
      );
    }
    const json = (await res.json()) as { data?: Array<{ embedding: number[] }> };
    const data = json.data ?? [];
    if (data.length !== texts.length) {
      throw new Error(
        `OpenAIEmbedder: expected ${texts.length} vectors, got ${data.length}`,
      );
    }
    return data.map((d) => d.embedding);
  }
}

/**
 * Convenience presets for popular Chinese providers — saves callers
 * from memorising base URLs. Pass through `createXxxEmbedder({...})`.
 */
export const OPENAI_COMPATIBLE_PRESETS = {
  openai: 'https://api.openai.com/v1',
  azure: '', // user must provide full deployment URL via baseUrl
  dashscope: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  siliconflow: 'https://api.siliconflow.cn/v1',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
  minimax: 'https://api.minimax.chat/v1',
  ollama: 'http://localhost:11434/v1',
} as const;

export type OpenAICompatiblePreset = keyof typeof OPENAI_COMPATIBLE_PRESETS;

export interface PresetEmbedderOptions
  extends Omit<OpenAIEmbedderOptions, 'baseUrl'> {
  /** Pick a known provider; sets `baseUrl` automatically. */
  preset?: OpenAICompatiblePreset;
  /** Explicit override; takes precedence over `preset`. */
  baseUrl?: string;
}

/**
 * Helper: pick a provider by preset name. Equivalent to constructing
 * `OpenAIEmbedder` with the matching `baseUrl`.
 *
 * @example
 * createOpenAIEmbedder({ preset: 'dashscope', apiKey, model: 'text-embedding-v3' })
 */
export function createOpenAIEmbedder(opts: PresetEmbedderOptions): OpenAIEmbedder {
  const baseUrl =
    opts.baseUrl ??
    (opts.preset ? OPENAI_COMPATIBLE_PRESETS[opts.preset] : undefined);
  return new OpenAIEmbedder({ ...opts, baseUrl, id: opts.id ?? opts.preset ?? 'openai' });
}

export default OpenAIEmbedder;
