// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineStudioPlugin } from '@objectstack/spec/studio';
import type { StudioPlugin } from '../types';
import { FlowViewer } from '@/components/FlowViewer';

export const flowViewerPlugin: StudioPlugin = {
  manifest: defineStudioPlugin({
    id: 'objectstack.flow-viewer',
    name: 'Flow Viewer',
    version: '1.0.0',
    description: 'View flow metadata, run interactive tests, and inspect run history.',
    contributes: {
      metadataViewers: [
        {
          id: 'flow-viewer',
          metadataTypes: ['flow'],
          label: 'Flow',
          priority: 10,
          modes: ['preview'],
        },
      ],
    },
  }),

  activate(api) {
    api.registerViewer('flow-viewer', FlowViewer);
  },
};
