// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineFlow } from '@objectstack/spec';

/**
 * Convert Lead to Opportunity — Screen Flow
 *
 * A user-triggered wizard that walks a sales rep through converting a
 * qualified lead into an Opportunity record. Demonstrates every key
 * screen-flow node type:
 *
 *   start → get_lead → decision (already converted?)
 *     → already_converted_screen (abort path)
 *     → screen_qualify   (collect opportunity details from rep)
 *     → screen_confirm   (review + confirm before writing)
 *     → create_opp       (create crm_opportunity)
 *     → update_lead      (mark lead as converted)
 *     → screen_success   (celebrate + navigate)
 *     → end
 */
export const ConvertLeadScreenFlow = defineFlow({
  name: 'crm_convert_lead_wizard',
  label: 'Convert Lead to Opportunity',
  description:
    'Screen flow wizard that converts a qualified CRM lead into an Opportunity, marks the lead as converted, and links the two records.',
  type: 'screen',
  status: 'active',
  runAs: 'user',

  variables: [
    // ── inputs (from action trigger) ───────────────────────────────────
    { name: 'recordId',          type: 'text',    isInput: true,  isOutput: false },
    // ── screen-collected inputs (filled by wizard steps) ──────────────
    // Marked isInput:true so the trigger API can pre-populate them for
    // automated testing or when the Studio wizard submits all values at once.
    { name: 'opp_name',          type: 'text',    isInput: true,  isOutput: false },
    { name: 'opp_account',       type: 'text',    isInput: true,  isOutput: false },
    { name: 'opp_amount',        type: 'number',  isInput: true,  isOutput: false },
    { name: 'opp_close_date',    type: 'date',    isInput: true,  isOutput: false },
    { name: 'opp_stage',         type: 'text',    isInput: true,  isOutput: false },
    // ── intermediate (populated at runtime) ───────────────────────────
    { name: 'lead_record',       type: 'object',  isInput: false, isOutput: false },
    // ── outputs ───────────────────────────────────────────────────────
    { name: 'opportunity_id',    type: 'text',    isInput: false, isOutput: true  },
  ],

  nodes: [
    // ── 1. Start ──────────────────────────────────────────────────────
    { id: 'start', type: 'start', label: 'Start' },

    // ── 2. Load the lead record ───────────────────────────────────────
    {
      id: 'get_lead',
      type: 'get_record',
      label: 'Load Lead',
      config: {
        objectName: 'crm_lead',
        recordId: '{recordId}',
        outputVariable: 'lead_record',
      },
    },

    // ── 3. Guard: already converted? ──────────────────────────────────
    {
      id: 'check_converted',
      type: 'decision',
      label: 'Already Converted?',
      config: {
        conditions: [
          { label: 'Yes — already converted', expression: "{lead_record.status} == 'converted'" },
          { label: 'No — proceed',             expression: 'true' },
        ],
      },
    },

    // ── 3a. Already-converted abort screen ────────────────────────────
    {
      id: 'screen_already_converted',
      type: 'screen',
      label: 'Already Converted',
      config: {
        message: 'This lead has already been converted to an opportunity.',
        buttons: [
          { label: 'Close', action: 'finish' },
        ],
      },
    },

    // ── 4. Screen 1: Collect qualification + opportunity details ───────
    {
      id: 'screen_qualify',
      type: 'screen',
      label: 'Opportunity Details',
      config: {
        fields: [
          {
            name: 'opp_name',
            label: 'Opportunity Name',
            type: 'text',
            required: true,
            defaultValue: '{lead_record.name}',
            helpText: 'Descriptive name for the new opportunity',
          },
          {
            name: 'opp_account',
            label: 'Account',
            type: 'lookup',
            object: 'crm_account',
            required: false,
            defaultValue: '{lead_record.account}',
            helpText: 'The account this opportunity belongs to',
          },
          {
            name: 'opp_amount',
            label: 'Estimated Value ($)',
            type: 'number',
            required: false,
            min: 0,
          },
          {
            name: 'opp_close_date',
            label: 'Expected Close Date',
            type: 'date',
            required: false,
          },
          {
            name: 'opp_stage',
            label: 'Stage',
            type: 'select',
            required: true,
            options: ['prospecting', 'qualification', 'proposal', 'closed_won', 'closed_lost'],
            defaultValue: 'qualification',
          },
        ],
      },
    },

    // ── 5. Screen 2: Confirm before write ─────────────────────────────
    {
      id: 'screen_confirm',
      type: 'screen',
      label: 'Confirm Conversion',
      config: {
        message: 'Create opportunity "{opp_name}" for lead "{lead_record.name}"?\n\nStage: {opp_stage} · Amount: ${opp_amount} · Close: {opp_close_date}',
        buttons: [
          { label: 'Convert', action: 'next' },
          { label: 'Back',    action: 'back' },
          { label: 'Cancel',  action: 'finish' },
        ],
      },
    },

    // ── 6. Create the Opportunity ─────────────────────────────────────
    {
      id: 'create_opp',
      type: 'create_record',
      label: 'Create Opportunity',
      config: {
        objectName: 'crm_opportunity',
        fields: {
          name:       '{opp_name}',
          account:    '{opp_account}',
          amount:     '{opp_amount}',
          close_date: '{opp_close_date}',
          stage:      '{opp_stage}',
        },
        outputVariable: 'opportunity_id',
      },
    },

    // ── 7. Mark the lead as converted ─────────────────────────────────
    {
      id: 'update_lead',
      type: 'update_record',
      label: 'Mark Lead Converted',
      config: {
        objectName: 'crm_lead',
        filter: { id: '{recordId}' },
        fields: {
          status:                  'converted',
          converted_opportunity:   '{opportunity_id}',
          is_closed:               true,
        },
      },
    },

    // ── 8. Success screen ─────────────────────────────────────────────
    {
      id: 'screen_success',
      type: 'screen',
      label: 'Conversion Complete',
      config: {
        message: '✅ Lead converted! Opportunity "{opp_name}" has been created.',
        buttons: [
          { label: 'View Opportunity', action: 'navigate', target: '/crm_opportunity/{opportunity_id}' },
          { label: 'Done',             action: 'finish' },
        ],
      },
    },

    // ── 9. End ────────────────────────────────────────────────────────
    { id: 'end', type: 'end', label: 'End' },
  ],

  edges: [
    { id: 'e1',  source: 'start',                    target: 'get_lead',                  type: 'default' },
    { id: 'e2',  source: 'get_lead',                 target: 'check_converted',            type: 'default' },
    // guard branches
    { id: 'e3a', source: 'check_converted',          target: 'screen_already_converted',   type: 'default', condition: "{lead_record.status} == 'converted'", label: 'Yes' },
    { id: 'e3b', source: 'check_converted',          target: 'screen_qualify',             type: 'default', label: 'No' },
    { id: 'e3c', source: 'screen_already_converted', target: 'end',                        type: 'default' },
    // main path
    { id: 'e4',  source: 'screen_qualify',           target: 'screen_confirm',             type: 'default' },
    // "Convert" proceeds to create the record; "Back" is handled client-side
    // by the screen-flow runner's history stack — no server back-edge needed
    // (a back-edge would create a cycle and fail DAG validation).
    { id: 'e5',  source: 'screen_confirm',           target: 'create_opp',                 type: 'default' },
    { id: 'e7',  source: 'create_opp',               target: 'update_lead',                type: 'default' },
    { id: 'e8',  source: 'update_lead',              target: 'screen_success',             type: 'default' },
    { id: 'e9',  source: 'screen_success',           target: 'end',                        type: 'default' },
  ],

  errorHandling: {
    strategy: 'fail',
    maxRetries: 0,
    retryDelayMs: 0,
    backoffMultiplier: 1,
    maxRetryDelayMs: 0,
    jitter: false,
  },
});
