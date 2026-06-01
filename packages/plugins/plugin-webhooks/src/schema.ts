// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Public schema subpath: `@objectstack/plugin-webhooks/schema`.
 *
 * Thin re-export barrel kept stable across refactors. The actual object
 * definitions live in `sys-webhook.object.ts` and
 * `sys-webhook-delivery.object.ts` (matching the `*.object.ts` convention
 * used everywhere else in the monorepo for `sys_*` schemas).
 *
 * `sys_webhook` moved here from `@objectstack/platform-objects` per
 * ADR-0029 (K2.a) so this plugin owns both of its objects.
 *
 * Note: callers that just need the runtime should import from the
 * package root (`@objectstack/plugin-webhooks`), which auto-registers
 * `sys_webhook` + `sys_webhook_delivery` via the plugin manifest. This
 * subpath exists for the rare case where you want the schema without
 * installing the dispatcher plugin (e.g. read-only inspection from a
 * different runtime).
 */

export { SysWebhook } from './sys-webhook.object.js';
export {
  SysWebhookDelivery,
  SYS_WEBHOOK_DELIVERY,
} from './sys-webhook-delivery.object.js';
