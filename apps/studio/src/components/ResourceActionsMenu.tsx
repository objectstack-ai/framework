// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Resource Actions Menu — dropdown shown next to a resource title on detail
 * pages. Provides developer escape hatches:
 *
 *   • Copy as curl                — GET request snippet for the resource
 *   • Copy as fetch()             — JS fetch snippet
 *   • Copy as defineX() TS        — defineObject / defineView / defineFlow stub
 *   • Copy metadata JSON          — raw spec from the API
 *   • Open in VS Code             — vscode://… deep link (requires the
 *                                    vscode-objectstack extension)
 *   • Open API endpoint           — opens GET endpoint in a new tab
 *
 * Each entry is silent unless an error occurs (toast).
 */

import { useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import { useClient } from '@objectstack/client-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Copy, Code2, ExternalLink, Terminal, FileCode2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ResourceActionsMenuProps {
  type: string;
  name: string;
  packageId?: string;
}

function apiPathFor(type: string, name: string): string {
  if (type === 'object') return `/api/v1/data/${name}`;
  if (type === 'view' || type === 'form') return `/api/v1/forms/${name}`;
  return `/api/v1/meta/${type}/${name}`;
}

function defineFnFor(type: string): string | null {
  const map: Record<string, string> = {
    object: 'defineObject',
    view: 'defineView',
    flow: 'defineFlow',
    agent: 'defineAgent',
    tool: 'defineTool',
    app: 'defineApp',
    workflow: 'defineWorkflow',
    skill: 'defineSkill',
  };
  return map[type] ?? null;
}

async function copy(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast({ title: `Copied ${label}` });
  } catch {
    toast({ title: 'Clipboard unavailable', variant: 'destructive' as any });
  }
}

export function ResourceActionsMenu({
  type,
  name,
  packageId,
}: ResourceActionsMenuProps) {
  const client = useClient();
  const path = apiPathFor(type, name);
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const copyCurl = useCallback(() => {
    const snippet = `curl -X GET '${origin}${path}' \\\n  -H 'Content-Type: application/json'`;
    copy('curl', snippet);
  }, [origin, path]);

  const copyFetch = useCallback(() => {
    const snippet = `await fetch('${origin}${path}', {\n  headers: { 'Content-Type': 'application/json' },\n  credentials: 'include',\n}).then((r) => r.json());`;
    copy('fetch', snippet);
  }, [origin, path]);

  const copyDefineTs = useCallback(async () => {
    const fn = defineFnFor(type);
    if (!fn) {
      toast({ title: `No defineX() helper for type "${type}"`, variant: 'destructive' as any });
      return;
    }
    try {
      const it: any = await client.meta.getItem(type, name);
      const spec = it?.spec ?? it ?? {};
      const json = JSON.stringify(spec, null, 2);
      const snippet =
        `import { ${fn} } from '@objectstack/spec';\n\n` +
        `export const ${name} = ${fn}(\n${json
          .split('\n')
          .map((l) => '  ' + l)
          .join('\n')},\n);\n`;
      copy(`${fn}() TS`, snippet);
    } catch (e: any) {
      toast({ title: `Failed: ${e?.message ?? e}`, variant: 'destructive' as any });
    }
  }, [client, type, name]);

  const copyJson = useCallback(async () => {
    try {
      const it: any = await client.meta.getItem(type, name);
      copy('metadata JSON', JSON.stringify(it?.spec ?? it, null, 2));
    } catch (e: any) {
      toast({ title: `Failed: ${e?.message ?? e}`, variant: 'destructive' as any });
    }
  }, [client, type, name]);

  const openVsCode = useCallback(() => {
    // Deep-link format read by the vscode-objectstack extension. The
    // extension resolves the URI to the underlying .ts source file in the
    // current workspace.
    const uri = `vscode://objectstack.vscode-objectstack/open?type=${encodeURIComponent(
      type,
    )}&name=${encodeURIComponent(name)}${packageId ? `&package=${encodeURIComponent(packageId)}` : ''}`;
    window.location.href = uri;
  }, [type, name, packageId]);

  const openEndpoint = useCallback(() => {
    window.open(path, '_blank', 'noopener,noreferrer');
  }, [path]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" title="Resource actions">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link
            to="/$package/metadata/$type/$name"
            params={{ package: packageId ?? '', type, name }}
          >
            <FileCode2 className="h-3.5 w-3.5 mr-2" />
            View source
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Copy as…</DropdownMenuLabel>
        <DropdownMenuItem onClick={copyCurl}>
          <Terminal className="h-3.5 w-3.5 mr-2" />
          curl
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyFetch}>
          <Code2 className="h-3.5 w-3.5 mr-2" />
          fetch()
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyDefineTs}>
          <Code2 className="h-3.5 w-3.5 mr-2" />
          {defineFnFor(type) ?? 'defineX'}() TypeScript
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyJson}>
          <Copy className="h-3.5 w-3.5 mr-2" />
          Metadata JSON
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={openVsCode}>
          <ExternalLink className="h-3.5 w-3.5 mr-2" />
          Open in VS Code
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openEndpoint}>
          <ExternalLink className="h-3.5 w-3.5 mr-2" />
          Open API endpoint
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
