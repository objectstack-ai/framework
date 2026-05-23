// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useState, useEffect } from 'react';
import { useClient } from '@objectstack/client-react';
import { useParams } from '@tanstack/react-router';
import { useScopedClient } from '@/hooks/useObjectStackClient';
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, Copy, Check, Key, Hash, Type, ToggleLeft,
  List, Link, Calculator, Calendar, FileText, CircleDot,
  DollarSign, Percent, Mail, Phone, Link as LinkIcon, MapPin, Braces, Clock, Sigma,
  FileCode, Map, Plus, ChevronRight,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FieldDetailDrawer, type FieldSpec } from './FieldDetailDrawer';
import { AddFieldDialog } from './AddFieldDialog';

interface ObjectSchemaInspectorProps {
  objectApiName: string;
}

const FIELD_TYPE_ICONS: Record<string, React.ElementType> = {
  text: Type,
  longtext: FileText,
  textarea: FileText,
  richtext: FileText,
  number: Hash,
  currency: DollarSign,
  percent: Percent,
  autonumber: Sigma,
  boolean: ToggleLeft,
  select: List,
  multiselect: List,
  lookup: Link,
  reference: Link,
  formula: Calculator,
  date: Calendar,
  datetime: Calendar,
  time: Clock,
  email: Mail,
  phone: Phone,
  url: LinkIcon,
  address: MapPin,
  json: Braces,
  object: Braces,
  markdown: FileCode,
  location: Map,
};

const FIELD_TYPE_COLORS: Record<string, string> = {
  text: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800',
  longtext: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800',
  textarea: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800',
  richtext: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800',
  number: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
  currency: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
  percent: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
  autonumber: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
  boolean: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800',
  select: 'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950 dark:border-purple-800',
  multiselect: 'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950 dark:border-purple-800',
  lookup: 'text-cyan-600 bg-cyan-50 border-cyan-200 dark:text-cyan-400 dark:bg-cyan-950 dark:border-cyan-800',
  reference: 'text-cyan-600 bg-cyan-50 border-cyan-200 dark:text-cyan-400 dark:bg-cyan-950 dark:border-cyan-800',
  formula: 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950 dark:border-orange-800',
  date: 'text-pink-600 bg-pink-50 border-pink-200 dark:text-pink-400 dark:bg-pink-950 dark:border-pink-800',
  datetime: 'text-pink-600 bg-pink-50 border-pink-200 dark:text-pink-400 dark:bg-pink-950 dark:border-pink-800',
  time: 'text-pink-600 bg-pink-50 border-pink-200 dark:text-pink-400 dark:bg-pink-950 dark:border-pink-800',
  email: 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-950 dark:border-indigo-800',
  phone: 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-950 dark:border-indigo-800',
  url: 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-950 dark:border-indigo-800',
  address: 'text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950 dark:border-rose-800',
  json: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-950 dark:border-slate-800',
  object: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-950 dark:border-slate-800',
  markdown: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-950 dark:border-slate-800',
  location: 'text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950 dark:border-rose-800',
};

/**
 * Human-readable explanation for each field type, surfaced as a hover
 * tooltip on the colored type chip. Kept here (not pulled from
 * AddFieldDialog) to avoid a cross-import that would make the dialog
 * load on the Fields panel mount. Each entry is one short sentence.
 */
const FIELD_TYPE_DESCRIPTIONS: Record<string, string> = {
  text: 'Short string up to 255 characters.',
  longtext: 'Multi-paragraph text, no length cap.',
  textarea: 'Multi-line plain text.',
  richtext: 'Rich-text HTML body.',
  number: 'Integer or decimal value.',
  currency: 'Monetary amount (locale-aware display).',
  percent: 'Percentage 0–100, rendered with % suffix.',
  autonumber: 'Auto-incrementing sequential number.',
  boolean: 'True / false toggle.',
  select: 'Pick one value from a fixed option list.',
  multiselect: 'Pick many values from a fixed option list.',
  lookup: 'Reference to a record in another object.',
  reference: 'Reference to a record in another object.',
  formula: 'Computed value from a CEL expression.',
  date: 'Calendar day, no time component.',
  datetime: 'Instant in time with timezone.',
  time: 'Clock time, no date component.',
  email: 'Validated email address.',
  phone: 'Phone number, free-form.',
  url: 'Validated http(s) URL.',
  address: 'Structured postal address.',
  json: 'Arbitrary JSON blob (free shape).',
  object: 'Embedded JSON object.',
  markdown: 'Markdown-formatted body text.',
  location: 'Latitude / longitude pair.',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={handleCopy}>
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy field name</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ObjectSchemaInspector({ objectApiName }: ObjectSchemaInspectorProps) {
  const unscopedClient = useClient();
  const params = useParams({ strict: false }) as { projectId?: string };
  const scopedClient = useScopedClient(params.projectId);
  const client: any = scopedClient ?? unscopedClient;
  const [def, setDef] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedField, setSelectedField] = useState<FieldSpec | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    async function loadDef() {
      try {
        const found: any = await client.meta.getItem('object', objectApiName);
        if (mounted && found) {
          setDef(found.item || found);
        }
      } catch (err) {
        console.error('Failed to load schema:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadDef();
    return () => { mounted = false; };
  }, [client, objectApiName]);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!def) {
    return (
      <div className="flex flex-1 items-center justify-center py-12 text-center text-sm text-muted-foreground">
        Object definition not found: <code className="ml-1 font-mono">{objectApiName}</code>
      </div>
    );
  }

  const fields = def.fields || {};
  const fieldEntries: FieldSpec[] = Object.entries(fields).map(([key, f]: [string, any]) => ({
    ...(f as object),
    name: f.name || key,
    label: f.label || key,
    type: f.type || 'text',
    required: f.required || false,
    multiple: f.multiple || false,
    reference: f.reference,
    defaultValue: f.defaultValue,
    description: f.description,
    options: f.options,
    formula: f.formula,
    maxLength: f.maxLength,
    sortOrder: f.sortOrder,
  }));

  // Parse FQN: namespace__shortName (used elsewhere; namespace/shortName intentionally derived even if unused)
  const objectName = def.name || objectApiName;
  const packageId = (params as any)?.package as string | undefined;

  const filtered = searchQuery
    ? fieldEntries.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.type.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : fieldEntries;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b bg-muted/20 px-4 py-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter fields by name, label, or type…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-9 text-sm"
          />
        </div>
        <span className="ml-auto whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
          {searchQuery ? `${filtered.length} of ${fieldEntries.length}` : `${fieldEntries.length} fields`}
        </span>
        <Button
          size="sm"
          variant="default"
          onClick={() => setAddOpen(true)}
          className="h-7 gap-1.5 px-2.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Add field
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="sticky top-0 z-10 bg-background hover:bg-transparent">
              <TableHead className="w-8"></TableHead>
              <TableHead className="font-medium">Field Name</TableHead>
              <TableHead className="font-medium">Label</TableHead>
              <TableHead className="font-medium">Type</TableHead>
              <TableHead className="font-medium">Required</TableHead>
              <TableHead className="font-medium">Details</TableHead>
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
                {filtered.map((field, idx) => {
                  const FieldIcon = FIELD_TYPE_ICONS[field.type] || CircleDot;
                  const colorClass = FIELD_TYPE_COLORS[field.type] || 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-950 dark:border-gray-800';
                  return (
                    <TableRow
                      key={field.name}
                      className="group cursor-pointer"
                      onClick={() => setSelectedField(field)}
                    >
                      <TableCell className="py-2 text-center text-xs text-muted-foreground tabular-nums">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-sm font-medium">{field.name}</code>
                          <CopyButton text={field.name} />
                          {field.required && (
                            <Key className="h-3 w-3 text-amber-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-sm">{field.label}</TableCell>
                      <TableCell className="py-2">
                        <TooltipProvider delayDuration={250}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className={`gap-1 text-xs cursor-help ${colorClass}`}>
                                <FieldIcon className="h-3 w-3" />
                                {field.type}
                                {field.multiple && '[]'}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="text-xs">
                                <span className="font-mono font-medium">{field.type}{field.multiple ? '[]' : ''}</span>
                                {' — '}
                                {FIELD_TYPE_DESCRIPTIONS[field.type] || 'Custom field type.'}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="py-2">
                        {field.required ? (
                          <Badge variant="default" className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                            Required
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {field.reference && (
                            <Badge variant="outline" className="text-[10px] font-mono gap-1">
                              <Link className="h-2.5 w-2.5" /> → {field.reference}
                            </Badge>
                          )}
                          {field.defaultValue !== undefined && (
                            <Badge variant="outline" className="text-[10px] font-mono">
                              default: {JSON.stringify(field.defaultValue)}
                            </Badge>
                          )}
                          {field.maxLength && (
                            <Badge variant="outline" className="text-[10px] font-mono">
                              max: {field.maxLength}
                            </Badge>
                          )}
                          {field.options && (
                            <Badge variant="outline" className="text-[10px]">
                              {field.options.length} options
                            </Badge>
                          )}
                          {field.formula && (
                            <Badge variant="outline" className="text-[10px] font-mono">
                              ƒ {String(field.formula).slice(0, 30)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 pr-3 text-right">
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground text-sm">
                      {searchQuery ? 'No fields matching filter' : 'No fields defined'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
      </div>
      <FieldDetailDrawer
        field={selectedField}
        objectName={objectName}
        packageId={packageId}
        onClose={() => setSelectedField(null)}
      />
      <AddFieldDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        objectName={objectName}
        packageId={packageId}
      />
    </div>
  );
}
