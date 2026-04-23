// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Built-in Plugin: Default Metadata Inspector
 * 
 * Provides two fallback viewers for any metadata type:
 * - **json-inspector** (preview mode): JSON tree viewer via MetadataInspector
 * - **code-exporter** (code mode): Exportable TypeScript/JSON via CodeExporter
 * 
 * Priority is set to -1 so any type-specific plugin will take precedence.
 */

import { useState, useEffect } from 'react';
import { defineStudioPlugin } from '@objectstack/spec/studio';
import { useClient } from '@objectstack/client-react';
import { useParams } from '@tanstack/react-router';
import { useScopedClient } from '@/hooks/useObjectStackClient';
import { MetadataInspector } from '@/components/MetadataInspector';
import { CodeExporter } from '@/components/CodeExporter';
import type { CodeExporterProps } from '@/components/CodeExporter';
import type { StudioPlugin, MetadataViewerProps } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────

/** Map Studio metadataType to CodeExporter's ExportType (all now use singular). */
const METADATA_TO_EXPORT_TYPE: Record<string, CodeExporterProps['type']> = {
  object: 'object',
  view: 'view',
  flow: 'flow',
  agent: 'agent',
  tool: 'tool',
  app: 'app',
};

// ─── Preview Viewer (JSON Inspector) ─────────────────────────────────

function PreviewViewerComponent({ metadataType, metadataName, packageId }: MetadataViewerProps) {
  return <MetadataInspector metaType={metadataType} metaName={metadataName} packageId={packageId} />;
}

// ─── Code Viewer (Code Exporter) ─────────────────────────────────────

function CodeViewerComponent({ metadataType, metadataName, data, packageId }: MetadataViewerProps) {
  const unscopedClient = useClient();
  const params = useParams({ strict: false }) as { projectId?: string };
  const scopedClient = useScopedClient(params.projectId);
  const client: any = scopedClient ?? unscopedClient;
  const [definition, setDefinition] = useState<Record<string, unknown> | null>(data ?? null);
  const [loading, setLoading] = useState(!data);

  useEffect(() => {
    // If data was passed directly, use it
    if (data) {
      setDefinition(data as Record<string, unknown>);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    async function load() {
      try {
        const result: any = await client.meta.getItem(metadataType, metadataName, packageId ? { packageId } : undefined);
        if (mounted) {
          setDefinition(result?.item || result);
        }
      } catch (err) {
        console.error(`[CodeViewer] Failed to load ${metadataType}/${metadataName}:`, err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [client, metadataType, metadataName, data, packageId]);

  if (loading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">Loading definition…</div>
    );
  }

  if (!definition) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Definition not found: <code className="font-mono">{metadataName}</code>
      </div>
    );
  }

  const exportType = METADATA_TO_EXPORT_TYPE[metadataType] ?? 'object';

  return (
    <div className="p-4">
      <CodeExporter type={exportType} definition={definition} name={metadataName} />
    </div>
  );
}

// ─── Plugin Definition ───────────────────────────────────────────────

export const defaultInspectorPlugin: StudioPlugin = {
  manifest: defineStudioPlugin({
    id: 'objectstack.default-inspector',
    name: 'Default Metadata Inspector',
    version: '1.0.0',
    description: 'JSON tree viewer and code exporter for any metadata type. Fallback when no specialized viewer is available.',
    contributes: {
      metadataViewers: [
        {
          id: 'json-inspector',
          metadataTypes: ['*'],
          label: 'JSON Inspector',
          priority: -1,
          modes: ['preview'],
        },
        {
          id: 'code-exporter',
          metadataTypes: ['*'],
          label: 'Code Export',
          priority: -1,
          modes: ['code'],
        },
      ],
    },
  }),

  activate(api) {
    api.registerViewer('json-inspector', PreviewViewerComponent);
    api.registerViewer('code-exporter', CodeViewerComponent);
  },
};
