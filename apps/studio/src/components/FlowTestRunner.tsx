// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useMemo, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useClient } from '@objectstack/client-react';
import { useScopedClient } from '@/hooks/useObjectStackClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { JsonTree } from './MetadataInspector';

interface FlowVariable {
  name: string;
  type: string;
  isInput?: boolean;
  isOutput?: boolean;
}

interface FlowTestRunnerProps {
  flow: any;
  onExecuted?: () => void;
}

function coerce(value: string, type: string): unknown {
  switch (type) {
    case 'number':
      if (value === '') return undefined;
      const n = Number(value);
      return Number.isNaN(n) ? value : n;
    case 'boolean':
      return value === 'true';
    case 'object':
    case 'list':
    case 'array':
      if (value.trim() === '') return undefined;
      try { return JSON.parse(value); } catch { return value; }
    default:
      return value;
  }
}

export function FlowTestRunner({ flow, onExecuted }: FlowTestRunnerProps) {
  const params = useParams({ strict: false }) as { projectId?: string };
  const unscoped = useClient();
  const scoped = useScopedClient(params.projectId);
  const client: any = scoped ?? unscoped;

  const inputVars = useMemo<FlowVariable[]>(
    () => (flow?.variables ?? []).filter((v: FlowVariable) => v?.isInput),
    [flow],
  );

  const [values, setValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const setVal = (k: string, v: string) => setValues(s => ({ ...s, [k]: v }));

  const handleRun = async () => {
    if (!client?.automation?.execute) {
      setError('automation.execute is not available on this client');
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const params: Record<string, unknown> = {};
      for (const v of inputVars) {
        const raw = values[v.name];
        if (raw === undefined) continue;
        params[v.name] = coerce(raw, v.type);
      }
      const res = await client.automation.execute(flow.name, { params });
      setResult(res);
      onExecuted?.();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Inputs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {inputVars.length === 0 && (
            <p className="text-sm text-muted-foreground">
              This flow declares no input variables. Click Run to invoke with no parameters.
            </p>
          )}
          {inputVars.map(v => (
            <div key={v.name} className="grid gap-1.5">
              <Label htmlFor={`var-${v.name}`} className="flex items-center gap-2">
                <span className="font-mono text-xs">{v.name}</span>
                <Badge variant="outline" className="text-[10px] font-mono">{v.type}</Badge>
              </Label>
              {v.type === 'boolean' ? (
                <div className="flex items-center gap-2">
                  <Switch
                    id={`var-${v.name}`}
                    checked={values[v.name] === 'true'}
                    onCheckedChange={(c) => setVal(v.name, c ? 'true' : 'false')}
                  />
                  <span className="text-xs text-muted-foreground">{values[v.name] === 'true' ? 'true' : 'false'}</span>
                </div>
              ) : v.type === 'object' || v.type === 'list' || v.type === 'array' ? (
                <Textarea
                  id={`var-${v.name}`}
                  placeholder={`JSON ${v.type}`}
                  value={values[v.name] ?? ''}
                  onChange={(e) => setVal(v.name, e.target.value)}
                  className="font-mono text-xs min-h-[80px]"
                />
              ) : (
                <Input
                  id={`var-${v.name}`}
                  type={v.type === 'number' ? 'number' : 'text'}
                  value={values[v.name] ?? ''}
                  onChange={(e) => setVal(v.name, e.target.value)}
                />
              )}
            </div>
          ))}
          <div className="pt-1">
            <Button onClick={handleRun} disabled={running} size="sm">
              {running ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-2" />}
              {running ? 'Running…' : 'Run Flow'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {(result || error) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {error || result?.success === false ? (
                <><XCircle className="h-4 w-4 text-red-500" /> Failed</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Result</>
              )}
              {typeof result?.durationMs === 'number' && (
                <Badge variant="secondary" className="ml-2 text-[10px] font-mono">
                  {result.durationMs} ms
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && <p className="text-sm text-red-500 font-mono break-all">{error}</p>}
            {result && (
              <div className="text-sm">
                <JsonTree data={result} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
