// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useEffect, useState, useCallback } from 'react';
import { useParams } from '@tanstack/react-router';
import { useClient } from '@objectstack/client-react';
import { useScopedClient } from '@/hooks/useObjectStackClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Loader2, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { JsonTree } from './MetadataInspector';

interface FlowRunsPanelProps {
  flowName: string;
  refreshKey?: number;
}

interface RunSummary {
  id: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  flowVersion?: number;
  trigger?: { type?: string };
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any; cls: string }> = {
    success:   { variant: 'outline', icon: CheckCircle2, cls: 'text-emerald-600 border-emerald-300' },
    completed: { variant: 'outline', icon: CheckCircle2, cls: 'text-emerald-600 border-emerald-300' },
    failed:    { variant: 'outline', icon: XCircle,      cls: 'text-red-600 border-red-300' },
    error:     { variant: 'outline', icon: XCircle,      cls: 'text-red-600 border-red-300' },
    running:   { variant: 'outline', icon: Loader2,      cls: 'text-blue-600 border-blue-300 animate-pulse' },
    pending:   { variant: 'outline', icon: Clock,        cls: 'text-amber-600 border-amber-300' },
    skipped:   { variant: 'outline', icon: AlertCircle,  cls: 'text-muted-foreground' },
  };
  const cfg = map[status] ?? { variant: 'outline' as const, icon: AlertCircle, cls: 'text-muted-foreground' };
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className={`text-[10px] font-mono inline-flex items-center gap-1 ${cfg.cls}`}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}

function fmtDate(s?: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

export function FlowRunsPanel({ flowName, refreshKey }: FlowRunsPanelProps) {
  const params = useParams({ strict: false }) as { projectId?: string };
  const unscoped = useClient();
  const scoped = useScopedClient(params.projectId);
  const client: any = scoped ?? unscoped;

  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    if (!client?.automation?.listRuns) {
      setError('automation.listRuns is not available on this client');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res: any = await client.automation.listRuns(flowName, { limit: 20 });
      const items: RunSummary[] = Array.isArray(res) ? res : (res?.items ?? res?.runs ?? []);
      setRuns(items);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [client, flowName]);

  useEffect(() => { loadRuns(); }, [loadRuns, refreshKey]);

  const openRun = async (runId: string) => {
    setOpenRunId(runId);
    setRunDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res: any = await client.automation.getRun(flowName, runId);
      setRunDetail(res?.run ?? res);
    } catch (e: any) {
      setDetailError(e?.message ?? String(e));
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Runs</CardTitle>
            <Button variant="outline" size="sm" onClick={loadRuns} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          )}
          {!loading && error && (
            <p className="text-sm text-red-500 font-mono break-all">{error}</p>
          )}
          {!loading && !error && runs.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No runs yet. Use the Test Run tab to invoke this flow.
            </p>
          )}
          {!loading && !error && runs.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map(r => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => openRun(r.id)}
                  >
                    <TableCell className="font-mono text-xs">{r.id.slice(0, 12)}…</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(r.startedAt)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {typeof r.durationMs === 'number' ? `${r.durationMs} ms` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!openRunId} onOpenChange={(o) => { if (!o) { setOpenRunId(null); setRunDetail(null); } }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="font-mono text-sm break-all">Run {openRunId}</SheetTitle>
            <SheetDescription>
              {runDetail && (
                <span className="inline-flex items-center gap-2">
                  <StatusBadge status={runDetail.status} />
                  {typeof runDetail.durationMs === 'number' && (
                    <Badge variant="secondary" className="text-[10px] font-mono">{runDetail.durationMs} ms</Badge>
                  )}
                  <span className="text-xs">{fmtDate(runDetail.startedAt)}</span>
                </span>
              )}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 p-4">
            {detailLoading && (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            )}
            {detailError && (
              <p className="text-sm text-red-500 font-mono break-all">{detailError}</p>
            )}
            {!detailLoading && runDetail && (
              <div className="space-y-3">
                {Array.isArray(runDetail.steps) && runDetail.steps.length > 0 ? (
                  runDetail.steps.map((step: any, idx: number) => (
                    <div key={`${step.nodeId}-${idx}`} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-muted-foreground font-mono text-xs">#{idx + 1}</span>
                        <span className="font-mono text-sm font-medium">{step.nodeLabel || step.nodeId}</span>
                        {step.nodeType && (
                          <Badge variant="outline" className="text-[10px] font-mono">{step.nodeType}</Badge>
                        )}
                        <StatusBadge status={step.status} />
                        {typeof step.durationMs === 'number' && (
                          <Badge variant="secondary" className="text-[10px] font-mono ml-auto">
                            {step.durationMs} ms
                          </Badge>
                        )}
                      </div>
                      {step.input !== undefined && (
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground mb-1">Input</div>
                          <JsonTree data={step.input} />
                        </div>
                      )}
                      {step.output !== undefined && (
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground mb-1">Output</div>
                          <JsonTree data={step.output} />
                        </div>
                      )}
                      {step.error && (
                        <div>
                          <div className="text-[10px] uppercase text-red-500 mb-1">Error</div>
                          <JsonTree data={step.error} />
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground mb-1">Run</div>
                    <JsonTree data={runDetail} />
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
