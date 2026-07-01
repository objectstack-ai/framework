// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { coerceRow, type RefResolver, type RefMatch } from './import-coerce.js';
import type { ExportFieldMeta } from './export-format.js';

/**
 * import-runner — the shared row-processing core for bulk import.
 *
 * Both the synchronous `POST /data/:object/import` route and the asynchronous
 * import-job worker feed rows through {@link runImport}. Extracting the loop
 * keeps the two paths byte-for-byte identical in coercion, upsert matching, and
 * per-row reporting — the async worker only adds progress persistence and
 * cancellation on top.
 */

export type ImportAction = 'created' | 'updated' | 'skipped' | 'failed';

export interface ImportRowResult {
  row: number;
  ok: boolean;
  action: ImportAction;
  id?: string;
  field?: string;
  error?: string;
  code?: string;
}

/** Running tallies handed to {@link RunImportOptions.onProgress}. */
export interface ImportProgress {
  processed: number;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

/**
 * Records exactly what a non-dry-run import changed, so the job can be undone:
 * created records are deleted, and updated records have the touched fields
 * restored to their pre-import values. Only the fields the import wrote are
 * captured (keyed to `before`), keeping the log precise and bounded.
 */
export interface ImportUndoLog {
  /** Ids of records this import created (delete to undo). */
  created: string[];
  /** Per updated record: the touched fields' values *before* the import. */
  updated: Array<{ id: string; before: Record<string, any> }>;
}

export interface ImportRunSummary extends ImportProgress {
  ok: number;
  results: ImportRowResult[];
  cancelled: boolean;
  /** Present only when `captureUndo` was set — the reversal instructions. */
  undoLog?: ImportUndoLog;
}

/** Minimal protocol surface the runner needs (find / create / update). */
export interface ImportProtocolLike {
  findData(args: any): Promise<any>;
  createData(args: any): Promise<any>;
  updateData(args: any): Promise<any>;
}

export interface RunImportOptions {
  /** Protocol/engine to read & write through. */
  p: ImportProtocolLike;
  objectName: string;
  environmentId?: string;
  /** Exec context threaded onto reads and (with automation toggle) writes. */
  context?: any;
  /** Already-mapped rows (source columns renamed to target fields). */
  rows: Array<Record<string, any>>;
  /** Field metadata for value coercion (name→id lookups, select codes, …). */
  metaMap: Map<string, ExportFieldMeta>;
  writeMode: 'insert' | 'update' | 'upsert';
  matchFields: string[];
  dryRun: boolean;
  runAutomations: boolean;
  trimWhitespace: boolean;
  nullValues?: string[];
  createMissingOptions: boolean;
  skipBlankMatchKey: boolean;
  /**
   * Progress callback, invoked every {@link RunImportOptions.progressEvery}
   * processed rows and once at the end. May be async; the runner awaits it so a
   * DB write of progress completes before the next chunk.
   */
  onProgress?: (p: ImportProgress) => void | Promise<void>;
  /** Rows between onProgress calls (default 200). */
  progressEvery?: number;
  /**
   * Cooperative cancellation. Checked at each progress boundary; when it returns
   * truthy the runner stops and returns `cancelled: true` with partial results.
   */
  shouldCancel?: () => boolean | Promise<boolean>;
  /**
   * When true (and not a dry run), accumulate an {@link ImportUndoLog} so the
   * import can be reverted later. Callers gate this on row count to bound the
   * stored snapshot size.
   */
  captureUndo?: boolean;
}

export function runImport(opts: RunImportOptions): Promise<ImportRunSummary> {
  const {
    p, objectName, environmentId, context, rows, metaMap,
    writeMode, matchFields, dryRun, runAutomations,
    trimWhitespace, nullValues, createMissingOptions, skipBlankMatchKey,
    onProgress, shouldCancel, captureUndo,
  } = opts;
  const collectUndo = !!captureUndo && !dryRun;
  const undoLog: ImportUndoLog = { created: [], updated: [] };
  // Snapshot only the fields the import touched, so undo restores exactly what
  // changed. A field absent before the import is recorded as null → undo clears
  // it. Never captured on dry runs (nothing was written).
  const captureBefore = (before: Record<string, any>, written: Record<string, any>): Record<string, any> => {
    const snap: Record<string, any> = {};
    for (const k of Object.keys(written)) snap[k] = before[k] ?? null;
    return snap;
  };
  const progressEvery = Math.max(1, opts.progressEvery ?? 200);

  const findRows = (r: any): any[] =>
    Array.isArray(r?.records) ? r.records
      : Array.isArray(r?.data) ? r.data
        : Array.isArray(r?.rows) ? r.rows
          : Array.isArray(r) ? r : [];
  const findArgsBase = (query: any) => ({
    object: '',
    query,
    ...(environmentId ? { environmentId } : {}),
    ...(context ? { context } : {}),
  });

  // Reference resolver: name/email/id → referenced record id. Cached per
  // (object, display) so a name repeated across rows costs one query.
  const refCache = new Map<string, RefMatch>();
  const resolveRef: RefResolver = async (referenceObject, display, meta) => {
    const cacheKey = `${referenceObject}::${display}`;
    const cached = refCache.get(cacheKey);
    if (cached) return cached;
    // Try an exact id first (authoritative + unique when the user pasted an id),
    // then the configured display field, then the usual human identifiers.
    // De-dupe so a field isn't queried twice. The first candidate field to match
    // wins; if that field matches >1 record we stop and report ambiguity rather
    // than silently linking the first.
    const candidates = [...new Set([
      'id',
      ...(meta.displayField ? [meta.displayField] : []),
      'name', 'title', 'label', 'full_name', 'email', 'username',
    ])];
    let match: RefMatch = {};
    for (const f of candidates) {
      try {
        const r = await p.findData({
          ...findArgsBase({ $filter: { [f]: display }, $top: 2 }),
          object: referenceObject,
        });
        const recs = findRows(r);
        if (recs.length === 0) continue;
        if (recs.length > 1) { match = { ambiguous: true, matchedField: f }; break; }
        if (recs[0]?.id != null) { match = { id: String(recs[0].id), matchedField: f }; break; }
      } catch { /* field absent on target object — try the next candidate */ }
    }
    refCache.set(cacheKey, match);
    return match;
  };

  // Locate an existing record for update/upsert by matchFields. Returns the
  // record, or a sentinel: 'blank' (a match field was empty), 'none' (no
  // match), 'ambiguous' (>1 match — too risky to update).
  const findExisting = async (
    data: Record<string, any>,
  ): Promise<Record<string, any> | 'blank' | 'none' | 'ambiguous'> => {
    const filter: Record<string, any> = {};
    for (const f of matchFields) {
      const v = data[f];
      if (v === undefined || v === null || v === '') return 'blank';
      filter[f] = v;
    }
    const r = await p.findData({ ...findArgsBase({ $filter: filter, $top: 2 }), object: objectName });
    const recs = findRows(r);
    if (recs.length === 0) return 'none';
    if (recs.length > 1) return 'ambiguous';
    return recs[0];
  };

  const writeCtx = { ...(context ?? {}), skipAutomations: !runAutomations };

  const results: ImportRowResult[] = [];
  let okCount = 0, errCount = 0, created = 0, updated = 0, skipped = 0;
  let cancelled = false;

  const snapshot = (processed: number): ImportProgress => ({
    processed, total: rows.length, created, updated, skipped, errors: errCount,
  });

  return (async () => {
    for (let i = 0; i < rows.length; i++) {
      const rowNo = i + 1;
      try {
        // 1. Coerce every cell to its storage value (+ resolve lookups).
        const { data, errors } = await coerceRow(rows[i], metaMap, {
          trimWhitespace, nullValues, createMissingOptions, resolveRef,
        });
        if (errors.length > 0) {
          const first = errors[0];
          errCount++;
          results.push({ row: rowNo, ok: false, action: 'failed', field: first.field, code: first.code, error: first.message });
        } else {
          // 2. Decide create vs update vs skip.
          let existing: Record<string, any> | 'blank' | 'none' | 'ambiguous' = 'none';
          let handled = false;
          if (writeMode !== 'insert') {
            existing = await findExisting(data);
            if (existing === 'ambiguous') {
              errCount++;
              results.push({ row: rowNo, ok: false, action: 'failed', code: 'AMBIGUOUS_MATCH', error: `matchFields matched more than one ${objectName} record` });
              handled = true;
            } else if (existing === 'blank' && (skipBlankMatchKey || writeMode === 'update')) {
              // Blank match key: skip when asked, else fall through to create.
              skipped++;
              results.push({ row: rowNo, ok: true, action: 'skipped', code: 'BLANK_MATCH_KEY' });
              handled = true;
            }
          }

          if (!handled) {
            const willUpdate = existing && typeof existing === 'object';
            const willCreate = !willUpdate && (writeMode === 'insert' || writeMode === 'upsert');

            if (!willUpdate && !willCreate) {
              // update mode, no match → skip.
              skipped++;
              results.push({ row: rowNo, ok: true, action: 'skipped', code: 'NO_MATCH' });
            } else if (dryRun) {
              okCount++;
              if (willUpdate) { updated++; results.push({ row: rowNo, ok: true, action: 'updated', id: String((existing as any).id ?? '') || undefined }); }
              else { created++; results.push({ row: rowNo, ok: true, action: 'created' }); }
            } else if (willUpdate) {
              const target = existing as Record<string, any>;
              const res2 = await p.updateData({ object: objectName, id: target.id, data, context: writeCtx, ...(environmentId ? { environmentId } : {}) });
              const id = (res2 as any)?.id ?? (res2 as any)?.record?.id ?? target.id;
              okCount++; updated++;
              if (collectUndo && target.id != null) {
                undoLog.updated.push({ id: String(target.id), before: captureBefore(target, data) });
              }
              results.push({ row: rowNo, ok: true, action: 'updated', id: id != null ? String(id) : undefined });
            } else {
              const res2 = await p.createData({ object: objectName, data, context: writeCtx, ...(environmentId ? { environmentId } : {}) });
              const id = (res2 as any)?.id ?? (res2 as any)?.record?.id;
              okCount++; created++;
              if (collectUndo && id != null) undoLog.created.push(String(id));
              results.push({ row: rowNo, ok: true, action: 'created', id: id != null ? String(id) : undefined });
            }
          }
        }
      } catch (err: any) {
        errCount++;
        const code = err?.code ?? 'IMPORT_ROW_FAILED';
        const message = typeof err?.message === 'string' ? err.message.slice(0, 300) : 'Row failed';
        results.push({ row: rowNo, ok: false, action: 'failed', error: message, code });
      }

      const processed = i + 1;
      if (onProgress && (processed % progressEvery === 0 || processed === rows.length)) {
        await onProgress(snapshot(processed));
      }
      if (shouldCancel && processed < rows.length && (processed % progressEvery === 0)) {
        if (await shouldCancel()) { cancelled = true; break; }
      }
    }

    return {
      ...snapshot(results.length), ok: okCount, results, cancelled,
      ...(collectUndo ? { undoLog } : {}),
    };
  })();
}
