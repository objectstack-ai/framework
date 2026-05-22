// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Inspector Drawer — fixed right-side panel that surfaces "everything I
 * need to know about the resource I'm currently editing".
 *
 * Tabs:
 *   • API     — REST URL, sample curl, sample fetch for this resource.
 *   • Source  — raw metadata JSON, copy-to-clipboard.
 *   • Refs    — list of other metadata items that reference this one.
 *
 * Toggle with `]` (handled by useStudioHotkeys) or the toolbar button.
 * When no target is set the drawer shows a hint message.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useClient } from '@objectstack/client-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, RefreshCw, ExternalLink, Code2, History as HistoryIcon } from 'lucide-react';
import { useInspector } from '@/hooks/useInspector';
import { toast } from '@/hooks/use-toast';

interface RefHit {
  type: string;
  name: string;
  packageId?: string;
  reason: string;
}

interface HistoryEvent {
  seq: number;
  op: string;
  ref: { org?: string; type: string; name: string };
  hash: string | null;
  parentHash: string | null;
  actor: string;
  message?: string;
  ts: string;
  source: string;
}

function apiPathFor(type: string, name: string): string {
  if (type === 'object') return `/api/v1/data/${name}`;
  if (type === 'view' || type === 'form') return `/api/v1/forms/${name}`;
  return `/api/v1/meta/${type}/${name}`;
}

function curlFor(method: string, path: string, body?: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const lines = [`curl -X ${method} '${base}${path}' \\`, `  -H 'Content-Type: application/json'`];
  if (body) lines.push(`  -d '${body}'`);
  return lines.join('\n');
}

async function copy(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast({ title: `Copied ${label}` });
  } catch {
    toast({ title: 'Clipboard unavailable', variant: 'destructive' as any });
  }
}

export function InspectorDrawer() {
  const { target, open, setOpen } = useInspector();
  const client = useClient();
  const [tab, setTab] = useState('api');
  const [source, setSource] = useState<string>('');
  const [refs, setRefs] = useState<RefHit[] | null>(null);
  const [history, setHistory] = useState<HistoryEvent[] | null>(null);
  const [loading, setLoading] = useState(false);

  const apiPath = target ? apiPathFor(target.type, target.name) : '';

  // Load source when target/tab changes.
  useEffect(() => {
    if (!target || !open || tab !== 'source') return;
    setLoading(true);
    client.meta
      .getItem(target.type, target.name)
      .then((it: any) => setSource(JSON.stringify(it?.spec ?? it, null, 2)))
      .catch((e: any) => setSource(`// failed to load: ${e?.message ?? e}`))
      .finally(() => setLoading(false));
  }, [target?.type, target?.name, tab, open, client]);

  // Load refs when target/tab changes.
  useEffect(() => {
    if (!target || !open || tab !== 'refs') return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const out: RefHit[] = [];
      const fetchType = async (t: string): Promise<any[]> => {
        try {
          const r: any = await client.meta.getItems(t);
          if (Array.isArray(r)) return r;
          if (Array.isArray(r?.items)) return r.items;
          return [];
        } catch {
          return [];
        }
      };
      if (target.type === 'object') {
        const [views, hooks, flows] = await Promise.all([
          fetchType('view'),
          fetchType('hook'),
          fetchType('flow'),
        ]);
        for (const it of views) {
          const spec = it?.spec ?? it;
          if (spec?.object === target.name) {
            out.push({
              type: 'view',
              name: spec?.name ?? it?.name,
              packageId: it?.packageId,
              reason: `view.object = "${target.name}"`,
            });
          }
        }
        for (const it of hooks) {
          const spec = it?.spec ?? it;
          if (spec?.object === target.name) {
            out.push({
              type: 'hook',
              name: spec?.name ?? it?.name,
              packageId: it?.packageId,
              reason: `hook.object = "${target.name}"`,
            });
          }
        }
        for (const it of flows) {
          const spec = it?.spec ?? it;
          if (spec?.trigger?.object === target.name) {
            out.push({
              type: 'flow',
              name: spec?.name ?? it?.name,
              packageId: it?.packageId,
              reason: `flow.trigger.object = "${target.name}"`,
            });
          }
        }
      }
      if (!cancelled) {
        setRefs(out);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target?.type, target?.name, tab, open, client]);

  // Load history when target/tab changes — calls the durable change-log
  // endpoint backed by sys_metadata_history (M1).
  useEffect(() => {
    if (!target || !open || tab !== 'history') return;
    if (history !== null) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const result: any = await (client.meta as any).getHistory(target.type, target.name);
        if (!cancelled) setHistory(Array.isArray(result?.events) ? result.events : []);
      } catch (e: any) {
        if (!cancelled) {
          toast({
            title: 'Failed to load history',
            description: e?.message ?? String(e),
            variant: 'destructive',
          });
          setHistory([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target?.type, target?.name, tab, open, client, history]);

  // Reset history cache when target changes so we re-fetch on switch.
  useEffect(() => {
    setHistory(null);
  }, [target?.type, target?.name]);

  const sampleBody = useMemo(() => {
    if (!target) return '';
    if (target.type === 'object') return '{ "name": "Sample" }';
    return '';
  }, [target]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg flex flex-col p-0"
      >
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="text-base flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            Inspector
            {target && (
              <>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {target.type}
                </Badge>
                <span className="font-mono text-sm text-foreground">{target.name}</span>
              </>
            )}
          </SheetTitle>
          <SheetDescription>
            {target
              ? 'API, source, and references for the resource you\u2019re editing.'
              : 'Open a resource detail page to populate the inspector.'}
          </SheetDescription>
        </SheetHeader>

        {!target && (
          <div className="flex-1 flex items-center justify-center p-8 text-sm text-muted-foreground text-center">
            Navigate to an Object, View, Flow, or other metadata detail page
            and the Inspector will show its API, source, and references here.
            <br />
            <br />
            Toggle anytime with <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">]</kbd>.
          </div>
        )}

        {target && (
          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
            <div className="px-4 pt-3">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="api">API</TabsTrigger>
                <TabsTrigger value="source">Source</TabsTrigger>
                <TabsTrigger value="refs">Refs</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
              <TabsContent value="api" className="m-0 space-y-3">
                <Section title="Endpoint">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono flex-1 break-all bg-muted px-2 py-1.5 rounded">
                      {apiPath}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copy('endpoint', apiPath)}
                      title="Copy"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Section>

                <Section title="Sample curl (GET)">
                  <PreBlock value={curlFor('GET', apiPath)} />
                </Section>

                {target.type === 'object' && (
                  <Section title="Sample curl (POST)">
                    <PreBlock value={curlFor('POST', apiPath, sampleBody)} />
                  </Section>
                )}

                {(target.type === 'view' || target.type === 'form') && (
                  <Section title="Sample curl (submit)">
                    <PreBlock value={curlFor('POST', apiPath, '{}')} />
                  </Section>
                )}
              </TabsContent>

              <TabsContent value="source" className="m-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Raw metadata JSON</span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copy('source JSON', source)}
                      disabled={!source}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {loading ? (
                  <div className="text-xs text-muted-foreground">Loading…</div>
                ) : (
                  <PreBlock value={source || '(empty)'} multiline />
                )}
              </TabsContent>

              <TabsContent value="refs" className="m-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">
                    Other metadata that references this resource
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRefs(null)}
                    title="Refresh"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {loading && <div className="text-xs text-muted-foreground">Scanning…</div>}
                {!loading && refs && refs.length === 0 && (
                  <div className="text-xs text-muted-foreground rounded border border-dashed p-4 text-center">
                    No references found.
                  </div>
                )}
                {!loading && refs && refs.length > 0 && (
                  <ul className="space-y-1.5">
                    {refs.map((r) => (
                      <li
                        key={`${r.type}:${r.name}`}
                        className="flex items-center justify-between gap-2 rounded border px-2 py-1.5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {r.type}
                          </Badge>
                          <code className="text-xs truncate">{r.name}</code>
                        </div>
                        {r.packageId && (
                          <Link
                            to="/$package/metadata/$type/$name"
                            params={{
                              package: r.packageId,
                              type: r.type,
                              name: r.name,
                            }}
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => setOpen(false)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {target.type !== 'object' && !loading && (
                  <p className="text-[10px] text-muted-foreground mt-3">
                    Ref scanning currently runs for objects. View/flow/agent refs
                    coming soon.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="history" className="m-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">
                    Durable change log (sys_metadata_history)
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setHistory(null)}
                    title="Refresh"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
                {!loading && history && history.length === 0 && (
                  <div className="text-xs text-muted-foreground rounded border border-dashed p-4 text-center">
                    No history yet — this item has no overlay changes recorded.
                    {!isOverlayType(target.type) && (
                      <div className="mt-2 text-[10px]">
                        ({target.type} is not an overlay-tracked metadata type.)
                      </div>
                    )}
                  </div>
                )}
                {!loading && history && history.length > 0 && (
                  <ol className="space-y-2 relative before:absolute before:left-[7px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-border">
                    {history.slice().reverse().map((ev) => (
                      <li key={ev.seq} className="relative pl-6">
                        <span
                          className={`absolute left-0 top-1.5 inline-block h-3.5 w-3.5 rounded-full border-2 border-background ${opColor(ev.op)}`}
                          aria-hidden
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-mono text-[10px] uppercase">
                            {ev.op}
                          </Badge>
                          <span className="text-xs font-mono text-muted-foreground">
                            #{ev.seq}
                          </span>
                          <span className="text-xs">{ev.actor}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {formatRelative(ev.ts)}
                          </span>
                        </div>
                        {ev.message && (
                          <div className="text-xs mt-1 italic text-foreground">{ev.message}</div>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-1 font-mono break-all">
                          {ev.hash ? (
                            <span title={ev.hash}>{ev.hash.slice(0, 17)}…</span>
                          ) : (
                            <span className="opacity-60">∅ (tombstone)</span>
                          )}
                          {ev.parentHash && (
                            <>
                              <span className="mx-1">←</span>
                              <span title={ev.parentHash}>{ev.parentHash.slice(0, 17)}…</span>
                            </>
                          )}
                          <span className="ml-2">via {ev.source}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                {!loading && history === null && (
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <HistoryIcon className="h-3.5 w-3.5" /> Loading history…
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
        {title}
      </div>
      {children}
    </div>
  );
}

function PreBlock({ value, multiline }: { value: string; multiline?: boolean }) {
  return (
    <pre
      className={`text-xs font-mono bg-muted rounded p-2 overflow-auto ${
        multiline ? 'max-h-[50vh]' : 'max-h-32'
      } whitespace-pre`}
    >
      {value}
    </pre>
  );
}

const OVERLAY_TYPES = new Set(['view', 'dashboard', 'report', 'email_template']);
function isOverlayType(type: string): boolean {
  const t = type.endsWith('s') ? type.slice(0, -1) : type;
  return OVERLAY_TYPES.has(t) || OVERLAY_TYPES.has(type);
}

function opColor(op: string): string {
  switch (op) {
    case 'create': return 'bg-emerald-500';
    case 'update': return 'bg-sky-500';
    case 'delete': return 'bg-rose-500';
    case 'publish': return 'bg-violet-500';
    case 'revert': return 'bg-amber-500';
    default: return 'bg-muted-foreground';
  }
}

function formatRelative(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffSec = Math.round((now - then) / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.round(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}
