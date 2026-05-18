// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { RAGPipelineConfigInput } from '@objectstack/spec/ai';

export const CompetitiveIntelRAG: RAGPipelineConfigInput = {
  name: 'competitive_intel',
  label: 'Competitive Intelligence Pipeline',
  description: 'RAG pipeline for competitive analysis and market insights',

  embedding: {
    provider: 'openai',
    model: 'text-embedding-3-large',
    dimensions: 1536,
  },

  vectorStore: {
    provider: 'pgvector',
    indexName: 'competitive_index',
    dimensions: 1536,
    metric: 'cosine',
  },

  chunking: {
    type: 'semantic',
    maxChunkSize: 1200,
  },

  retrieval: {
    type: 'similarity',
    topK: 7,
    scoreThreshold: 0.65,
  },

  reranking: {
    enabled: true,
    provider: 'cohere',
    model: 'cohere-rerank',
    topK: 5,
  },

  loaders: [
    { type: 'directory', source: '/knowledge/competitive', fileTypes: ['.md'], recursive: true },
    { type: 'directory', source: '/knowledge/market-research', fileTypes: ['.pdf'], recursive: true },
  ],

  maxContextTokens: 5000,
  enableCache: true,
  cacheTTL: 1800,
};
