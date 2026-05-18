// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { RAGPipelineConfigInput } from '@objectstack/spec/ai';

export const ProductInfoRAG: RAGPipelineConfigInput = {
  name: 'product_info',
  label: 'Product Information Pipeline',
  description: 'RAG pipeline for product catalog and specifications',

  embedding: {
    provider: 'openai',
    model: 'text-embedding-3-small',
    dimensions: 768,
  },

  vectorStore: {
    provider: 'pgvector',
    indexName: 'product_catalog_index',
    dimensions: 768,
    metric: 'cosine',
  },

  chunking: {
    type: 'semantic',
    maxChunkSize: 800,
  },

  retrieval: {
    type: 'hybrid',
    topK: 8,
    vectorWeight: 0.6,
    keywordWeight: 0.4,
  },

  loaders: [
    { type: 'directory', source: '/knowledge/products', fileTypes: ['.md', '.pdf'], recursive: true },
  ],

  maxContextTokens: 2000,
  enableCache: true,
  cacheTTL: 3600,
};
