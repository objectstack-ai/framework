// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { TokenUsageSchema } from './cost.zod';

/**
 * RAG (Retrieval-Augmented Generation) Pipeline Protocol
 * 
 * Defines schemas for building context-aware AI assistants using RAG techniques.
 * Enables vector search, document chunking, embeddings, and retrieval configuration.
 */

/**
 * Vector Store Provider
 */
export const VectorStoreProviderSchema = z.enum([
  'pinecone',
  'weaviate',
  'qdrant',
  'milvus',
  'chroma',
  'pgvector',
  'redis',
  'opensearch',
  'elasticsearch',
  'custom',
]);

/**
 * Embedding Model
 */
export const EmbeddingModelSchema = z.object({
  provider: z.enum(['openai', 'cohere', 'huggingface', 'azure_openai', 'local', 'custom']),
  model: z.string().describe('Model name (e.g., "text-embedding-3-large")'),
  dimensions: z.number().int().positive().describe('Embedding vector dimensions'),
  maxTokens: z.number().int().positive().optional().describe('Maximum tokens per embedding'),
  batchSize: z.number().int().positive().optional().default(100).describe('Batch size for embedding'),
  endpoint: z.string().url().optional().describe('Custom endpoint URL'),
  apiKey: z.string().optional().describe('API key'),
  secretRef: z.string().optional().describe('Reference to stored secret'),
});

/**
 * Text Chunking Strategy
 */
export const ChunkingStrategySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('fixed'),
    chunkSize: z.number().int().positive().describe('Fixed chunk size in tokens/chars'),
    chunkOverlap: z.number().int().min(0).default(0).describe('Overlap between chunks'),
    unit: z.enum(['tokens', 'characters']).default('tokens'),
  }),
  z.object({
    type: z.literal('semantic'),
    model: z.string().optional().describe('Model for semantic chunking'),
    minChunkSize: z.number().int().positive().default(100),
    maxChunkSize: z.number().int().positive().default(1000),
  }),
  z.object({
    type: z.literal('recursive'),
    separators: z.array(z.string()).default(['\n\n', '\n', ' ', '']),
    chunkSize: z.number().int().positive(),
    chunkOverlap: z.number().int().min(0).default(0),
  }),
  z.object({
    type: z.literal('markdown'),
    maxChunkSize: z.number().int().positive().default(1000),
    respectHeaders: z.boolean().default(true).describe('Keep headers with content'),
    respectCodeBlocks: z.boolean().default(true).describe('Keep code blocks intact'),
  }),
]);

/**
 * Document Metadata Schema
 */
export const DocumentMetadataSchema = z.object({
  source: z.string().describe('Document source (file path, URL, etc.)'),
  sourceType: z.enum(['file', 'url', 'api', 'database', 'custom']).optional(),
  title: z.string().optional(),
  author: z.string().optional().describe('Document author'),
  createdAt: z.string().datetime().optional().describe('ISO timestamp'),
  updatedAt: z.string().datetime().optional().describe('ISO timestamp'),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  language: z.string().optional().describe('Document language (ISO 639-1 code)'),
  custom: z.record(z.string(), z.unknown()).optional().describe('Custom metadata fields'),
});

/**
 * Document Chunk
 */
export const DocumentChunkSchema = z.object({
  id: z.string().describe('Unique chunk identifier'),
  content: z.string().describe('Chunk text content'),
  embedding: z.array(z.number()).optional().describe('Embedding vector'),
  metadata: DocumentMetadataSchema,
  chunkIndex: z.number().int().min(0).describe('Chunk position in document'),
  tokens: z.number().int().optional().describe('Token count'),
});

/**
 * Retrieval Strategy
 */
export const RetrievalStrategySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('similarity'),
    topK: z.number().int().positive().default(5).describe('Number of results to retrieve'),
    scoreThreshold: z.number().min(0).max(1).optional().describe('Minimum similarity score'),
  }),
  z.object({
    type: z.literal('mmr'),
    topK: z.number().int().positive().default(5),
    fetchK: z.number().int().positive().default(20).describe('Initial fetch size'),
    lambda: z.number().min(0).max(1).default(0.5).describe('Diversity vs relevance (0=diverse, 1=relevant)'),
  }),
  z.object({
    type: z.literal('hybrid'),
    topK: z.number().int().positive().default(5),
    vectorWeight: z.number().min(0).max(1).default(0.7).describe('Weight for vector search'),
    keywordWeight: z.number().min(0).max(1).default(0.3).describe('Weight for keyword search'),
  }),
  z.object({
    type: z.literal('parent_document'),
    topK: z.number().int().positive().default(5),
    retrieveParent: z.boolean().default(true).describe('Retrieve full parent document'),
  }),
]);

/**
 * Reranking Configuration
 */
export const RerankingConfigSchema = z.object({
  enabled: z.boolean().default(false),
  model: z.string().optional().describe('Reranking model name'),
  provider: z.enum(['cohere', 'huggingface', 'custom']).optional(),
  topK: z.number().int().positive().default(3).describe('Final number of results after reranking'),
});

/**
 * Vector Store Configuration
 */
export const VectorStoreConfigSchema = z.object({
  provider: VectorStoreProviderSchema,
  indexName: z.string().describe('Index/collection name'),
  namespace: z.string().optional().describe('Namespace for multi-tenancy'),
  
  /** Connection */
  host: z.string().optional().describe('Vector store host'),
  port: z.number().int().optional().describe('Vector store port'),
  secretRef: z.string().optional().describe('Reference to stored secret'),
  apiKey: z.string().optional().describe('API key or reference to secret'),
  
  /** Configuration */
  dimensions: z.number().int().positive().describe('Vector dimensions'),
  metric: z.enum(['cosine', 'euclidean', 'dotproduct']).optional().default('cosine'),
  
  /** Performance */
  batchSize: z.number().int().positive().optional().default(100),
  connectionPoolSize: z.number().int().positive().optional().default(10),
  timeout: z.number().int().positive().optional().default(30000).describe('Timeout in milliseconds'),
});

/**
 * Document Loader Configuration
 */
export const DocumentLoaderConfigSchema = z.object({
  type: z.enum(['file', 'directory', 'url', 'api', 'database', 'custom']),
  
  /** Source */
  source: z.string().describe('Source path, URL, or identifier'),
  
  /** File Types */
  fileTypes: z.array(z.string()).optional().describe('Accepted file extensions (e.g., [".pdf", ".md"])'),
  
  /** Processing */
  recursive: z.boolean().optional().default(false).describe('Process directories recursively'),
  maxFileSize: z.number().int().optional().describe('Maximum file size in bytes'),
  excludePatterns: z.array(z.string()).optional().describe('Patterns to exclude'),
  
  /** Text Extraction */
  extractImages: z.boolean().optional().default(false).describe('Extract text from images (OCR)'),
  extractTables: z.boolean().optional().default(false).describe('Extract and format tables'),
  
  /** Custom Loader */
  loaderConfig: z.record(z.string(), z.unknown()).optional().describe('Custom loader-specific config'),
});

/**
 * Filter Expression Schema
 */
export const FilterExpressionSchema = z.object({
  field: z.string().describe('Metadata field to filter'),
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'contains']).default('eq'),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]).describe('Filter value'),
});

export type FilterGroup = {
  logic: 'and' | 'or';
  filters: (z.infer<typeof FilterExpressionSchema> | FilterGroup)[];
};

export const FilterGroupSchema: z.ZodType<FilterGroup> = z.object({
  logic: z.enum(['and', 'or']).default('and'),
  filters: z.array(z.union([FilterExpressionSchema, z.lazy(() => FilterGroupSchema)])),
});

/**
 * Standardized Metadata Filter
 */
export const MetadataFilterSchema = z.union([
  FilterExpressionSchema,
  FilterGroupSchema,
  // Legacy support for simple key-value map
  z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]))
]);

/**
 * RAG Pipeline Configuration
 */
export const RAGPipelineConfigSchema = z.object({
  /** Identity */
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/).describe('Pipeline name (snake_case)'),
  label: z.string().describe('Display name'),
  description: z.string().optional(),
  
  /** Components */
  embedding: EmbeddingModelSchema,
  vectorStore: VectorStoreConfigSchema,
  chunking: ChunkingStrategySchema,
  retrieval: RetrievalStrategySchema,
  reranking: RerankingConfigSchema.optional(),
  
  /** Document Loading */
  loaders: z.array(DocumentLoaderConfigSchema).optional().describe('Document loaders'),
  
  /** Context Management */
  maxContextTokens: z.number().int().positive().default(4000).describe('Maximum tokens in context'),
  contextWindow: z.number().int().positive().optional().describe('LLM context window size'),
  
  /** Metadata Filtering */
  metadataFilters: MetadataFilterSchema.optional().describe('Global filters for retrieval'),
  
  /** Caching */
  enableCache: z.boolean().default(true),
  cacheTTL: z.number().int().positive().default(3600).describe('Cache TTL in seconds'),
  cacheInvalidationStrategy: z.enum(['time_based', 'manual', 'on_update']).default('time_based').optional(),
});

/**
 * RAG Query Request
 */
export const RAGQueryRequestSchema = z.object({
  query: z.string().describe('User query'),
  pipelineName: z.string().describe('Pipeline to use'),
  
  /** Override defaults */
  topK: z.number().int().positive().optional(),
  metadataFilters: z.record(z.string(), z.unknown()).optional(),
  
  /** Context */
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })).optional(),
  
  /** Options */
  includeMetadata: z.boolean().default(true),
  includeSources: z.boolean().default(true),
});

/**
 * RAG Query Response
 */
export const RAGQueryResponseSchema = z.object({
  query: z.string(),
  results: z.array(z.object({
    content: z.string(),
    score: z.number(),
    metadata: DocumentMetadataSchema.optional(),
    chunkId: z.string().optional(),
  })),
  context: z.string().describe('Assembled context for LLM'),
  tokens: TokenUsageSchema.optional().describe('Token usage for this query'),
  cost: z.number().nonnegative().optional().describe('Cost for this query in USD'),
  retrievalTime: z.number().optional().describe('Retrieval time in milliseconds'),
});

/**
 * RAG Pipeline Status
 */
export const RAGPipelineStatusSchema = z.object({
  name: z.string(),
  status: z.enum(['active', 'indexing', 'error', 'disabled']),
  documentsIndexed: z.number().int().min(0),
  lastIndexed: z.string().datetime().optional().describe('ISO timestamp'),
  errorMessage: z.string().optional(),
  health: z.object({
    vectorStore: z.enum(['healthy', 'unhealthy', 'unknown']),
    embeddingService: z.enum(['healthy', 'unhealthy', 'unknown']),
  }).optional(),
});

// Type exports
export type VectorStoreProvider = z.infer<typeof VectorStoreProviderSchema>;
export type EmbeddingModel = z.infer<typeof EmbeddingModelSchema>;
export type ChunkingStrategy = z.infer<typeof ChunkingStrategySchema>;
export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;
export type DocumentChunk = z.infer<typeof DocumentChunkSchema>;
export type RetrievalStrategy = z.infer<typeof RetrievalStrategySchema>;
export type RerankingConfig = z.infer<typeof RerankingConfigSchema>;
export type VectorStoreConfig = z.infer<typeof VectorStoreConfigSchema>;
export type DocumentLoaderConfig = z.infer<typeof DocumentLoaderConfigSchema>;
export type RAGPipelineConfig = z.infer<typeof RAGPipelineConfigSchema>;
export type RAGQueryRequest = z.infer<typeof RAGQueryRequestSchema>;
export type RAGQueryResponse = z.infer<typeof RAGQueryResponseSchema>;
export type RAGPipelineStatus = z.infer<typeof RAGPipelineStatusSchema>;
