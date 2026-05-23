// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectExplorer — Airtable-style canvas for an `object` metadata item.
 *
 * Controlled component: the active panel (records / fields / api) is
 * driven by the `mode` prop from {@link PluginHost}. This component
 * intentionally has **no** internal tab strip — PluginHost's mode
 * switcher is the single source of truth so the page only ever shows
 * one row of mode buttons.
 *
 * Mode mapping (see `object-plugin.tsx`):
 *   - `data`   → records grid via `@object-ui/plugin-grid`'s ObjectGrid
 *                (the same mature component runtime apps use — full
 *                Airtable-style filter/group/sort/density/edit out of
 *                the box, no hand-rolled table to maintain).
 *                Row-click opens `@object-ui/plugin-detail`'s
 *                `RecordDetailDrawer`; the grid's "Add record" button
 *                opens a Sheet with `@object-ui/plugin-form`'s
 *                ObjectForm in create mode. Both are first-party
 *                @object-ui widgets — no hand-rolled drawer/form here.
 *   - `design` → field/schema editor (ObjectSchemaInspector — schema,
 *                not data, so not replaced by @object-ui).
 *   - `code`   → REST API console.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ObjectGrid } from '@object-ui/plugin-grid';
import { RecordDetailDrawer, deriveRecordPageHref } from '@object-ui/plugin-detail';
import { ObjectForm } from '@object-ui/plugin-form';
import { useClient } from '@objectstack/client-react';
import { useParams } from '@tanstack/react-router';
import type { ViewMode } from '@objectstack/spec/studio';
import { ObjectSchemaInspector } from './ObjectSchemaInspector';
import { ObjectApiConsole } from './ObjectApiConsole';
import { useObjectUiDataSource } from '@/hooks/useObjectUiDataSource';
import { useScopedClient } from '@/hooks/useObjectStackClient';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';

interface ObjectExplorerProps {
  objectApiName: string;
  /** Active panel, driven by PluginHost. Falls back to records grid. */
  mode?: ViewMode;
}

/** Heuristic: pick a likely "name" / display-label field for the drawer title. */
function pickRecordTitle(record: any, schema: any): string {
  if (!record) return 'Record';
  const fields = schema?.fields || {};
  const preferred = ['name', 'title', 'subject', 'label', 'company_name', 'full_name', 'first_name'];
  for (const key of preferred) {
    if (record[key]) return String(record[key]);
    const matchedKey = Object.keys(fields).find(k => fields[k]?.name === key);
    if (matchedKey && record[matchedKey]) return String(record[matchedKey]);
  }
  // First non-empty string field, ignoring obvious system fields.
  const SYS = new Set(['id', 'created_at', 'updated_at', 'created_by', 'updated_by']);
  for (const k of Object.keys(record)) {
    if (SYS.has(k)) continue;
    const v = record[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return String(record.id ?? record._id ?? 'Record');
}

/**
 * Designer-mode Records grid: like Airtable, surface every field by
 * default so authors can see exactly what their schema produces.
 * @object-ui's ObjectGrid picks a minimal column set when no `columns`
 * are passed; for the schema-designer context we want the full picture.
 */
function DesignerRecordsGrid({ objectApiName }: { objectApiName: string }) {
  const dataSource = useObjectUiDataSource();
  const unscoped = useClient();
  const params = useParams({ strict: false }) as { projectId?: string };
  const scoped = useScopedClient(params.projectId);
  const client: any = scoped ?? unscoped;
  const [columns, setColumns] = useState<string[] | undefined>(undefined);
  const [schema, setSchema] = useState<any>(null);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // Bump to force the grid to refetch after create/update/delete.
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const found: any = await client.meta.getItem('object', objectApiName);
        const def = found?.item || found?.spec || found;
        const fields = def?.fields || {};
        const all = Object.keys(fields)
          .map((k) => fields[k]?.name || k)
          // Hide framework-internal projection fields that aren't useful in the designer.
          .filter((n) => n && n !== 'formatted_summary');
        if (mounted) {
          setColumns(all);
          setSchema(def);
        }
      } catch {
        if (mounted) setColumns(undefined);
      }
    })();
    return () => { mounted = false; };
  }, [client, objectApiName]);

  const bumpRefresh = useCallback(() => {
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    // Debounce in case multiple mutations land in the same tick.
    refreshTimerRef.current = window.setTimeout(() => {
      setRefreshKey(k => k + 1);
      refreshTimerRef.current = null;
    }, 100);
  }, []);

  const handleRowClick = useCallback((record: any) => {
    setSelectedRecord(record);
  }, []);

  const handleAddRecord = useCallback(() => {
    setCreateOpen(true);
  }, []);

  // Submit handler for the inline create form. Uses the data source so we
  // share the same transport / auth / error mapping the grid uses.
  const handleCreateSubmit = useCallback(async (values: Record<string, any>) => {
    try {
      const ds: any = dataSource;
      // @object-ui adapters expose `create` (preferred) or `createRecord`.
      const fn = ds?.create || ds?.createRecord;
      if (!fn) {
        toast({ title: 'Adapter has no create method', variant: 'destructive' as any });
        return;
      }
      await fn.call(ds, objectApiName, values);
      toast({ title: `Created ${objectApiName} record` });
      setCreateOpen(false);
      bumpRefresh();
    } catch (err: any) {
      toast({
        title: 'Create failed',
        description: err?.message ?? String(err),
        variant: 'destructive' as any,
      });
    }
  }, [dataSource, objectApiName, bumpRefresh]);

  const recordId = selectedRecord?.id ?? selectedRecord?._id ?? '';
  const drawerTitle = useMemo(
    () => (selectedRecord ? pickRecordTitle(selectedRecord, schema) : ''),
    [selectedRecord, schema],
  );

  return (
    <>
      <ObjectGrid
        key={refreshKey}
        schema={{ type: 'object-grid', objectName: objectApiName, ...(columns ? { columns } : {}) }}
        dataSource={dataSource}
        className="h-full"
        onRowClick={handleRowClick}
        onAddRecord={handleAddRecord}
      />

      {selectedRecord && (
        <RecordDetailDrawer
          open={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
          title={drawerTitle}
          record={selectedRecord}
          objectName={objectApiName}
          recordId={recordId}
          dataSource={dataSource}
          objectSchema={schema}
          onFieldSave={() => bumpRefresh()}
          onDelete={() => { bumpRefresh(); setSelectedRecord(null); }}
          fullPageHref={deriveRecordPageHref(objectApiName, recordId) ?? undefined}
        />
      )}

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-[480px] overflow-y-auto sm:max-w-[480px]">
          <SheetHeader>
            <SheetTitle>New {objectApiName} record</SheetTitle>
            <SheetDescription>
              Fields marked required must be filled. Submit to persist via the same data source the grid uses.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <ObjectForm
              schema={{
                type: 'object-form',
                objectName: objectApiName,
                mode: 'create',
                submitLabel: 'Create record',
                onSubmit: handleCreateSubmit as any,
              } as any}
              dataSource={dataSource}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function ObjectExplorer({ objectApiName, mode = 'data' }: ObjectExplorerProps) {
  const panel = mode === 'design' ? 'design' : mode === 'code' ? 'code' : 'data';

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        {panel === 'data' && <DesignerRecordsGrid objectApiName={objectApiName} />}
        {panel === 'design' && <ObjectSchemaInspector objectApiName={objectApiName} />}
        {panel === 'code' && <ObjectApiConsole objectApiName={objectApiName} />}
      </div>
    </div>
  );
}
