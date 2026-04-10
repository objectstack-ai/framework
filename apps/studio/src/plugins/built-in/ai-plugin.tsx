// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Built-in Plugin: AI Protocol
 * 
 * Provides sidebar groups and icons for AI metadata types
 * (agents, ragPipelines).
 */

import { defineStudioPlugin } from '@objectstack/spec/studio';
import type { StudioPlugin } from '../types';
import { Bot, BookOpen, Wrench } from 'lucide-react';

export const aiProtocolPlugin: StudioPlugin = {
  manifest: defineStudioPlugin({
    id: 'objectstack.ai-protocol',
    name: 'AI Protocol',
    version: '1.0.0',
    description: 'Sidebar groups and icons for AI metadata types.',
    contributes: {
      sidebarGroups: [
        {
          key: 'ai',
          label: 'AI',
          icon: 'bot',
          metadataTypes: ['agent', 'tool', 'ragPipeline'],
          order: 50,
        },
      ],
      metadataIcons: [
        { metadataType: 'agent', label: 'Agents', icon: 'bot' },
        { metadataType: 'tool', label: 'Tools', icon: 'wrench' },
        { metadataType: 'ragPipeline', label: 'RAG Pipelines', icon: 'book-open' },
      ],
    },
  }),

  activate(api) {
    api.registerMetadataIcon('agent', Bot, 'Agents');
    api.registerMetadataIcon('tool', Wrench, 'Tools');
    api.registerMetadataIcon('ragPipeline', BookOpen, 'RAG Pipelines');
  },
};
