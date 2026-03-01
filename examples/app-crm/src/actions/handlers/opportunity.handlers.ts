// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Opportunity Action Handlers
 *
 * Handler implementations for actions defined in opportunity.actions.ts.
 *
 * @example Registration:
 * ```ts
 * engine.registerAction('opportunity', 'cloneRecord', cloneRecord);
 * ```
 */

interface ActionContext {
  record: Record<string, unknown>;
  user: { id: string; name: string };
  engine: {
    update(object: string, id: string, data: Record<string, unknown>): Promise<void>;
    insert(object: string, data: Record<string, unknown>): Promise<{ _id: string }>;
    find(object: string, query: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  };
  params?: Record<string, unknown>;
}

/** Clone an opportunity record */
export async function cloneRecord(ctx: ActionContext): Promise<{ _id: string }> {
  const { record, engine } = ctx;
  const { _id, created_at, updated_at, ...fields } = record as Record<string, unknown>;
  return engine.insert('opportunity', {
    ...fields,
    name: `Copy of ${fields.name ?? 'Untitled'}`,
    stage: 'prospecting',
  });
}

/** Mass update opportunity stage for selected records */
export async function massUpdateStage(ctx: ActionContext): Promise<void> {
  const { params, engine } = ctx;
  const newStage = params?.stage as string;
  const ids = (params?.selectedIds ?? []) as string[];
  for (const id of ids) {
    await engine.update('opportunity', id, { stage: newStage });
  }
}
