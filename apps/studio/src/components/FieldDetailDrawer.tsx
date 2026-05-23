// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FieldDetailDrawer — inspect AND lightly edit a single field.
 *
 * Opens when a row in the Fields table is clicked. Shows the full field
 * spec plus inline edits for the three properties authors tweak most
 * often (label, description, required).
 *
 * Because metadata is code, the drawer does not persist edits over the
 * wire. Instead it regenerates the field snippet on every keystroke
 * and surfaces "Copy snippet" — paste it in place of the existing
 * definition, save, HMR.
 *
 *   • Open in VS Code — vscode:// deep-link to the parent object's
 *     source file (the vscode-objectstack extension resolves it).
 *   • Copy field snippet — defineField-style TS literal reflecting the
 *     current edited state.
 *
 * Why a drawer (not a modal): authors want the field list visible so
 * they can quickly compare adjacent fields.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Copy, ExternalLink, Check, Pencil, Save } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export interface FieldSpec {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  multiple?: boolean;
  defaultValue?: unknown;
  options?: Array<{ value: string; label: string } | string>;
  reference?: string;
  maxLength?: number;
  formula?: string;
  description?: string;
  /** All other properties from the schema, surfaced verbatim. */
  [key: string]: unknown;
}

interface FieldDetailDrawerProps {
  field: FieldSpec | null;
  objectName: string;
  packageId?: string;
  onClose: () => void;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return JSON.stringify(v, null, 2);
}

function fieldSnippet(field: FieldSpec): string {
  // Strip the synthetic keys we attach in normalisation; emit a clean object
  // literal ordered by author intent (name first, then label, type, then
  // optional config in a stable order).
  const order = ['name', 'label', 'type', 'required', 'multiple', 'maxLength', 'defaultValue', 'options', 'reference', 'formula', 'description'];
  const ordered: Record<string, unknown> = {};
  for (const k of order) if (field[k] !== undefined) ordered[k] = field[k];
  for (const k of Object.keys(field)) {
    if (!order.includes(k) && field[k] !== undefined) ordered[k] = field[k];
  }
  const json = JSON.stringify(ordered, null, 2);
  return `${field.name}: ${json},`;
}

export function FieldDetailDrawer({ field, objectName, packageId, onClose }: FieldDetailDrawerProps) {
  const [copied, setCopied] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [srcRoot, setSrcRoot] = useState<string | null>(null);

  // Probe the host once when a field opens to learn the on-disk
  // srcRoot. If the host doesn't expose the dev write API the probe
  // returns null and we hide the Save button.
  useEffect(() => {
    if (!field) return;
    let cancelled = false;
    (async () => {
      try {
        const url = packageId && packageId !== 'all'
          ? `/_studio/api/metadata/layout?package=${encodeURIComponent(packageId)}`
          : '/_studio/api/metadata/layout';
        const resp = await fetch(url);
        if (!resp.ok) { if (!cancelled) setSrcRoot(null); return; }
        const data = await resp.json().catch(() => null);
        if (!cancelled) setSrcRoot(data?.srcRoot ?? null);
      } catch {
        if (!cancelled) setSrcRoot(null);
      }
    })();
    return () => { cancelled = true; };
  }, [field, packageId]);

  // Local editable mirrors of the three most-tweaked properties.
  // We keep them as local state so edits are debounce-free; the original
  // `field` is the source of truth on open / object switch.
  const [editLabel, setEditLabel] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editRequired, setEditRequired] = useState(false);

  useEffect(() => {
    if (!field) return;
    setEditLabel(field.label ?? '');
    setEditDescription((field.description as string) ?? '');
    setEditRequired(Boolean(field.required));
    setEditMode(false);
    setCopied(false);
  }, [field]);

  // The "effective" field used for snippet generation reflects current
  // edits when in edit mode; otherwise it's just the upstream field.
  const effectiveField: FieldSpec | null = useMemo(() => {
    if (!field) return null;
    if (!editMode) return field;
    return {
      ...field,
      label: editLabel,
      description: editDescription || undefined,
      required: editRequired || undefined,
    };
  }, [field, editMode, editLabel, editDescription, editRequired]);

  const dirty = useMemo(() => {
    if (!field || !editMode) return false;
    return (
      editLabel !== (field.label ?? '') ||
      editDescription !== ((field.description as string) ?? '') ||
      editRequired !== Boolean(field.required)
    );
  }, [field, editMode, editLabel, editDescription, editRequired]);

  const openVsCode = useCallback(() => {
    if (!field) return;
    const uri = `vscode://objectstack.vscode-objectstack/open?type=object&name=${encodeURIComponent(objectName)}${packageId ? `&package=${encodeURIComponent(packageId)}` : ''}&field=${encodeURIComponent(field.name)}`;
    window.location.href = uri;
  }, [field, objectName, packageId]);

  const copySnippet = useCallback(async () => {
    if (!effectiveField) return;
    try {
      await navigator.clipboard.writeText(fieldSnippet(effectiveField));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast({
        title: dirty ? `Copied edited ${effectiveField.name} snippet` : `Copied ${effectiveField.name} snippet`,
        description: dirty ? 'Paste over the existing field definition in the .object.ts file.' : undefined,
      });
    } catch {
      toast({ title: 'Clipboard unavailable', variant: 'destructive' as any });
    }
  }, [effectiveField, dirty]);

  const canSave = srcRoot != null && dirty && field != null;

  const saveEdits = useCallback(async () => {
    if (!canSave || !field) return;
    setSaving(true);
    try {
      const filePath = `${srcRoot}/objects/${objectName}.object.ts`;
      // Send only the keys that actually changed so we never clobber
      // an unrelated property the user didn't touch in the UI.
      const patch: Record<string, unknown> = {};
      if (editLabel !== (field.label ?? '')) patch.label = editLabel || null;
      if (editDescription !== ((field.description as string) ?? '')) patch.description = editDescription || null;
      if (editRequired !== Boolean(field.required)) patch.required = editRequired;
      const resp = await fetch('/_studio/api/metadata/field-patch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: filePath, field: field.name, patch }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) {
        toast({
          title: 'Save failed',
          description: data?.error ?? `HTTP ${resp.status}`,
          variant: 'destructive' as any,
        });
        return;
      }
      toast({
        title: 'Field updated',
        description: `${filePath} — HMR will reload momentarily.`,
      });
      setEditMode(false);
    } catch (err: any) {
      toast({
        title: 'Save failed',
        description: err?.message ?? String(err),
        variant: 'destructive' as any,
      });
    } finally {
      setSaving(false);
    }
  }, [canSave, field, srcRoot, objectName, editLabel, editDescription, editRequired]);

  if (!field || !effectiveField) return null;

  // Surface every non-internal property in a definition list. Skip ones we
  // already render in the header (name, label, type), plus the ones we
  // expose as inline-edits below (description, required) when in edit mode.
  const headerKeys = new Set(['name', 'label', 'type']);
  const inlineKeys = editMode ? new Set(['description', 'required']) : new Set();
  const detailEntries = Object.entries(field).filter(([k, v]) =>
    !headerKeys.has(k) && !inlineKeys.has(k) && v !== undefined && v !== false && v !== null && v !== ''
  );

  return (
    <Sheet open={!!field} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-[440px] sm:max-w-[440px] overflow-y-auto">
        <SheetHeader className="space-y-2 pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-sm font-medium">{field.name}</code>
              <Badge variant="outline" className="shrink-0 text-[10px]">{field.type}{field.multiple ? '[]' : ''}</Badge>
              {effectiveField.required && (
                <Badge className="shrink-0 bg-amber-100 text-[10px] text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                  Required
                </Badge>
              )}
            </div>
            <Button
              variant={editMode ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setEditMode((v) => !v)}
              className="h-6 gap-1 px-2 text-[11px]"
              title={editMode ? 'Exit edit mode' : 'Edit label / description / required'}
            >
              <Pencil className="h-3 w-3" />
              {editMode ? 'Done' : 'Edit'}
            </Button>
          </div>

          {editMode ? (
            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <Label htmlFor="fd-label" className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Label
                </Label>
                <Input
                  id="fd-label"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fd-desc" className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Description
                </Label>
                <textarea
                  id="fd-desc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  placeholder="Help text shown under the label in forms."
                  className="block w-full resize-y rounded-md border border-input bg-background px-2.5 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <Checkbox
                  checked={editRequired}
                  onCheckedChange={(c) => setEditRequired(c === true)}
                />
                <span>Required</span>
                <span className="text-[10px] text-muted-foreground">
                  Forms reject blank values for required fields.
                </span>
              </label>
            </div>
          ) : (
            <>
              <SheetTitle className="text-base font-medium">{field.label}</SheetTitle>
              {field.description ? (
                <SheetDescription className="text-xs">{field.description as string}</SheetDescription>
              ) : (
                <SheetDescription className="sr-only">Field details</SheetDescription>
              )}
            </>
          )}
        </SheetHeader>

        <div className="border-t pt-4">
          <dl className="space-y-2.5">
            {detailEntries.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">No additional configuration. This is a plain {field.type} field.</p>
            ) : detailEntries.map(([key, value]) => (
              <div key={key} className="grid grid-cols-[120px_1fr] items-start gap-2 text-xs">
                <dt className="font-medium text-muted-foreground">{key}</dt>
                <dd className="min-w-0 break-words font-mono">
                  {key === 'options' && Array.isArray(value) ? (
                    <ul className="space-y-0.5">
                      {(value as any[]).map((opt, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                            {typeof opt === 'string' ? opt : opt.value}
                          </code>
                          {typeof opt !== 'string' && opt.label && (
                            <span className="text-muted-foreground">{opt.label}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <pre className="whitespace-pre-wrap text-[11px]">{formatValue(value)}</pre>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {editMode && dirty && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-[11px] dark:border-amber-900 dark:bg-amber-950/30">
            <p className="font-medium text-amber-900 dark:text-amber-200">Unsaved changes</p>
            <p className="mt-0.5 text-amber-800/80 dark:text-amber-300/80">
              {srcRoot != null ? (
                <>
                  Click <span className="font-medium">Save</span> to write changes to the
                  <code className="mx-0.5 rounded bg-amber-100/60 px-1 dark:bg-amber-900/30">.object.ts</code>
                  source file. HMR will reload Studio in &lt; 1 s.
                </>
              ) : (
                <>
                  Click <span className="font-medium">Copy snippet</span> then paste over the existing
                  <code className="mx-0.5 rounded bg-amber-100/60 px-1 dark:bg-amber-900/30">{field.name}</code>
                  definition in the <code className="rounded bg-amber-100/60 px-1 dark:bg-amber-900/30">.object.ts</code> file.
                </>
              )}
            </p>
          </div>
        )}

        <div className="mt-6 flex gap-2 border-t pt-4">
          <Button variant="outline" size="sm" onClick={openVsCode} className="flex-1 gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            Open in VS Code
          </Button>
          <Button
            variant={dirty && !canSave ? 'default' : 'outline'}
            size="sm"
            onClick={copySnippet}
            className="flex-1 gap-1.5"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : dirty ? 'Copy edited snippet' : 'Copy snippet'}
          </Button>
          {srcRoot != null && (
            <Button
              variant="default"
              size="sm"
              onClick={saveEdits}
              disabled={!canSave || saving}
              className="flex-1 gap-1.5"
              title={dirty ? 'Write changes to the .object.ts file' : 'No edits to save'}
            >
              {saving ? (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {saving ? 'Saving…' : 'Save'}
            </Button>
          )}
        </div>

        {editMode && dirty && srcRoot == null && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            Save unavailable — host runtime doesn't expose the dev write API. Use Copy snippet instead.
          </p>
        )}

        <p className="mt-4 text-[10px] text-muted-foreground">
          Field definitions live in the object's <code className="rounded bg-muted px-1 py-0.5">.object.ts</code> source.
          Edit there and HMR will reload Studio in &lt; 1 s.
        </p>
      </SheetContent>
    </Sheet>
  );
}
