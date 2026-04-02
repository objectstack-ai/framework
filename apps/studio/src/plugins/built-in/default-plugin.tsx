// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Built-in Plugin: Default Metadata Inspector
 * 
 * Provides a JSON tree viewer as the fallback for any metadata type
 * that doesn't have a specialized plugin. This is the "catch-all" viewer.
 * 
 * Priority is set to -1 so any type-specific plugin will take precedence.
 */

import { defineStudioPlugin } from '@objectstack/spec/studio';
import { MetadataInspector } from '@/components/MetadataInspector';
import type { StudioPlugin, MetadataViewerProps } from '../types';

// ─── Viewer Component (adapts MetadataInspector to plugin interface) ─

function DefaultViewerComponent({ metadataType, metadataName, packageId }: MetadataViewerProps) {
  return <MetadataInspector metaType={metadataType} metaName={metadataName} packageId={packageId} />;
}

// ─── Plugin Definition ───────────────────────────────────────────────

export const defaultInspectorPlugin: StudioPlugin = {
  manifest: defineStudioPlugin({
    id: 'objectstack.default-inspector',
    name: 'Default Metadata Inspector',
    version: '1.0.0',
    description: 'JSON tree viewer for any metadata type. Fallback when no specialized viewer is available.',
    contributes: {
      metadataViewers: [
        {
          id: 'json-inspector',
          metadataTypes: ['*'],  // Wildcard: matches all types
          label: 'JSON Inspector',
          priority: -1,          // Lowest priority — any plugin overrides this
          modes: ['preview', 'code'],
        },
      ],
    },
  }),

  activate(api) {
    api.registerViewer('json-inspector', DefaultViewerComponent);
  },
};
