// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Hook, HookContext } from '@objectstack/spec/data';

/**
 * Case SLA & escalation hook.
 *
 * - For `critical` cases without `sla_due_date`, sets a 4-hour SLA.
 * - On escalation: creates a follow-up task assigned to the account owner.
 * - On `resolved`: stamps `resolved_date` and bumps account `last_activity_date`.
 * - Declarative `condition` flags SLA breach when due date is past and case not closed.
 */

type ApiShape = {
  object: (n: string) => {
    findOne: (q: { filter: Record<string, unknown> }) => Promise<Record<string, unknown> | null>;
    update: (id: string, doc: Record<string, unknown>) => Promise<unknown>;
    insert: (doc: Record<string, unknown>) => Promise<unknown>;
  };
};

const caseValidation: Hook = {
  name: 'case_sla_defaults',
  object: 'case',
  events: ['beforeInsert', 'beforeUpdate'],
  priority: 200,
  description: 'Apply SLA defaults for critical cases.',
  handler: async (ctx: HookContext) => {
    const { input } = ctx;

    const isGuestSubmission = !ctx.previous && !ctx.user?.id;
    if (isGuestSubmission) {
      if (!input.origin)   input.origin   = 'web';
      if (!input.status)   input.status   = 'new';
      if (!input.priority) input.priority = 'medium';
      delete (input as Record<string, unknown>).owner;
      delete (input as Record<string, unknown>).is_escalated;
      delete (input as Record<string, unknown>).is_closed;
      delete (input as Record<string, unknown>).internal_notes;
      delete (input as Record<string, unknown>).resolution;
    }

    const priority =
      (typeof input.priority === 'string' && input.priority) ||
      (typeof ctx.previous?.priority === 'string' && (ctx.previous.priority as string)) ||
      undefined;
    if (priority === 'critical' && !input.sla_due_date && !ctx.previous?.sla_due_date) {
      const due = new Date();
      due.setHours(due.getHours() + 4);
      input.sla_due_date = due.toISOString();
    }
  },
};

const caseSideEffects: Hook = {
  name: 'case_status_side_effects',
  object: 'case',
  events: ['afterUpdate'],
  priority: 800,
  async: true,
  onError: 'log',
  description: 'Escalation tasks, resolved-date stamping, and account activity rollup.',
  handler: async (ctx: HookContext) => {
    const { input } = ctx;
    const previous = ctx.previous;
    if (!previous) return;
    const api = ctx.api as ApiShape | undefined;
    if (!api) return;

    const caseId =
      (typeof input.id === 'string' && input.id) ||
      (typeof previous.id === 'string' ? (previous.id as string) : undefined);
    const accountId =
      (typeof input.account === 'string' && input.account) ||
      (typeof previous.account === 'string' && previous.account) ||
      undefined;

    // Escalation: open task for account owner
    if (input.status === 'escalated' && previous.status !== 'escalated' && accountId) {
      const account = await api.object('account').findOne({ filter: { id: accountId } });
      const ownerId = (account as { owner?: string } | null)?.owner ?? ctx.user?.id;
      const due = new Date();
      due.setDate(due.getDate() + 1);
      await api.object('task').insert({
        subject: `Escalated case ${caseId ?? ''} needs attention`.trim(),
        status: 'not_started',
        priority: 'urgent',
        type: 'follow_up',
        due_date: due.toISOString().slice(0, 10),
        owner: ownerId,
        related_to_type: 'case',
        related_to_case: caseId,
        related_to_account: accountId,
      });
    }

    // Resolution rollup
    if (input.status === 'resolved' && previous.status !== 'resolved') {
      if (caseId && !input.closed_date && !previous.closed_date) {
        // Use closed_date as a proxy for resolved_date (schema field).
        await api.object('case').update(caseId, { closed_date: new Date().toISOString() });
      }
      if (accountId) {
        await api.object('account').update(accountId, {
          last_activity_date: new Date().toISOString().slice(0, 10),
        });
      }
    }
  },
};

export default [caseValidation, caseSideEffects];
