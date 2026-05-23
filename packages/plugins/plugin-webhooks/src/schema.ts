// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Public schema subpath: `@objectstack/plugin-webhooks/schema`.
 *
 * Thin re-export barrel kept stable across refactors. The actual object
 * definition lives in `sys-webhook-delivery.object.ts` (matching the
 * `*.object.ts` convention used everywhere else in the monorepo for
 * `sys_*` schemas).
 *
 * Note: callers that just need the runtime should import from the
 * package root (`@objectstack/plugin-webhooks`), which auto-registers
 * `sys_webhook` + `sys_webhook_delivery` via the plugin manifest. This
 * subpath exists for the rare case where you want the schema without
 * installing the dispatcher plugin (e.g. read-only inspection from a
 * different runtime).
 */

export {
  SysWebhookDelivery,
  SYS_WEBHOOK_DELIVERY,
} from './sys-webhook-delivery.object.js';
