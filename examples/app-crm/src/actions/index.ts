// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Action Definitions Barrel
 *
 * Exports action metadata definitions only. Used by `Object.values()` in
 * objectstack.config.ts to auto-collect all action declarations for defineStack().
 *
 * **Handler functions** are exported from `./handlers/` — see register-handlers.ts
 * for the complete registration flow.
 */
export { EscalateCaseAction, CloseCaseAction } from './case.actions';
export { MarkPrimaryContactAction, SendEmailAction } from './contact.actions';
export { LogCallAction, ExportToCsvAction } from './global.actions';
export { ConvertLeadAction, CreateCampaignAction } from './lead.actions';
export { CloneOpportunityAction, MassUpdateStageAction } from './opportunity.actions';
