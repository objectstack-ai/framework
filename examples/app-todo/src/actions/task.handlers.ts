// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Task Action Handlers
 *
 * Example handler implementations for actions defined in task.actions.ts.
 * Each handler is registered via `engine.registerAction()` and referenced
 * by name through the action's `target` field.
 *
 * @example Registration (in a plugin or config bootstrap):
 * ```ts
 * engine.registerAction('task', 'completeTask', completeTask);
 * engine.registerAction('task', 'startTask', startTask);
 * ```
 */

// ─── Handler Context (simplified for example purposes) ──────────────
interface ActionContext {
  /** The record being acted upon */
  record: Record<string, unknown>;
  /** Current authenticated user */
  user: { id: string; name: string };
  /** Data engine for CRUD operations */
  engine: {
    update(object: string, id: string, data: Record<string, unknown>): Promise<void>;
    insert(object: string, data: Record<string, unknown>): Promise<{ _id: string }>;
    find(object: string, query: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
    delete(object: string, ids: string[]): Promise<void>;
  };
  /** Action parameters (from user input / params) */
  params?: Record<string, unknown>;
}

/** Mark a single task as complete */
export async function completeTask(ctx: ActionContext): Promise<void> {
  const { record, engine, user } = ctx;
  await engine.update('task', record._id as string, {
    status: 'completed',
    completed_at: new Date().toISOString(),
    completed_by: user.id,
  });
}

/** Mark a task as in-progress */
export async function startTask(ctx: ActionContext): Promise<void> {
  const { record, engine } = ctx;
  await engine.update('task', record._id as string, {
    status: 'in_progress',
    started_at: new Date().toISOString(),
  });
}

/** Clone a task (duplicate with reset status) */
export async function cloneTask(ctx: ActionContext): Promise<{ _id: string }> {
  const { record, engine } = ctx;
  const { _id, created_at, updated_at, completed_at, completed_by, ...fields } = record as Record<string, unknown>;
  return engine.insert('task', {
    ...fields,
    status: 'not_started',
    subject: `Copy of ${fields.subject ?? 'Untitled'}`,
  });
}

/** Mark all selected tasks as complete (bulk) */
export async function massCompleteTasks(ctx: ActionContext): Promise<void> {
  const { params, engine, user } = ctx;
  const ids = (params?.selectedIds ?? []) as string[];
  const now = new Date().toISOString();
  for (const id of ids) {
    await engine.update('task', id, {
      status: 'completed',
      completed_at: now,
      completed_by: user.id,
    });
  }
}

/** Delete all completed tasks */
export async function deleteCompletedTasks(ctx: ActionContext): Promise<void> {
  const { engine } = ctx;
  const completed = await engine.find('task', { status: 'completed' });
  const ids = completed.map((r) => r._id as string);
  if (ids.length > 0) {
    await engine.delete('task', ids);
  }
}

/** Defer a task by updating its due date (modal form submission handler) */
export async function deferTask(ctx: ActionContext): Promise<void> {
  const { record, engine, params } = ctx;
  await engine.update('task', record._id as string, {
    due_date: params?.new_due_date as string,
    defer_reason: params?.reason as string ?? null,
    status: 'waiting',
  });
}

/** Set a reminder on a task (modal form submission handler) */
export async function setReminder(ctx: ActionContext): Promise<void> {
  const { record, engine, params } = ctx;
  await engine.update('task', record._id as string, {
    reminder_date: params?.reminder_date as string,
    has_reminder: true,
  });
}

/** Export tasks to CSV format */
export async function exportTasksToCSV(ctx: ActionContext): Promise<string> {
  const { engine } = ctx;
  const tasks = await engine.find('task', {});
  const header = 'subject,status,priority,category,due_date';
  const rows = tasks.map((t) =>
    [t.subject, t.status, t.priority, t.category, t.due_date ?? ''].join(','),
  );
  return [header, ...rows].join('\n');
}
