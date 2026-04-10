// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code2, Copy, Check, Database, Layout, Workflow, Bot, AppWindow, Wrench } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────

type ExportType = 'object' | 'view' | 'flow' | 'agent' | 'tool' | 'app';

export interface CodeExporterProps {
  type: ExportType;
  definition: Record<string, unknown>;
  name?: string;
}

// ─── Constants ──────────────────────────────────────────────────────

const TYPE_LABELS: Record<ExportType, { label: string; icon: React.ElementType }> = {
  object: { label: 'Object', icon: Database },
  view: { label: 'View', icon: Layout },
  flow: { label: 'Flow', icon: Workflow },
  agent: { label: 'Agent', icon: Bot },
  tool: { label: 'Tool', icon: Wrench },
  app: { label: 'App', icon: AppWindow },
};

// ─── Code Generators ────────────────────────────────────────────────

function indent(str: string, level: number): string {
  const spaces = '  '.repeat(level);
  return str
    .split('\n')
    .map((line) => (line.trim() ? spaces + line : line))
    .join('\n');
}

function formatValue(value: unknown, depth: number = 0): string {
  if (value === null || value === undefined) return 'undefined';
  if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((v) => formatValue(v, depth + 1));
    if (items.join(', ').length < 60) return `[${items.join(', ')}]`;
    return `[\n${items.map((item) => indent(item, depth + 1)).join(',\n')}\n${indent(']', depth)}`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const lines = entries.map(
      ([key, val]) => `${indent(`${key}: ${formatValue(val, depth + 1)}`, depth + 1)}`
    );
    if (lines.join(', ').length < 60 && !lines.some((l) => l.includes('\n'))) {
      const compact = entries.map(([k, v]) => `${k}: ${formatValue(v, depth + 1)}`).join(', ');
      return `{ ${compact} }`;
    }
    return `{\n${lines.join(',\n')}\n${indent('}', depth)}`;
  }

  return String(value);
}

function generateObjectCode(def: Record<string, unknown>, name?: string): string {
  const objName = name || (def.name as string) || 'my_object';
  const lines = [
    "import { defineStack } from '@objectstack/spec';",
    '',
    'export default defineStack({',
    '  objects: {',
    `    ${objName}: ${formatValue(def, 2)},`,
    '  },',
    '});',
  ];
  return lines.join('\n');
}

function generateViewCode(def: Record<string, unknown>, name?: string): string {
  const viewName = name || (def.name as string) || 'my_view';
  const lines = [
    "import { defineStack } from '@objectstack/spec';",
    '',
    'export default defineStack({',
    '  views: {',
    `    ${viewName}: ${formatValue(def, 2)},`,
    '  },',
    '});',
  ];
  return lines.join('\n');
}

function generateFlowCode(def: Record<string, unknown>, name?: string): string {
  const flowName = name || (def.name as string) || 'my_flow';
  const lines = [
    "import { defineStack } from '@objectstack/spec';",
    '',
    'export default defineStack({',
    '  flows: {',
    `    ${flowName}: ${formatValue(def, 2)},`,
    '  },',
    '});',
  ];
  return lines.join('\n');
}

function generateAgentCode(def: Record<string, unknown>, name?: string): string {
  const agentName = name || (def.name as string) || 'my_agent';
  const lines = [
    "import { defineStack } from '@objectstack/spec';",
    '',
    'export default defineStack({',
    '  agents: {',
    `    ${agentName}: ${formatValue(def, 2)},`,
    '  },',
    '});',
  ];
  return lines.join('\n');
}

function generateAppCode(def: Record<string, unknown>, name?: string): string {
  const appName = name || (def.name as string) || 'my_app';
  const lines = [
    "import { defineStack } from '@objectstack/spec';",
    '',
    'export default defineStack({',
    '  apps: {',
    `    ${appName}: ${formatValue(def, 2)},`,
    '  },',
    '});',
  ];
  return lines.join('\n');
}

function generateToolCode(def: Record<string, unknown>, name?: string): string {
  const toolName = name || (def.name as string) || 'my_tool';
  const lines = [
    "import { defineStack } from '@objectstack/spec';",
    '',
    'export default defineStack({',
    '  tools: {',
    `    ${toolName}: ${formatValue(def, 2)},`,
    '  },',
    '});',
  ];
  return lines.join('\n');
}

const CODE_GENERATORS: Record<ExportType, (def: Record<string, unknown>, name?: string) => string> = {
  object: generateObjectCode,
  view: generateViewCode,
  flow: generateFlowCode,
  agent: generateAgentCode,
  tool: generateToolCode,
  app: generateAppCode,
};

// ─── Component ──────────────────────────────────────────────────────

export function CodeExporter({ type, definition, name }: CodeExporterProps) {
  const [format, setFormat] = useState<'typescript' | 'json'>('typescript');
  const [copied, setCopied] = useState(false);

  const tsCode = useMemo(() => {
    const generator = CODE_GENERATORS[type];
    return generator ? generator(definition, name) : '// Unknown export type';
  }, [type, definition, name]);

  const jsonCode = useMemo(() => JSON.stringify(definition, null, 2), [definition]);

  const displayCode = format === 'typescript' ? tsCode : jsonCode;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(displayCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [displayCode]);

  const TypeIcon = TYPE_LABELS[type]?.icon ?? Code2;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              Export as Code
            </CardTitle>
            <CardDescription className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] gap-1">
                <TypeIcon className="h-3 w-3" />
                {TYPE_LABELS[type]?.label ?? type}
              </Badge>
              {name && (
                <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">{name}</code>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={format} onValueChange={(v) => setFormat(v as 'typescript' | 'json')}>
              <TabsList className="h-7">
                <TabsTrigger value="typescript" className="text-xs px-2 py-0.5">TypeScript</TabsTrigger>
                <TabsTrigger value="json" className="text-xs px-2 py-0.5">JSON</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" onClick={handleCopy} className="h-7 gap-1 text-xs">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <pre className="overflow-auto p-4 text-xs font-mono bg-muted/30 rounded-b-lg whitespace-pre max-h-[60vh]">
          <code>{displayCode}</code>
        </pre>
      </CardContent>
    </Card>
  );
}

export default CodeExporter;
