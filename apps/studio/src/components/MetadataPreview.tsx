// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * MetadataPreview — single entry point for rendering "what will this
 * metadata look like at runtime?" inside Studio.
 *
 * The renderer is chosen from `(type, spec)`:
 *
 *   object        → ObjectGrid (table preview of live data)
 *   view + form   → ObjectForm (create-mode form)
 *   view + kanban → ObjectKanban
 *   view + grid   → ObjectGrid
 *   view + detail → DetailView (single-record)
 *   view + calendar → ObjectCalendar (if available)
 *   dashboard     → grid of widgets — falls back to JSON
 *
 * Anything we don't recognise renders a small "no preview available"
 * note with the metadata payload printed as JSON so authors can still
 * sanity-check the spec. All renderers receive the shared Studio
 * DataSource (see useObjectUiDataSource) so they hit the same backend
 * Studio is already inspecting.
 */

import { Suspense, lazy, useMemo, useState } from 'react';
import * as React from 'react';
import { ObjectGrid } from '@object-ui/plugin-grid';
import { ObjectKanban } from '@object-ui/plugin-kanban';
import { DetailView } from '@object-ui/plugin-detail';
import { useObjectUiDataSource } from '@/hooks/useObjectUiDataSource';
import { useMetadataHmr } from '@/hooks/useMetadataHmr';
import { LiveFormPreview } from './LiveFormPreview';
import { LivePreviewStatusBar } from './LivePreviewStatusBar';
import { AlertCircle, Eye, LayoutGrid, KanbanSquare, Calendar as CalendarIcon, FileText, ListChecks } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/** Built-in top-level keys we surface as sub-views. */
const TOP_LEVEL_SUBVIEW_KEYS = ['list', 'grid', 'table', 'kanban', 'board', 'calendar', 'form', 'detail'] as const;

interface SubView {
  /** Unique key used for selection state. */
  key: string;
  /** Human-readable tab label. */
  label: string;
  /** Lucide icon to render in the tab. */
  icon: React.ComponentType<{ className?: string }>;
  /** Renderer hint (kanban / grid / calendar / form / detail). */
  viewType: string;
  /** The sub-spec to pass to the renderer. */
  spec: any;
}

const TYPE_LABEL: Record<string, string> = {
  list: 'List',
  grid: 'Grid',
  table: 'Table',
  kanban: 'Kanban',
  board: 'Board',
  calendar: 'Calendar',
  timeline: 'Timeline',
  gallery: 'Gallery',
  map: 'Map',
  gantt: 'Gantt',
  form: 'Form',
  detail: 'Detail',
};

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  list: ListChecks,
  grid: LayoutGrid,
  table: LayoutGrid,
  kanban: KanbanSquare,
  board: KanbanSquare,
  calendar: CalendarIcon,
  timeline: CalendarIcon,
  gallery: LayoutGrid,
  map: LayoutGrid,
  gantt: LayoutGrid,
  form: FileText,
  detail: FileText,
};

function resolveViewType(spec: any, fallback?: string): string {
  return (
    spec?.type?.replace(/^object-/, '') ||
    spec?.viewType ||
    fallback ||
    'form'
  );
}

function resolveSubViewLabel(spec: any, viewType: string, fallback: string): string {
  if (typeof spec?.label === 'string') return spec.label;
  if (spec?.label && typeof spec.label === 'object' && 'defaultValue' in spec.label) {
    return String((spec.label as any).defaultValue);
  }
  return TYPE_LABEL[viewType] || fallback;
}

// Calendar is lazy-loaded — the package pulls in dnd/react-big-calendar
// which is ~150 KB gz; only readers hit it.
const ObjectCalendar = lazy(async () => {
  const mod = (await import('@object-ui/plugin-calendar')) as any;
  return { default: mod.ObjectCalendar as React.ComponentType<any> };
});

export interface MetadataPreviewProps {
  /** Metadata type ('object', 'view', 'dashboard', …). */
  type: string;
  /** Object/view machine name. Required for object previews. */
  name?: string;
  /** The metadata document. For views this is the view spec. */
  spec?: any;
  /** Object machine name backing the view (when not on `spec.objectName`). */
  objectName?: string;
  /** Optional className passed through to the renderer. */
  className?: string;
}

export function MetadataPreview({
  type,
  name,
  spec,
  objectName,
  className,
}: MetadataPreviewProps) {
  const dataSource = useObjectUiDataSource();
  const { version: hmrVersion } = useMetadataHmr();

  // Detect a multi-view document. We surface, in this order:
  //   1. Top-level keys (list/grid/kanban/calendar/form/detail/…)
  //   2. `listViews: { key1: subSpec, key2: subSpec }` — common CRM pattern
  //      for alternate visualisations of the same object.
  const subViews = useMemo<SubView[]>(() => {
    if (type !== 'view' || !spec || typeof spec !== 'object') return [];
    const out: SubView[] = [];
    for (const k of TOP_LEVEL_SUBVIEW_KEYS) {
      const sub = (spec as any)[k];
      if (sub && typeof sub === 'object') {
        const vt = resolveViewType(sub, k);
        out.push({
          key: k,
          label: resolveSubViewLabel(sub, vt, k),
          icon: TYPE_ICON[vt] ?? LayoutGrid,
          viewType: vt,
          spec: sub,
        });
      }
    }
    const lv = (spec as any).listViews;
    if (lv && typeof lv === 'object') {
      for (const [name, sub] of Object.entries(lv)) {
        if (!sub || typeof sub !== 'object') continue;
        const vt = resolveViewType(sub);
        out.push({
          key: `listViews.${name}`,
          label: resolveSubViewLabel(sub, vt, name),
          icon: TYPE_ICON[vt] ?? LayoutGrid,
          viewType: vt,
          spec: sub,
        });
      }
    }
    return out;
  }, [type, spec]);

  const [activeSub, setActiveSub] = useState<string | null>(null);
  const effectiveSub: SubView | null = useMemo(() => {
    if (subViews.length === 0) return null;
    return subViews.find((s) => s.key === activeSub) ?? subViews[0];
  }, [subViews, activeSub]);

  // Compute the renderer + schema lazily so we don't import any heavy
  // component for the wrong type.
  const rendered = useMemo(() => {
    // Plain Object preview → grid of records.
    if (type === 'object' && name) {
      return (
        <ObjectGrid
          schema={{ type: 'object-grid', objectName: name, mode: 'read' as const }}
          dataSource={dataSource}
          className={className}
        />
      );
    }

    if (type !== 'view' || !spec) {
      return (
        <UnsupportedPreview type={type} spec={spec} />
      );
    }

    // Multi-view document: pick the active sub-view.
    const subSpec: any = effectiveSub ? effectiveSub.spec : spec;
    const viewType: string = effectiveSub
      ? effectiveSub.viewType
      : resolveViewType(spec, 'form');
    const resolvedObject: string =
      subSpec?.data?.object ||
      subSpec?.objectName ||
      spec?.data?.object ||
      spec?.objectName ||
      objectName ||
      name ||
      '';

    switch (viewType) {
      case 'form':
        return (
          <LiveFormPreview spec={subSpec} objectName={resolvedObject} className={className} />
        );
      case 'kanban':
      case 'board': {
        const k = subSpec?.kanban ?? {};
        // CRM convention: spec.kanban.{groupByField, columns}; @object-ui
        // expects {groupBy, cardFields} at the schema root. Translate so
        // each kanban column groups by the field value (e.g. 'status').
        const groupBy =
          k.groupByField ?? k.groupBy ?? subSpec?.groupBy ?? subSpec?.groupByField;
        const cardFields = Array.isArray(k.columns)
          ? k.columns
          : Array.isArray(subSpec?.columns) && subSpec.columns.every((c: any) => typeof c === 'string')
            ? subSpec.columns
            : undefined;
        // Strip the CRM-style columns/kanban/data keys; let our normalised props win.
        // `data` here is `{ provider:'object', object:'case' }` — but @object-ui's
        // ObjectKanban interprets `data` as a pre-fetched record array and skips
        // its own fetch when it's truthy. So drop it.
        const { columns: _drop1, kanban: _drop2, data: _drop3, ...rest } = subSpec ?? {};
        return (
          <ObjectKanban
            schema={{
              type: 'object-kanban',
              objectName: resolvedObject,
              ...rest,
              ...(groupBy ? { groupBy } : {}),
              ...(cardFields ? { cardFields } : {}),
            }}
            dataSource={dataSource}
            className={className}
          />
        );
      }
      case 'grid':
      case 'list':
      case 'table':
        return (
          <ObjectGrid
            schema={{
              type: 'object-grid',
              objectName: resolvedObject,
              mode: 'read',
              ...subSpec,
            }}
            dataSource={dataSource}
            className={className}
          />
        );
      case 'detail':
        return (
          <DetailView
            schema={{
              type: 'object-detail',
              objectName: resolvedObject,
              ...subSpec,
            }}
            dataSource={dataSource}
            className={className}
          />
        );
      case 'calendar': {
        const c = subSpec?.calendar ?? {};
        // @object-ui's ObjectCalendar accepts either a top-level `calendar`
        // object or `{startDateField, endDateField, titleField, colorField}`
        // at the schema root. Pass both to be safe.
        const { data: _drop, ...rest } = subSpec ?? {};
        return (
          <Suspense fallback={<PreviewLoading />}>
            <ObjectCalendar
              schema={{
                type: 'object-calendar',
                objectName: resolvedObject,
                ...rest,
                ...(c.startDateField ? { startDateField: c.startDateField } : {}),
                ...(c.endDateField ? { endDateField: c.endDateField } : {}),
                ...(c.titleField ? { titleField: c.titleField } : {}),
                ...(c.colorField ? { colorField: c.colorField } : {}),
              }}
              dataSource={dataSource}
              className={className}
            />
          </Suspense>
        );
      }
      default:
        return <UnsupportedPreview type={`view/${viewType}`} spec={subSpec} />;
    }
  }, [type, name, spec, objectName, className, dataSource, effectiveSub]);

  // Whether the current sub-view renders its own status bar (LiveFormPreview does).
  const isFormSub = (effectiveSub?.viewType === 'form') ||
    (type === 'view' && !effectiveSub && (spec?.viewType === 'form' || (!spec?.viewType && (spec?.sections || spec?.groups))));

  const resolvedObjectName = useMemo(() => {
    if (type === 'object') return name ?? '';
    const subSpec: any = effectiveSub ? effectiveSub.spec : spec;
    return subSpec?.data?.object || subSpec?.objectName || spec?.data?.object || spec?.objectName || objectName || name || '';
  }, [type, name, spec, objectName, effectiveSub]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-dashed px-4 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Eye className="h-3.5 w-3.5" />
          <span>Live preview · rendered with @object-ui</span>
        </div>
        {subViews.length > 1 && (
          <div className="flex flex-wrap items-center gap-1">
            {subViews.map((sv) => {
              const Icon = sv.icon;
              const active = sv.key === effectiveSub?.key;
              return (
                <Button
                  key={sv.key}
                  size="sm"
                  variant={active ? 'default' : 'ghost'}
                  className="h-6 gap-1 px-2 text-[11px]"
                  onClick={() => setActiveSub(sv.key)}
                  title={sv.viewType}
                >
                  <Icon className="h-3 w-3" />
                  {sv.label}
                </Button>
              );
            })}
          </div>
        )}
      </div>
      <div className={isFormSub ? 'min-h-0 flex-1 overflow-hidden' : 'min-h-0 flex-1 overflow-auto p-4'}>
        <div key={`hmr-${hmrVersion}`} className="h-full">{rendered}</div>
      </div>
      {!isFormSub && <LivePreviewStatusBar objectName={resolvedObjectName} />}
    </div>
  );
}

function PreviewLoading() {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
      Loading preview…
    </div>
  );
}

function UnsupportedPreview({ type, spec }: { type: string; spec: any }) {
  return (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>No live preview for {type}</AlertTitle>
      <AlertDescription className="mt-2 text-xs">
        Studio doesn't render this metadata type yet. The raw spec is shown below for
        reference.
        <pre className="mt-3 max-h-64 overflow-auto rounded bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
          {JSON.stringify(spec ?? null, null, 2)}
        </pre>
      </AlertDescription>
    </Alert>
  );
}
