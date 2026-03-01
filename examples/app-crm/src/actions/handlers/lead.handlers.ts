// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Lead Action Handlers
 *
 * Handler implementations for lead-domain actions defined in lead.actions.ts.
 * The `ConvertLeadAction` (type: flow) is handled by the flow engine;
 * `CreateCampaignAction` (type: modal) is handled by the UI modal system.
 *
 * This file provides the server-side logic backing these actions.
 *
 * @example Registration:
 * ```ts
 * engine.registerAction('lead', 'convertLead', convertLead);
 * ```
 */

interface ActionContext {
  record: Record<string, unknown>;
  user: { id: string; name: string };
  engine: {
    update(object: string, id: string, data: Record<string, unknown>): Promise<void>;
    insert(object: string, data: Record<string, unknown>): Promise<{ _id: string }>;
    find(object: string, query: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  };
  params?: Record<string, unknown>;
}

/** Convert a qualified lead into Account, Contact, and Opportunity records */
export async function convertLead(ctx: ActionContext): Promise<{
  accountId: string;
  contactId: string;
  opportunityId: string;
}> {
  const { record, engine, user } = ctx;

  const account = await engine.insert('account', {
    name: record.company as string,
    website: record.website,
    industry: record.industry,
    created_by: user.id,
  });

  const contact = await engine.insert('contact', {
    first_name: record.first_name,
    last_name: record.last_name,
    email: record.email,
    phone: record.phone,
    account_id: account._id,
  });

  const opportunity = await engine.insert('opportunity', {
    name: `${record.company} - New Opportunity`,
    account_id: account._id,
    contact_id: contact._id,
    stage: 'prospecting',
    amount: record.estimated_value ?? 0,
  });

  await engine.update('lead', record._id as string, {
    is_converted: true,
    status: 'converted',
    converted_account_id: account._id,
    converted_contact_id: contact._id,
    converted_opportunity_id: opportunity._id,
  });

  return {
    accountId: account._id,
    contactId: contact._id,
    opportunityId: opportunity._id,
  };
}

/** Add selected leads to a campaign */
export async function addToCampaign(ctx: ActionContext): Promise<void> {
  const { params, engine } = ctx;
  const campaignId = params?.campaign as string;
  const leadIds = (params?.selectedIds ?? []) as string[];
  for (const leadId of leadIds) {
    await engine.insert('campaign_member', {
      campaign_id: campaignId,
      lead_id: leadId,
      status: 'sent',
    });
  }
}
