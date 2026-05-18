// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { RAGPipelineConfigInput } from '@objectstack/spec/ai';

export const SalesKnowledgeRAG: RAGPipelineConfigInput = {
  name: 'sales_knowledge',
  label: 'Sales Knowledge Pipeline',
  description: 'RAG pipeline for sales team knowledge and best practices',

  embedding: {
    provider: 'openai',
    model: 'text-embedding-3-large',
    dimensions: 1536,
  },

  vectorStore: {
    provider: 'pgvector',
    indexName: 'sales_playbook_index',
    dimensions: 1536,
    metric: 'cosine',
  },

  chunking: {
    type: 'semantic',
    maxChunkSize: 1000,
  },

  retrieval: {
    type: 'hybrid',
    topK: 10,
    vectorWeight: 0.7,
    keywordWeight: 0.3,
  },

  reranking: {
    enabled: true,
    provider: 'cohere',
    model: 'cohere-rerank',
    topK: 5,
  },

  loaders: [
    { type: 'directory', source: '/knowledge/sales', fileTypes: ['.md'], recursive: true },
    { type: 'directory', source: '/knowledge/products', fileTypes: ['.pdf'], recursive: true },
  ],

  maxContextTokens: 4000,
  enableCache: true,
  cacheTTL: 3600,
};
