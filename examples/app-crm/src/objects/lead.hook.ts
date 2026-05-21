// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Hook, HookContext } from '@objectstack/spec/data';

/**
 * Lead automation hook.
 *
 * - Auto-scores incoming leads into `rating` (1-5) using industry/title/email/phone weights.
 * - Refuses edits to a converted lead.
 * - When status flips to `qualified`, schedules a follow-up `task` for the current user.
 */

type ApiShape = {
  object: (n: string) => {
    insert: (doc: Record<string, unknown>) => Promise<unknown>;
  };
};

const HIGH_VALUE_INDUSTRIES = new Set([
  'technology',
  'finance',
  'healthcare',
]);

const SENIOR_TITLE_PATTERN = /\b(ceo|cto|cfo|cio|coo|founder|vp|vice president|director|head of)\b/i;

function computeRating(input: Record<string, unknown>): number {
  let score = 0;
  const email = typeof input.email === 'string' ? input.email : '';
  const phone = typeof input.phone === 'string' ? input.phone : '';
  const title = typeof input.title === 'string' ? input.title : '';
  const industry = typeof input.industry === 'string' ? input.industry : '';
  const employees = typeof input.number_of_employees === 'number' ? input.number_of_employees : 0;
  const revenue = typeof input.annual_revenue === 'number' ? input.annual_revenue : 0;

  if (email && !/(gmail|yahoo|hotmail|outlook|qq|163)\.com$/i.test(email)) score += 1;
  if (phone.length > 0) score += 0.5;
  if (SENIOR_TITLE_PATTERN.test(title)) score += 1.5;
  if (HIGH_VALUE_INDUSTRIES.has(industry)) score += 1;
  if (employees >= 200) score += 0.5;
  if (revenue >= 10_000_000) score += 0.5;

  // Cap at 5, floor at 1, round to half.
  const clamped = Math.max(1, Math.min(5, score));
  return Math.round(clamped * 2) / 2;
}

const leadHook: Hook = {
  name: 'lead_automation',
  object: 'lead',
  events: ['beforeInsert', 'beforeUpdate', 'afterUpdate'],
  priority: 200,
  description:
    'Score new leads, lock converted leads, and create follow-up task on qualification.',
  handler: async (ctx: HookContext) => {
    const { event, input } = ctx;

    const HIGH_VALUE_INDUSTRIES = new Set(['technology', 'finance', 'healthcare']);
    const SENIOR_TITLE_PATTERN = /\b(ceo|cto|cfo|cio|coo|founder|vp|vice president|director|head of)\b/i;
    function computeRating(input: Record<string, unknown>): number {
      let score = 0;
      const email = typeof input.email === 'string' ? input.email : '';
      const phone = typeof input.phone === 'string' ? input.phone : '';
      const title = typeof input.title === 'string' ? input.title : '';
      const industry = typeof input.industry === 'string' ? input.industry : '';
      const employees = typeof input.number_of_employees === 'number' ? input.number_of_employees : 0;
      const revenue = typeof input.annual_revenue === 'number' ? input.annual_revenue : 0;
      if (email && !/(gmail|yahoo|hotmail|outlook|qq|163)\.com$/i.test(email)) score += 1;
      if (phone.length > 0) score += 0.5;
      if (SENIOR_TITLE_PATTERN.test(title)) score += 1.5;
      if (HIGH_VALUE_INDUSTRIES.has(industry)) score += 1;
      if (employees >= 200) score += 0.5;
      if (revenue >= 10_000_000) score += 0.5;
      const clamped = Math.max(1, Math.min(5, score));
      return Math.round(clamped * 2) / 2;
    }

    if (event === 'beforeInsert') {
      // Web-to-Lead: anonymous submissions from the public form get
      // sensible defaults stamped server-side so they cannot be spoofed
      // by the client. Guests are unauthenticated, so we identify them
      // by the absence of `ctx.user?.id`. (The `guest_portal` profile
      // already restricts them to INSERT-only on `lead`.)
      const isGuestSubmission = !ctx.user?.id;
      if (isGuestSubmission) {
        if (!input.lead_source) input.lead_source = 'web';
        if (!input.status)      input.status      = 'new';
        // Never trust client-supplied conversion / ownership fields on
        // a public form — strip them defensively.
        delete (input as Record<string, unknown>).is_converted;
        delete (input as Record<string, unknown>).converted_account;
        delete (input as Record<string, unknown>).converted_contact;
        delete (input as Record<string, unknown>).converted_opportunity;
        delete (input as Record<string, unknown>).converted_date;
        delete (input as Record<string, unknown>).owner;
      }

      if (typeof input.rating !== 'number') {
        input.rating = computeRating(input);
      }
    }

    if (event === 'beforeUpdate') {
      const previous = ctx.previous;
      if (previous?.is_converted === true || previous?.status === 'converted') {
        throw new Error('Cannot edit a converted lead. Make changes on the converted records instead.');
      }
    }

    if (event === 'afterUpdate') {
      const previous = ctx.previous;
      const becameQualified =
        input.status === 'qualified' && previous?.status !== 'qualified';
      if (!becameQualified) return;

      const api = ctx.api as ApiShape | undefined;
      if (!api) return;

      const leadId =
        (typeof input.id === 'string' && input.id) ||
        (typeof previous?.id === 'string' && previous.id) ||
        undefined;
      const ownerId =
        (typeof input.owner === 'string' && input.owner) ||
        (typeof previous?.owner === 'string' && previous.owner) ||
        ctx.user?.id;

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 2);

      try {
        await api.object('task').insert({
          subject: `Follow up with qualified lead${leadId ? ` (${leadId})` : ''}`,
          status: 'not_started',
          priority: 'high',
          type: 'follow_up',
          due_date: dueDate.toISOString().slice(0, 10),
          owner: ownerId,
          related_to_type: 'lead',
          related_to_lead: leadId,
        });
      } catch (err) {
        // Side-effect failure must not break the parent transaction.
        console.warn('[lead_automation] failed to create follow-up task:', err);
      }
    }
  },
};

export default leadHook;
