// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Built-in Plugin: Tool Playground
 *
 * Interactive testing environment for AI tools.
 * Provides auto-generated parameter form, execution capability,
 * and history of executions with results/errors.
 *
 * Priority: 10 (higher than default inspector, lower than specialized designers)
 */

import { useState, useEffect, useRef } from 'react';
import { defineStudioPlugin } from '@objectstack/spec/studio';
import { useClient } from '@objectstack/client-react';
import { useParams } from '@tanstack/react-router';
import { useScopedClient } from '@/hooks/useObjectStackClient';
import type { StudioPlugin, MetadataViewerProps } from '../types';
import type { Tool } from '@objectstack/spec/ai';
import {
  Wrench, Play, Trash2, Loader2, CheckCircle2, XCircle,
  ChevronDown, ChevronRight, Clock, Copy, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/config';

// Storage key for tool playground history
const getToolStorageKey = (toolName: string) => `objectstack:tool-playground:${toolName}`;

/**
 * Tool execution history entry
 */
interface ExecutionEntry {
  id: string;
  timestamp: number;
  parameters: Record<string, any>;
  status: 'success' | 'error';
  result?: any;
  error?: string;
  duration?: number;
}

/**
 * JSON Schema property definition
 */
interface SchemaProperty {
  type?: string | string[];
  description?: string;
  enum?: any[];
  default?: any;
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
}

/**
 * Parse JSON Schema to extract form fields
 */
function parseSchema(schema: Record<string, any>): {
  properties: Record<string, SchemaProperty>;
  required: string[];
} {
  const properties = (schema.properties || {}) as Record<string, SchemaProperty>;
  const required = (schema.required || []) as string[];
  return { properties, required };
}

/**
 * Render form input for a schema property
 */
interface FormFieldProps {
  name: string;
  property: SchemaProperty;
  value: any;
  onChange: (value: any) => void;
  required: boolean;
}

function FormField({ name, property, value, onChange, required }: FormFieldProps) {
  const { type, description, enum: enumValues } = property;
  const displayName = name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // Handle enum (select dropdown)
  if (enumValues && enumValues.length > 0) {
    return (
      <div className="space-y-2">
        <Label htmlFor={name}>
          {displayName}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger id={name}>
            <SelectValue placeholder={`Select ${displayName}`} />
          </SelectTrigger>
          <SelectContent>
            {enumValues.map((opt) => (
              <SelectItem key={String(opt)} value={String(opt)}>
                {String(opt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Handle boolean (checkbox)
  if (type === 'boolean') {
    return (
      <div className="flex items-start space-x-2">
        <Checkbox
          id={name}
          checked={!!value}
          onCheckedChange={(checked) => onChange(checked)}
        />
        <div className="grid gap-1.5 leading-none">
          <Label htmlFor={name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {displayName}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
    );
  }

  // Handle number
  if (type === 'number' || type === 'integer') {
    return (
      <div className="space-y-2">
        <Label htmlFor={name}>
          {displayName}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        <Input
          id={name}
          type="number"
          value={value ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            onChange(val === '' ? undefined : type === 'integer' ? parseInt(val, 10) : parseFloat(val));
          }}
          placeholder={`Enter ${displayName}`}
        />
      </div>
    );
  }

  // Handle array (JSON textarea for now)
  if (type === 'array') {
    return (
      <div className="space-y-2">
        <Label htmlFor={name}>
          {displayName}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        <Textarea
          id={name}
          value={value ? JSON.stringify(value, null, 2) : ''}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              // Keep invalid JSON as string for now
            }
          }}
          placeholder={`Enter JSON array`}
          rows={3}
          className="font-mono text-xs"
        />
      </div>
    );
  }

  // Handle object (JSON textarea)
  if (type === 'object') {
    return (
      <div className="space-y-2">
        <Label htmlFor={name}>
          {displayName}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        <Textarea
          id={name}
          value={value ? JSON.stringify(value, null, 2) : ''}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              // Keep invalid JSON as string for now
            }
          }}
          placeholder={`Enter JSON object`}
          rows={4}
          className="font-mono text-xs"
        />
      </div>
    );
  }

  // Default: string (text or textarea based on description length)
  const isLongText = (description?.length || 0) > 100;
  if (isLongText) {
    return (
      <div className="space-y-2">
        <Label htmlFor={name}>
          {displayName}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        <Textarea
          id={name}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${displayName}`}
          rows={3}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {displayName}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <Input
        id={name}
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${displayName}`}
      />
    </div>
  );
}

/**
 * Execution History Item
 */
interface ExecutionItemProps {
  entry: ExecutionEntry;
}

function ExecutionItem({ entry }: ExecutionItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border rounded-md overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-muted transition-colors text-left"
      >
        <div className="flex items-center gap-2 text-xs">
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )}
          {entry.status === 'success' ? (
            <CheckCircle2 className="h-3 w-3 shrink-0 text-green-600 dark:text-green-400" />
          ) : (
            <XCircle className="h-3 w-3 shrink-0 text-destructive" />
          )}
          <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">
            {new Date(entry.timestamp).toLocaleTimeString()}
          </span>
          {entry.duration && (
            <span className="text-muted-foreground">
              ({entry.duration}ms)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {copied ? (
            <Check className="h-3 w-3 text-green-600" />
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(JSON.stringify(entry.status === 'success' ? entry.result : entry.error, null, 2));
                    }}
                    className="p-1 hover:bg-background rounded"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent><p>Copy result</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="px-3 py-2 border-t space-y-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Parameters:</p>
            <pre className="text-xs bg-background rounded p-2 overflow-auto max-h-32">
              {JSON.stringify(entry.parameters, null, 2)}
            </pre>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              {entry.status === 'success' ? 'Result:' : 'Error:'}
            </p>
            <pre className={cn(
              "text-xs rounded p-2 overflow-auto max-h-48",
              entry.status === 'success'
                ? "bg-green-500/10 text-green-700 dark:text-green-300"
                : "bg-destructive/10 text-destructive"
            )}>
              {entry.status === 'success'
                ? JSON.stringify(entry.result, null, 2)
                : entry.error}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Tool Playground Viewer Component
 */
function ToolPlaygroundViewer({ metadataType, metadataName, data, packageId }: MetadataViewerProps) {
  const unscopedClient = useClient();
  const params = useParams({ strict: false }) as { projectId?: string };
  const scopedClient = useScopedClient(params.projectId);
  const client: any = scopedClient ?? unscopedClient;
  const [tool, setTool] = useState<Tool | null>(data ?? null);
  const [loading, setLoading] = useState(!data);
  const [executing, setExecuting] = useState(false);
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [history, setHistory] = useState<ExecutionEntry[]>([]);
  const historyRef = useRef<HTMLDivElement>(null);
  const baseUrl = getApiBaseUrl();

  // Load tool metadata
  useEffect(() => {
    if (data) {
      setTool(data as Tool);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    async function load() {
      try {
        const result: any = await client.meta.getItem(metadataType, metadataName, packageId ? { packageId } : undefined);
        if (mounted) {
          setTool(result?.item || result);
        }
      } catch (err) {
        console.error(`[ToolPlayground] Failed to load tool ${metadataName}:`, err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [client, metadataType, metadataName, data, packageId]);

  // Load execution history
  useEffect(() => {
    try {
      const key = getToolStorageKey(metadataName);
      const stored = localStorage.getItem(key);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, [metadataName]);

  // Save history to localStorage
  const saveHistory = (entries: ExecutionEntry[]) => {
    try {
      const key = getToolStorageKey(metadataName);
      // Keep only last 50 entries
      const trimmed = entries.slice(-50);
      localStorage.setItem(key, JSON.stringify(trimmed));
      setHistory(trimmed);
    } catch {
      // ignore
    }
  };

  const clearHistory = () => {
    try {
      const key = getToolStorageKey(metadataName);
      localStorage.removeItem(key);
      setHistory([]);
    } catch {
      // ignore
    }
  };

  const executeTool = async () => {
    if (!tool || executing) return;

    setExecuting(true);
    const startTime = Date.now();
    const entryId = `exec-${Date.now()}`;

    try {
      // Call the tool via the AI service endpoint
      // This is a dry-run execution - we're testing the tool logic
      const response = await fetch(`${baseUrl}/api/v1/ai/tools/${metadataName}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ parameters }),
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        const entry: ExecutionEntry = {
          id: entryId,
          timestamp: Date.now(),
          parameters: { ...parameters },
          status: 'error',
          error: errorData.error || 'Tool execution failed',
          duration,
        };
        saveHistory([...history, entry]);
      } else {
        const result = await response.json();
        const entry: ExecutionEntry = {
          id: entryId,
          timestamp: Date.now(),
          parameters: { ...parameters },
          status: 'success',
          result: result.result || result,
          duration,
        };
        saveHistory([...history, entry]);
      }
    } catch (err) {
      const duration = Date.now() - startTime;
      const entry: ExecutionEntry = {
        id: entryId,
        timestamp: Date.now(),
        parameters: { ...parameters },
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
        duration,
      };
      saveHistory([...history, entry]);
    } finally {
      setExecuting(false);
    }
  };

  const resetForm = () => {
    setParameters({});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading tool...</span>
        </div>
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Wrench className="h-12 w-12 mx-auto mb-4 opacity-40" />
        <p className="text-sm">Tool not found: <code className="font-mono">{metadataName}</code></p>
      </div>
    );
  }

  const { properties, required } = parseSchema(tool.parameters);
  const propertyNames = Object.keys(properties);

  return (
    <div className="grid grid-cols-2 h-full divide-x">
      {/* Left Panel: Tool Info & Form */}
      <div className="flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 border-b bg-background px-4 py-3">
          <div className="flex items-center gap-3">
            <Wrench className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-sm font-semibold">{tool.label}</h2>
              <p className="text-xs text-muted-foreground">{tool.category || 'Tool'}</p>
            </div>
          </div>
          {tool.description && (
            <p className="mt-2 text-xs text-muted-foreground">{tool.description}</p>
          )}
        </div>

        {/* Parameter Form */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-3">Parameters</h3>
              {propertyNames.length === 0 ? (
                <p className="text-xs text-muted-foreground">This tool has no parameters.</p>
              ) : (
                <div className="space-y-4">
                  {propertyNames.map((name) => (
                    <FormField
                      key={name}
                      name={name}
                      property={properties[name]}
                      value={parameters[name]}
                      onChange={(value) => setParameters({ ...parameters, [name]: value })}
                      required={required.includes(name)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Action Buttons */}
        <div className="shrink-0 border-t p-4 flex gap-2">
          <Button
            onClick={executeTool}
            disabled={executing}
            className="flex-1"
          >
            {executing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Execute Tool
              </>
            )}
          </Button>
          <Button variant="outline" onClick={resetForm}>
            Reset
          </Button>
        </div>
      </div>

      {/* Right Panel: Execution History */}
      <div className="flex flex-col overflow-hidden">
        <div className="shrink-0 border-b bg-background px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-medium">Execution History</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={clearHistory}
                  disabled={history.length === 0}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Clear history</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <ScrollArea className="flex-1">
          <div ref={historyRef} className="p-4 space-y-2">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Clock className="h-8 w-8 opacity-40 mb-2" />
                <p className="text-sm">No executions yet</p>
                <p className="text-xs opacity-60">Execute the tool to see results here</p>
              </div>
            ) : (
              history.slice().reverse().map((entry) => (
                <ExecutionItem key={entry.id} entry={entry} />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// ─── Plugin Definition ───────────────────────────────────────────────

export const toolPlaygroundPlugin: StudioPlugin = {
  manifest: defineStudioPlugin({
    id: 'objectstack.tool-playground',
    name: 'Tool Playground',
    version: '1.0.0',
    description: 'Interactive testing environment for AI tools with auto-generated parameter forms.',
    contributes: {
      metadataViewers: [
        {
          id: 'tool-playground',
          metadataTypes: ['tool'],
          label: 'Playground',
          priority: 10,
          modes: ['preview'],
        },
      ],
    },
  }),

  activate(api) {
    api.registerViewer('tool-playground', ToolPlaygroundViewer);
  },
};
