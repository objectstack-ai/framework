// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * AddFieldDialog — guided "+ Add field" flow.
 *
 * ObjectStack is metadata-as-code: field definitions live in the
 * `.object.ts` source file under examples/<app>/src/objects/. The dialog
 * therefore doesn't write to the filesystem from the browser. Instead it
 * generates a snippet for the chosen field type, lets the user copy it,
 * and offers a deep-link to open the source file in VS Code.
 *
 * This is the smallest meaningful step toward a builder experience that
 * stays true to Prime Directive #6 (no temporary workarounds). When the
 * runtime overlay write-path is mature, we can swap the snippet flow for
 * a real persist call without touching the dialog's contract.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Type, FileText, Hash, ToggleLeft, List, Link as LinkIcon, Calculator,
  Calendar, Mail, Phone, MapPin, Braces, DollarSign, Percent, Clock,
  ExternalLink, Copy, Check, FilePlus,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface AddFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectName: string;
  packageId?: string;
}

interface FieldTypeOption {
  type: string;
  label: string;
  icon: React.ElementType;
  description: string;
  /**
   * Type-specific extra props as a list of `key: value` lines that
   * appear between `label` and the closing brace of the inner object
   * literal. e.g. `["type: 'text'", "maxLength: 255"]`.
   * Keeping the props structured lets us emit both the file-level
   * snippet (for clipboard) AND the bare initializer (for the
   * field-add endpoint) without string surgery.
   */
  extraProps: (name: string, label: string) => string[];
}

const FIELD_TYPES: FieldTypeOption[] = [
  { type: 'text', label: 'Single-line text', icon: Type, description: 'Short string up to 255 chars',
    extraProps: () => ["type: 'text'", 'maxLength: 255'] },
  { type: 'longtext', label: 'Long text', icon: FileText, description: 'Multi-paragraph text, no length cap',
    extraProps: () => ["type: 'longtext'"] },
  { type: 'number', label: 'Number', icon: Hash, description: 'Integer or decimal',
    extraProps: () => ["type: 'number'"] },
  { type: 'currency', label: 'Currency', icon: DollarSign, description: 'Monetary amount (locale-aware)',
    extraProps: () => ["type: 'currency'"] },
  { type: 'percent', label: 'Percent', icon: Percent, description: '0–100 with % display',
    extraProps: () => ["type: 'percent'"] },
  { type: 'boolean', label: 'Boolean', icon: ToggleLeft, description: 'true / false toggle',
    extraProps: () => ["type: 'boolean'", 'defaultValue: false'] },
  { type: 'select', label: 'Single-select', icon: List, description: 'Pick one from a fixed option list',
    extraProps: () => ["type: 'select'", "options: [{ value: 'option_a', label: 'Option A' }, { value: 'option_b', label: 'Option B' }]"] },
  { type: 'multiselect', label: 'Multi-select', icon: List, description: 'Pick many from a fixed option list',
    extraProps: () => ["type: 'multiselect'", "options: [{ value: 'tag_a', label: 'Tag A' }, { value: 'tag_b', label: 'Tag B' }]"] },
  { type: 'lookup', label: 'Lookup / Reference', icon: LinkIcon, description: 'Link to another object',
    extraProps: () => ["type: 'lookup'", "reference: 'TARGET_OBJECT_NAME'"] },
  { type: 'formula', label: 'Formula', icon: Calculator, description: 'Computed value (CEL expression)',
    extraProps: () => ["type: 'formula'", "formula: '// CEL expression'"] },
  { type: 'date', label: 'Date', icon: Calendar, description: 'Day, no time component',
    extraProps: () => ["type: 'date'"] },
  { type: 'datetime', label: 'Date & time', icon: Calendar, description: 'Instant with timezone',
    extraProps: () => ["type: 'datetime'"] },
  { type: 'time', label: 'Time', icon: Clock, description: 'Clock time, no date',
    extraProps: () => ["type: 'time'"] },
  { type: 'email', label: 'Email', icon: Mail, description: 'Validated email address',
    extraProps: () => ["type: 'email'"] },
  { type: 'phone', label: 'Phone', icon: Phone, description: 'Phone number (free-form)',
    extraProps: () => ["type: 'phone'"] },
  { type: 'url', label: 'URL', icon: LinkIcon, description: 'Validated http(s) URL',
    extraProps: () => ["type: 'url'"] },
  { type: 'address', label: 'Address', icon: MapPin, description: 'Structured postal address',
    extraProps: () => ["type: 'address'"] },
  { type: 'json', label: 'JSON', icon: Braces, description: 'Arbitrary JSON blob',
    extraProps: () => ["type: 'json'"] },
];

/** Build the file-level snippet (what users copy + paste). */
function buildSnippet(opt: FieldTypeOption, name: string, label: string): string {
  const props = [`name: '${name}'`, `label: '${label}'`, ...opt.extraProps(name, label)];
  const indent = '  ';
  return `${indent}${name}: {\n${props.map((p) => `${indent}  ${p}`).join(',\n')},\n${indent}},`;
}

/** Build just the right-hand-side initializer (for the field-add endpoint). */
function buildInitializer(opt: FieldTypeOption, name: string, label: string): string {
  const props = [`name: '${name}'`, `label: '${label}'`, ...opt.extraProps(name, label)];
  return `{ ${props.join(', ')} }`;
}

function toSnakeCase(s: string): string {
  return s
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

export function AddFieldDialog({ open, onOpenChange, objectName, packageId }: AddFieldDialogProps) {
  const [selectedType, setSelectedType] = useState<string>('text');
  const [fieldLabel, setFieldLabel] = useState<string>('New field');
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [srcRoot, setSrcRoot] = useState<string | null>(null);

  const fieldName = useMemo(() => toSnakeCase(fieldLabel) || 'new_field', [fieldLabel]);

  const selected = FIELD_TYPES.find(t => t.type === selectedType) || FIELD_TYPES[0];
  const snippet = useMemo(
    () => buildSnippet(selected, fieldName, fieldLabel || 'New field'),
    [selected, fieldName, fieldLabel],
  );
  const initializer = useMemo(
    () => buildInitializer(selected, fieldName, fieldLabel || 'New field'),
    [selected, fieldName, fieldLabel],
  );

  // Probe the dev write API for the on-disk source root. Same shape as
  // CreateMetadataDialog — when 404'd, falls back to copy-only flow.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const url = packageId
          ? `/_studio/api/metadata/layout?package=${encodeURIComponent(packageId)}`
          : '/_studio/api/metadata/layout';
        const resp = await fetch(url);
        if (!resp.ok) { if (!cancelled) setSrcRoot(null); return; }
        const data = await resp.json().catch(() => null);
        if (!cancelled) setSrcRoot(data?.srcRoot ?? null);
      } catch { if (!cancelled) setSrcRoot(null); }
    })();
    return () => { cancelled = true; };
  }, [open, packageId]);

  // Canonical path of the host object's source file — convention is
  // `<srcRoot>/objects/<object_name>.object.ts`.
  const objectFilePath = useMemo(() => {
    if (!srcRoot) return null;
    return `${srcRoot}/objects/${objectName}.object.ts`;
  }, [srcRoot, objectName]);

  const copySnippet = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast({ title: `Copied ${fieldName} snippet` });
    } catch {
      toast({ title: 'Clipboard unavailable', variant: 'destructive' as any });
    }
  }, [snippet, fieldName]);

  const createOnDisk = useCallback(async () => {
    if (!objectFilePath) return;
    setCreating(true);
    try {
      const resp = await fetch('/_studio/api/metadata/field-add', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: objectFilePath, fieldName, initializer }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) {
        if (resp.status === 409) {
          toast({
            title: 'Field already exists',
            description: `\`${fieldName}\` is already defined on ${objectName}.`,
            variant: 'destructive' as any,
          });
        } else if (resp.status === 404) {
          toast({
            title: 'Object source not found',
            description: `Expected ${objectFilePath} — open it in your editor and paste manually.`,
            variant: 'destructive' as any,
          });
        } else {
          toast({
            title: 'Add failed',
            description: data?.error ?? `HTTP ${resp.status}`,
            variant: 'destructive' as any,
          });
        }
        return;
      }
      toast({
        title: 'Field added',
        description: `${fieldName} appended to ${objectName} — HMR will reload shortly.`,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Add failed', description: err?.message ?? String(err), variant: 'destructive' as any });
    } finally {
      setCreating(false);
    }
  }, [objectFilePath, fieldName, initializer, objectName, onOpenChange]);

  const openVsCode = useCallback(() => {
    const uri = `vscode://objectstack.vscode-objectstack/open?type=object&name=${encodeURIComponent(objectName)}${packageId ? `&package=${encodeURIComponent(packageId)}` : ''}`;
    window.location.href = uri;
  }, [objectName, packageId]);

  const canCreate = !!objectFilePath;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Add field to <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{objectName}</code>
          </DialogTitle>
          <DialogDescription>
            ObjectStack is metadata-as-code. Pick a type, copy the snippet, paste into your <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">.object.ts</code> file. HMR reloads Studio in &lt; 1 s.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="field-label" className="text-xs">Display label</Label>
              <Input
                id="field-label"
                value={fieldLabel}
                onChange={e => setFieldLabel(e.target.value)}
                placeholder="e.g. Customer name"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Machine name <span className="text-muted-foreground">(snake_case, derived)</span></Label>
              <code className="block h-8 rounded border bg-muted/30 px-2 py-1.5 font-mono text-sm">{fieldName}</code>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Field type</Label>
            <div className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto rounded border p-2 sm:grid-cols-3">
              {FIELD_TYPES.map(t => {
                const Icon = t.icon;
                const active = selectedType === t.type;
                return (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => setSelectedType(t.type)}
                    className={`flex flex-col items-start gap-0.5 rounded border px-2 py-1.5 text-left text-xs transition ${active
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                      : 'border-transparent hover:bg-accent'}`}
                  >
                    <div className="flex items-center gap-1.5 font-medium">
                      <Icon className="h-3 w-3" />
                      {t.label}
                    </div>
                    <span className="text-[10px] leading-tight text-muted-foreground">{t.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Snippet preview</Label>
              <Badge variant="outline" className="font-mono text-[10px]">{selected.type}</Badge>
            </div>
            <pre className="max-h-40 overflow-auto rounded border bg-muted/20 p-2.5 font-mono text-[11px] leading-relaxed">{snippet}</pre>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={openVsCode} className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            Open in VS Code
          </Button>
          <Button variant="outline" size="sm" onClick={copySnippet} className="gap-1.5">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy snippet'}
          </Button>
          <Button
            size="sm"
            onClick={createOnDisk}
            disabled={!canCreate || creating}
            className="gap-1.5"
            title={canCreate ? `Append ${fieldName} to ${objectName}.object.ts` : 'Dev write API unavailable'}
          >
            {creating ? (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
            ) : (
              <FilePlus className="h-3.5 w-3.5" />
            )}
            {creating ? 'Adding…' : 'Add to object'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
