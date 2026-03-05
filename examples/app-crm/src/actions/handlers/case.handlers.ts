// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Case Action Handlers
 *
 * Handler implementations for actions defined in case.actions.ts.
 *
 * @example Registration:
 * ```ts
 * engine.registerAction('case', 'escalateCase', escalateCase);
 * engine.registerAction('case', 'closeCase', closeCase);
 * ```
 */

interface ActionContext {
  record: Record<string, unknown>;
  user: { id: string; name: string };
  engine: {
    update(object: string, id: string, data: Record<string, unknown>): Promise<void>;
  };
  params?: Record<string, unknown>;
}

/** Escalate a case to the escalation team */
export async function escalateCase(ctx: ActionContext): Promise<void> {
  const { record, engine, user, params } = ctx;
  await engine.update('case', record.id as string, {
    is_escalated: true,
    escalation_reason: params?.reason as string,
    escalated_by: user.id,
    escalated_at: new Date().toISOString(),
    priority: 'urgent',
  });
}

/** Close a case with a resolution */
export async function closeCase(ctx: ActionContext): Promise<void> {
  const { record, engine, user, params } = ctx;
  await engine.update('case', record.id as string, {
    is_closed: true,
    resolution: params?.resolution as string,
    closed_by: user.id,
    closed_at: new Date().toISOString(),
    status: 'closed',
  });
}
