// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Action } from '@objectstack/spec/ui';
import { P } from '@objectstack/spec';

/**
 * Convert Lead to Account, Contact, and Opportunity.
 *
 * Flow-typed action: invocation is delegated to the `lead_conversion`
 * flow defined under `src/flows/`. The flow engine handles the screen
 * + server steps; no metadata body is required here.
 */
export const ConvertLeadAction: Action = {
  name: 'convert_lead',
  label: 'Convert Lead',
  objectName: 'lead',
  icon: 'arrow-right-circle',
  type: 'flow',
  target: 'lead_conversion',
  locations: ['record_header', 'list_item'],
  visible: P`record.status == "qualified" && record.is_converted == false`,
  confirmText: 'Are you sure you want to convert this lead?',
  successMessage: 'Lead converted successfully!',
  refreshAfter: true,
};

/**
 * Add selected leads to a Campaign.
 *
 * Modal-typed action: collects a campaign id then writes one
 * `campaign_member` record per selected lead via the metadata body.
 * Selected ids are surfaced through `input.selectedIds` (populated by
 * the list toolbar) and the chosen campaign through `input.campaign`.
 */
export const CreateCampaignAction: Action = {
  name: 'create_campaign',
  label: 'Add to Campaign',
  objectName: 'lead',
  icon: 'send',
  type: 'modal',
  target: 'create_campaign',
  body: {
    language: 'js',
    source: `
      const campaignId = input.campaign ?? null;
      if (!campaignId) throw new Error('create_campaign requires a campaign id');
      const ids = Array.isArray(input.selectedIds) ? input.selectedIds : [];
      const inserted = [];
      for (const leadId of ids) {
        const row = await ctx.api.object('campaign_member').insert({
          campaign_id: campaignId,
          lead_id: leadId,
          status: 'sent',
        });
        inserted.push(row?.id ?? null);
      }
      return { campaignId, count: inserted.length, ids: inserted };
    `,
    capabilities: ['api.write'],
    timeoutMs: 10000,
  },
  locations: ['list_toolbar'],
  params: [
    {
      name: 'campaign',
      label: 'Campaign',
      type: 'lookup',
      required: true,
    }
  ],
  successMessage: 'Leads added to campaign!',
  refreshAfter: true,
};
