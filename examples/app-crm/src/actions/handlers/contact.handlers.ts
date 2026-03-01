// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Contact Action Handlers
 *
 * Handler implementations for actions defined in contact.actions.ts.
 *
 * @example Registration:
 * ```ts
 * engine.registerAction('contact', 'markAsPrimaryContact', markAsPrimaryContact);
 * ```
 */

interface ActionContext {
  record: Record<string, unknown>;
  user: { id: string; name: string };
  engine: {
    update(object: string, id: string, data: Record<string, unknown>): Promise<void>;
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
    await engine.update('contact', sibling._id as string, { is_primary: false });
  }

  // Set current contact as primary
  await engine.update('contact', record._id as string, { is_primary: true });
}
