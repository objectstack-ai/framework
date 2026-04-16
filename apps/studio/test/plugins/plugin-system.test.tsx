// @vitest-environment happy-dom
// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PluginRegistry, PluginRegistryProvider, usePluginRegistry } from '../src/plugins';
import { defineStudioPlugin } from '@objectstack/spec/studio';
import type { StudioPlugin } from '../src/plugins/types';

// Test component that uses the plugin registry
function TestPluginConsumer() {
  const registry = usePluginRegistry();
  const viewers = registry.getViewersForType('object');

  return (
    <div>
      <div data-testid="viewer-count">{viewers.length}</div>
      {viewers.map(v => (
        <div key={v.id} data-testid={`viewer-${v.id}`}>{v.label}</div>
      ))}
    </div>
  );
}

// Mock plugin
const mockPlugin: StudioPlugin = {
  manifest: defineStudioPlugin({
    id: 'test.plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'Test plugin',
    contributes: {
      metadataViewers: [
        {
          id: 'test-viewer',
          metadataTypes: ['object'],
          label: 'Test Viewer',
          priority: 100,
        },
      ],
      sidebarGroups: [
        {
          key: 'test',
          label: 'Test',
          icon: 'database',
          metadataTypes: ['object'],
          order: 10,
        },
      ],
    },
  }),
  activate: vi.fn(),
};

describe('Plugin System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PluginRegistry', () => {
    it('should register plugins', () => {
      const registry = new PluginRegistry([mockPlugin]);

      expect(registry.getAllPlugins()).toHaveLength(1);
      expect(registry.getPlugin('test.plugin')).toBe(mockPlugin);
    });

    it('should activate plugins', () => {
      const registry = new PluginRegistry([mockPlugin]);
      const api = {} as any; // Mock API

      registry.activateAll(api);

      expect(mockPlugin.activate).toHaveBeenCalledWith(api);
    });

    it('should return viewers for metadata type', () => {
      const registry = new PluginRegistry([mockPlugin]);

      const viewers = registry.getViewersForType('object');

      expect(viewers).toHaveLength(1);
      expect(viewers[0].id).toBe('test-viewer');
      expect(viewers[0].label).toBe('Test Viewer');
    });

    it('should return empty array for unknown metadata type', () => {
      const registry = new PluginRegistry([mockPlugin]);

      const viewers = registry.getViewersForType('unknown');

      expect(viewers).toHaveLength(0);
    });

    it('should return sidebar groups', () => {
      const registry = new PluginRegistry([mockPlugin]);

      const groups = registry.getSidebarGroups();

      expect(groups).toHaveLength(1);
      expect(groups[0].key).toBe('test');
      expect(groups[0].label).toBe('Test');
    });

    it('should sort viewers by priority (higher first)', () => {
      const plugin1: StudioPlugin = {
        manifest: defineStudioPlugin({
          id: 'plugin1',
          name: 'Plugin 1',
          version: '1.0.0',
          contributes: {
            metadataViewers: [
              {
                id: 'viewer1',
                metadataTypes: ['object'],
                label: 'Viewer 1',
                priority: 50,
              },
            ],
          },
        }),
        activate: vi.fn(),
      };

      const plugin2: StudioPlugin = {
        manifest: defineStudioPlugin({
          id: 'plugin2',
          name: 'Plugin 2',
          version: '1.0.0',
          contributes: {
            metadataViewers: [
              {
                id: 'viewer2',
                metadataTypes: ['object'],
                label: 'Viewer 2',
                priority: 100,
              },
            ],
          },
        }),
        activate: vi.fn(),
      };

      const registry = new PluginRegistry([plugin1, plugin2]);
      const viewers = registry.getViewersForType('object');

      expect(viewers[0].id).toBe('viewer2'); // Higher priority first
      expect(viewers[1].id).toBe('viewer1');
    });
  });

  describe('PluginRegistryProvider', () => {
    it('should provide plugin registry to children', () => {
      render(
        <PluginRegistryProvider plugins={[mockPlugin]}>
          <TestPluginConsumer />
        </PluginRegistryProvider>
      );

      expect(screen.getByTestId('viewer-count')).toHaveTextContent('1');
      expect(screen.getByTestId('viewer-test-viewer')).toHaveTextContent('Test Viewer');
    });

    it('should handle empty plugin list', () => {
      render(
        <PluginRegistryProvider plugins={[]}>
          <TestPluginConsumer />
        </PluginRegistryProvider>
      );

      expect(screen.getByTestId('viewer-count')).toHaveTextContent('0');
    });
  });
});
