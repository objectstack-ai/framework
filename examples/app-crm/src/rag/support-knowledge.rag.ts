// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { RAGPipelineConfigInput } from '@objectstack/spec/ai';

export const SupportKnowledgeRAG: RAGPipelineConfigInput = {
  name: 'support_knowledge',
  label: 'Support Knowledge Pipeline',
  description: 'RAG pipeline for customer support knowledge base',

  embedding: {
    provider: 'openai',
    model: 'text-embedding-3-small',
    dimensions: 768,
  },

  vectorStore: {
    provider: 'pgvector',
    indexName: 'support_kb_index',
    dimensions: 768,
    metric: 'cosine',
  },

  chunking: {
    type: 'fixed',
    chunkSize: 512,
    chunkOverlap: 100,
    unit: 'tokens',
  },

  retrieval: {
    type: 'similarity',
    topK: 5,
    scoreThreshold: 0.75,
  },

  loaders: [
    { type: 'directory', source: '/knowledge/support', fileTypes: ['.md'], recursive: true },
  ],

  maxContextTokens: 3000,
  enableCache: true,
  cacheTTL: 3600,
};
