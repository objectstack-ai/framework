// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useEffect, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useClient } from '@objectstack/client-react';
import { useScopedClient } from '@/hooks/useObjectStackClient';
import type { MetadataViewerProps } from '@/plugins/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Workflow, Zap, Calendar, MousePointerClick, Globe, Database, CheckCircle2 } from 'lucide-react';
import { JsonTree } from './MetadataInspector';
import { FlowTestRunner } from './FlowTestRunner';
import { FlowRunsPanel } from './FlowRunsPanel';

function resolveLabel(val: unknown): string {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && 'defaultValue' in val) return String((val as any).defaultValue);
  if (val && typeof val === 'object' && 'key' in val) return String((val as any).key);
  return '';
}

const TRIGGER_ICONS: Record<string, any> = {
  autolaunched: Zap,
  record_change: Database,
  schedule: Calendar,
  screen: MousePointerClick,
  api: Globe,
};

const TRIGGER_LABELS: Record<string, string> = {
  autolaunched: 'Autolaunched',
  record_change: 'Record Change',
  schedule: 'Schedule',
  screen: 'Screen',
  api: 'API',
};

export function FlowViewer({ metadataName, data, packageId }: MetadataViewerProps) {
  const params = useParams({ strict: false }) as { projectId?: string };
  const unscoped = useClient();
  const scoped = useScopedClient(params.projectId);
  const client: any = scoped ?? unscoped;

  const [flow, setFlow] = useState<any>(data ?? null);
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (data) { setFlow(data); setLoading(false); return; }
    if (!client?.meta?.getItem) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res: any = await client.meta.getItem('flow', metadataName, packageId ? { packageId } : undefined);
        if (mounted) setFlow(res?.item ?? res);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [client, metadataName, packageId, data]);

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Card>
          <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !flow) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Flow not found</p>
            <p className="mt-1">
              We couldn't load{' '}
              <code className="font-mono text-xs">{metadataName}</code>. It may have been
              deleted or moved to another package.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const name = flow.name || metadataName;
  const status: string | undefined = flow.status;
  const isActive = status === 'active';
  const triggerType: string = flow.type || 'autolaunched';
  const TriggerIcon = TRIGGER_ICONS[triggerType] || Workflow;
  const triggerLabel = TRIGGER_LABELS[triggerType] || triggerType;

  const variables: any[] = Array.isArray(flow.variables) ? flow.variables : [];
  const nodes: any[] = Array.isArray(flow.nodes) ? flow.nodes : [];
  const edges: any[] = Array.isArray(flow.edges) ? flow.edges : [];

  return (
    <div className="space-y-4">
      {/* Compact strip — route header already shows label/name/type/description;
          here we just surface flow-specific status (version + enabled state). */}
      {(typeof flow.version === 'number' || isActive || status) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {typeof flow.version === 'number' && (
            <Badge variant="secondary" className="text-[10px] font-mono">v{flow.version}</Badge>
          )}
          {isActive ? (
            <Badge variant="outline" className="text-[10px] font-mono text-emerald-600 border-emerald-300 inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Enabled
            </Badge>
          ) : status ? (
            <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">{status}</Badge>
          ) : null}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="test">Test Run</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="raw">Raw JSON</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TriggerIcon className="h-4 w-4 text-muted-foreground" />
                Trigger
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Type:</span>
                <Badge variant="outline" className="text-[10px] font-mono">{triggerLabel}</Badge>
              </div>
              {flow.trigger && (
                <div className="mt-2">
                  <JsonTree data={flow.trigger} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Variables ({variables.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {variables.length === 0 ? (
                <p className="text-sm text-muted-foreground">No variables defined.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-center">Input</TableHead>
                      <TableHead className="text-center">Output</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variables.map((v, i) => (
                      <TableRow key={`${v.name}-${i}`}>
                        <TableCell className="font-mono text-xs">{v.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-mono">{v.type}</Badge>
                        </TableCell>
                        <TableCell className="text-center text-xs">{v.isInput ? '✓' : '—'}</TableCell>
                        <TableCell className="text-center text-xs">{v.isOutput ? '✓' : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nodes ({nodes.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {nodes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No nodes defined.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Label</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nodes.map((n, i) => (
                      <TableRow key={`${n.id}-${i}`}>
                        <TableCell className="font-mono text-xs">{n.id}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-mono">{n.type}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{resolveLabel(n.label) || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Edges ({edges.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {edges.length === 0 ? (
                <p className="text-sm text-muted-foreground">No edges defined.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>From → To</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Default</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {edges.map((e, i) => (
                      <TableRow key={`${e.id ?? i}`}>
                        <TableCell className="font-mono text-xs">
                          {e.source} <span className="text-muted-foreground">→</span> {e.target}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground break-all">
                          {(() => {
                            const c = e.condition;
                            if (c == null) return '—';
                            if (typeof c === 'string') return c;
                            if (typeof c === 'object' && 'source' in c) {
                              const src = (c as { source?: unknown }).source;
                              return typeof src === 'string' ? src : JSON.stringify(c);
                            }
                            return JSON.stringify(c);
                          })()}
                        </TableCell>
                        <TableCell className="text-xs">{e.isDefault ? '✓' : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Run */}
        <TabsContent value="test" className="mt-4">
          <FlowTestRunner
            flow={flow}
            onExecuted={() => setRefreshKey(k => k + 1)}
          />
        </TabsContent>

        {/* Runs */}
        <TabsContent value="runs" className="mt-4">
          <FlowRunsPanel flowName={name} refreshKey={refreshKey} />
        </TabsContent>

        {/* Raw JSON */}
        <TabsContent value="raw" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Raw Flow Definition</CardTitle>
            </CardHeader>
            <CardContent>
              <JsonTree data={flow} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
