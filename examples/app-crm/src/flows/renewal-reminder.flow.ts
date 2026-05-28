// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Flow } from '@objectstack/spec/automation';

/**
 * Renewal Reminder Flow
 *
 * A schedule-triggered flow that runs daily. It queries opportunities closed
 * approximately 12 months ago and creates a renewal opportunity for each one
 * that does not already have a linked renewal.
 *
 * Demonstrates:
 *   • schedule-type flow with cron config
 *   • get_record for a multi-record query
 *   • script node used as an inline loop (forEach over results)
 *   • create_record inside conditional logic within a script
 *   • assignment for accumulating a counter variable
 *   • clean variables + errorHandling wiring
 */
export const RenewalReminderFlow: Flow = {
  name: 'renewal_reminder_flow',
  label: 'Daily Renewal Opportunity Creator',
  description:
    'Runs daily, finds closed-won opportunities with a close date ~12 months ago that have no renewal, and creates a renewal opportunity for each.',
  type: 'schedule',
  status: 'active',
  version: 1,
  runAs: 'system',

  variables: [
    { name: 'expiring_deals',   type: 'array',  isInput: false, isOutput: false },
    { name: 'renewals_created', type: 'number', isInput: false, isOutput: true  },
  ],

  errorHandling: {
    strategy: 'continue',
    fallbackNodeId: 'log_errors',
  },

  nodes: [
    // ── Start — daily at 07:00 UTC ─────────────────────────────────────────
    {
      id: 'start',
      type: 'start',
      label: 'Daily 07:00 UTC',
      config: {
        triggerType: 'schedule',
        cron: '0 7 * * *',
      },
      position: { x: 400, y: 0 },
    },

    // ── Init counter ──────────────────────────────────────────────────────
    {
      id: 'init_counter',
      type: 'assignment',
      label: 'Reset Renewal Counter',
      config: {
        assignments: [{ variable: 'renewals_created', value: 0 }],
      },
      position: { x: 400, y: 120 },
    },

    // ── Fetch expiring deals (close_date between 11 and 13 months ago) ─────
    {
      id: 'fetch_expiring',
      type: 'get_record',
      label: 'Fetch Deals Expiring ~12 Months Ago',
      config: {
        objectName: 'crm_opportunity',
        filter: {
          stage:      'closed_won',
          close_date: { $gte: '{daysAgo(395)}', $lte: '{daysAgo(335)}' },
          renewal_of: null,
        },
        outputVariable: 'expiring_deals',
        limit: 200,
      },
      outputSchema: {
        expiring_deals: { type: 'array', description: 'Deals eligible for renewal' },
      },
      position: { x: 400, y: 240 },
    },

    // ── Decision — any results? ────────────────────────────────────────────
    {
      id: 'decide_has_results',
      type: 'decision',
      label: 'Any Expiring Deals?',
      config: {
        conditions: [
          { label: 'Has deals',  expression: 'expiring_deals.length > 0' },
          { label: 'Nothing',    expression: 'true' },
        ],
      },
      position: { x: 400, y: 360 },
    },

    // ── Script — iterate over deals and create renewals ────────────────────
    //    (Script-as-loop avoids the partial loop executor gap noted in ADR.)
    {
      id: 'create_renewals',
      type: 'script',
      label: 'Create Renewal Opportunities',
      config: {
        script: `
          let count = 0;
          for (const deal of expiring_deals) {
            // Safety: skip if a renewal already exists (defensive; filter above should catch this)
            const existingRenewal = await objectql.findOne('crm_opportunity', {
              filter: { renewal_of: deal.id },
            });
            if (existingRenewal) continue;

            await objectql.insert('crm_opportunity', {
              name:       deal.name + ' — Renewal',
              account:    deal.account,
              stage:      'prospecting',
              amount:     deal.amount,
              probability: 20,
              close_date:  daysFromNow(90),
              renewal_of:  deal.id,
            });
            count++;
          }
          variables.renewals_created = count;
        `,
        outputVariables: ['renewals_created'],
      },
      position: { x: 400, y: 480 },
    },

    // ── Log summary ───────────────────────────────────────────────────────
    {
      id: 'log_summary',
      type: 'script',
      label: 'Log Renewal Run Summary',
      config: {
        script: `console.info('Renewal run complete — created', renewals_created, 'renewal opportunities.');`,
      },
      position: { x: 400, y: 600 },
    },

    // ── Error logger fallback ─────────────────────────────────────────────
    {
      id: 'log_errors',
      type: 'script',
      label: 'Log Flow Errors',
      config: {
        script: `console.error('renewal_reminder_flow encountered an error:', error);`,
      },
      position: { x: 700, y: 360 },
    },

    // ── End nodes ─────────────────────────────────────────────────────────
    { id: 'end_nothing',  type: 'end', label: 'No Expiring Deals Today', position: { x: 700, y: 480 } },
    { id: 'end_done',     type: 'end', label: 'Renewals Created',        position: { x: 400, y: 720 } },
    { id: 'end_error',    type: 'end', label: 'Error Handled',           position: { x: 700, y: 480 } },
  ],

  edges: [
    { id: 'e01', source: 'start',             target: 'init_counter' },
    { id: 'e02', source: 'init_counter',      target: 'fetch_expiring' },
    { id: 'e03', source: 'fetch_expiring',    target: 'decide_has_results' },
    { id: 'e04', source: 'decide_has_results', target: 'create_renewals', type: 'conditional', condition: 'expiring_deals.length > 0', label: 'Has Deals' },
    { id: 'e05', source: 'decide_has_results', target: 'end_nothing',     type: 'conditional', isDefault: true, label: 'Nothing to do' },
    { id: 'e06', source: 'create_renewals',   target: 'log_summary' },
    { id: 'e07', source: 'log_summary',       target: 'end_done' },
    // Fault paths
    { id: 'e08', source: 'fetch_expiring',    target: 'log_errors', type: 'fault', label: 'Query Failed' },
    { id: 'e09', source: 'create_renewals',   target: 'log_errors', type: 'fault', label: 'Create Failed' },
    { id: 'e10', source: 'log_errors',        target: 'end_error' },
  ],
};
