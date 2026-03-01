// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Global Action Handlers
 *
 * Handler implementations for cross-domain actions defined in global.actions.ts.
 *
 * @example Registration:
 * ```ts
 * engine.registerAction('*', 'exportToCSV', exportToCSV);
 * engine.registerAction('*', 'logCall', logCall);
 * ```
 */

interface ActionContext {
  record: Record<string, unknown>;
  user: { id: string; name: string };
  engine: {
    insert(object: string, data: Record<string, unknown>): Promise<{ _id: string }>;
    find(object: string, query: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  };
  params?: Record<string, unknown>;
}

/** Export records of a given object to CSV format */
export async function exportToCSV(ctx: ActionContext): Promise<string> {
  const { params, engine } = ctx;
  const objectName = (params?.objectName ?? 'account') as string;
  const records = await engine.find(objectName, {});
  if (records.length === 0) return '';

  const keys = Object.keys(records[0]);
  const header = keys.join(',');
  const rows = records.map((r) => keys.map((k) => r[k] ?? '').join(','));
  return [header, ...rows].join('\n');
}

/** Log a phone call as an activity record (modal form submission handler) */
export async function logCall(ctx: ActionContext): Promise<{ activityId: string }> {
  const { record, engine, user, params } = ctx;
  const activity = await engine.insert('activity', {
    type: 'call',
    subject: params?.subject ? String(params.subject) : 'Untitled Call',
    duration_minutes: params?.duration ? Number(params.duration) : 0,
    notes: params?.notes ? String(params.notes) : '',
    related_to_id: record._id as string,
    direction: 'outbound',
    status: 'completed',
    created_by: user.id,
    call_date: new Date().toISOString(),
  });
  return { activityId: activity._id };
}
