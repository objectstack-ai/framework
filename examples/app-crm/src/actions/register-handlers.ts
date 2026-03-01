// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Action Handler Registration — Enterprise CRM
 *
 * Demonstrates the complete lifecycle for wiring action handler functions
 * to their declarative action definitions across all CRM domains.
 *
 * ## Architecture
 *
 * ```
 * ┌──────────────────────┐
 * │   objectstack.config  │  defineStack() — declarative metadata only
 * │   ├─ actions[]        │  Action definitions with `target` strings
 * │   ├─ objects[]        │  Object schemas
 * │   └─ flows[]          │  Flow definitions
 * └──────────┬───────────┘
 *            │ AppPlugin.start()
 *            ▼
 * ┌──────────────────────┐
 * │   onEnable(ctx)       │  Plugin lifecycle hook
 * │   └─ ctx.ql           │  ObjectQL engine reference
 * └──────────┬───────────┘
 *            │ registerCrmActionHandlers(ctx.ql)
 *            ▼
 * ┌──────────────────────┐
 * │ engine.registerAction │  Binds target → handler function
 * │ ('lead',              │
 * │  'convertLead',       │  ← matches action target string
 * │  convertLead)         │  ← actual function implementation
 * └──────────────────────┘
 * ```
 *
 * ## Action Type → Handler Mapping
 *
 * | Action Type | Handler Location | Registration |
 * |-------------|-----------------|--------------|
 * | `script`    | `*.handlers.ts` | `engine.registerAction()` |
 * | `modal`     | `*.handlers.ts` | `engine.registerAction()` — processes modal form |
 * | `flow`      | Flow engine     | Auto-resolved via `flows[]` definition |
 * | `url`       | Browser/UI      | No server handler needed |
 * | `api`       | API routes      | Auto-resolved via `apis[]` definition |
 *
 * @see handlers/ — Handler function implementations per domain
 */

import {
  convertLead,
  addToCampaign,
  cloneRecord,
  massUpdateStage,
  escalateCase,
  closeCase,
  markAsPrimaryContact,
  sendEmail,
  exportToCSV,
  logCall,
} from './handlers';

/**
 * Register all CRM action handlers on the ObjectQL engine.
 *
 * @param engine - The ObjectQL engine instance
 *
 * @example Usage in plugin lifecycle:
 * ```ts
 * import { registerCrmActionHandlers } from './src/actions/register-handlers';
 *
 * export const onEnable = async (ctx: { ql: ObjectQL }) => {
 *   registerCrmActionHandlers(ctx.ql);
 * };
 * ```
 */
export function registerCrmActionHandlers(engine: {
  registerAction(objectName: string, actionName: string, handler: Function): void;
}): void {
  // ─── Lead Domain ───────────────────────────────────────────────────
  // ConvertLeadAction (type: flow) — also has server-side handler for
  // programmatic conversion outside the screen flow.
  engine.registerAction('lead', 'convertLead', convertLead);
  // CreateCampaignAction (type: modal) — processes campaign assignment form
  engine.registerAction('lead', 'addToCampaign', addToCampaign);

  // ─── Opportunity Domain ────────────────────────────────────────────
  // CloneOpportunityAction (type: script)
  engine.registerAction('opportunity', 'cloneRecord', cloneRecord);
  // MassUpdateStageAction (type: modal) — processes stage selection form
  engine.registerAction('opportunity', 'massUpdateStage', massUpdateStage);

  // ─── Case Domain ───────────────────────────────────────────────────
  // EscalateCaseAction (type: modal) — processes escalation reason form
  engine.registerAction('case', 'escalateCase', escalateCase);
  // CloseCaseAction (type: modal) — processes resolution form
  engine.registerAction('case', 'closeCase', closeCase);

  // ─── Contact Domain ────────────────────────────────────────────────
  // MarkPrimaryContactAction (type: script)
  engine.registerAction('contact', 'markAsPrimaryContact', markAsPrimaryContact);
  // SendEmailAction (type: modal) — processes email composer form
  engine.registerAction('contact', 'sendEmail', sendEmail);

  // ─── Global (cross-domain) ─────────────────────────────────────────
  // ExportToCsvAction (type: script) — wildcard '*' applies to all objects
  engine.registerAction('*', 'exportToCSV', exportToCSV);
  // LogCallAction (type: modal) — processes call log form
  engine.registerAction('*', 'logCall', logCall);
}
