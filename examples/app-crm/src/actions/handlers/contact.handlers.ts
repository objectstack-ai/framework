// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Contact Action Handlers
 *
 * Handler implementations for actions defined in contact.actions.ts.
 *
 * @example Registration:
 * ```ts
 * engine.registerAction('contact', 'markAsPrimaryContact', markAsPrimaryContact);
 * engine.registerAction('contact', 'sendEmail', sendEmail);
 * ```
 */

interface ActionContext {
  record: Record<string, unknown>;
  user: { id: string; name: string };
  engine: {
    update(object: string, id: string, data: Record<string, unknown>): Promise<void>;
    insert(object: string, data: Record<string, unknown>): Promise<{ id: string }>;
    find(object: string, query: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  };
  params?: Record<string, unknown>;
}

/** Mark a contact as the primary contact for its account */
export async function markAsPrimaryContact(ctx: ActionContext): Promise<void> {
  const { record, engine } = ctx;
  const accountId = record.account_id as string;

  // Clear existing primary contacts on the same account
  const siblings = await engine.find('contact', { account_id: accountId, is_primary: true });
  for (const sibling of siblings) {
    await engine.update('contact', sibling.id as string, { is_primary: false });
  }

  // Set current contact as primary
  await engine.update('contact', record.id as string, { is_primary: true });
}

/** Send an email to a contact (modal form submission handler) */
export async function sendEmail(ctx: ActionContext): Promise<{ activityId: string }> {
  const { record, engine, user, params } = ctx;
  const activity = await engine.insert('activity', {
    type: 'email',
    subject: params?.subject ? String(params.subject) : `Email to ${record.email}`,
    body: params?.body ? String(params.body) : '',
    contact_id: record.id as string,
    account_id: record.account_id as string,
    direction: 'outbound',
    status: 'sent',
    created_by: user.id,
    sent_at: new Date().toISOString(),
  });
  return { activityId: activity.id };
}
