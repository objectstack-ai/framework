// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Action } from '@objectstack/spec/ui';
import { P } from '@objectstack/spec';

/**
 * Escalate Case.
 *
 * Modal-typed action: the UI collects `reason` then POSTs to
 * `/api/v1/actions/case/escalate_case`. The body runs in the QuickJS
 * sandbox via `actionBodyRunnerFactory`, gated by `api.write`.
 */
export const EscalateCaseAction: Action = {
  name: 'escalate_case',
  label: 'Escalate Case',
  objectName: 'case',
  icon: 'alert-triangle',
  type: 'modal',
  target: 'escalate_case',
  body: {
    language: 'js',
    source: `
      const id = ctx.recordId;
      if (!id) throw new Error('escalate_case requires a recordId');
      await ctx.api.object('case').update({
        id,
        is_escalated: true,
        escalation_reason: input.reason ?? null,
        escalated_by: ctx.user?.id ?? null,
        escalated_at: new Date().toISOString(),
        priority: 'urgent',
      }, { where: { id } });
      return { ok: true, id };
    `,
    capabilities: ['api.write'],
    timeoutMs: 5000,
  },
  locations: ['record_header', 'list_item'],
  visible: P`record.is_escalated == false && record.is_closed == false`,
  params: [
    {
      name: 'reason',
      label: 'Escalation Reason',
      type: 'textarea',
      required: true,
    }
  ],
  confirmText: 'This will escalate the case to the escalation team. Continue?',
  successMessage: 'Case escalated successfully!',
  refreshAfter: true,
};

/**
 * Close Case.
 *
 * Modal-typed action: collects `resolution` then closes the case via
 * the metadata body. Runs sandboxed under `api.write`.
 */
export const CloseCaseAction: Action = {
  name: 'close_case',
  label: 'Close Case',
  objectName: 'case',
  icon: 'check-circle',
  type: 'modal',
  target: 'close_case',
  body: {
    language: 'js',
    source: `
      const id = ctx.recordId;
      if (!id) throw new Error('close_case requires a recordId');
      await ctx.api.object('case').update({
        id,
        is_closed: true,
        resolution: input.resolution ?? null,
        closed_by: ctx.user?.id ?? null,
        closed_at: new Date().toISOString(),
        status: 'closed',
      }, { where: { id } });
      return { ok: true, id };
    `,
    capabilities: ['api.write'],
    timeoutMs: 5000,
  },
  locations: ['record_header'],
  visible: P`record.is_closed == false`,
  params: [
    {
      name: 'resolution',
      label: 'Resolution',
      type: 'textarea',
      required: true,
    }
  ],
  confirmText: 'Are you sure you want to close this case?',
  successMessage: 'Case closed successfully!',
  refreshAfter: true,
};
