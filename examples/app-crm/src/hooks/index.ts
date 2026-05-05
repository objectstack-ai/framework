// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Hooks Barrel
 *
 * Re-exports every `*.hook.ts` definition so they can be passed straight
 * into `defineStack({ hooks: allHooks })`. The `AppPlugin` then auto-binds
 * them onto the ObjectQL engine — no manual `engine.registerHook(...)`
 * wiring required.
 */

import type { Hook } from '@objectstack/spec/data';

import accountHook from '../objects/account.hook';
import campaignHook from '../objects/campaign.hook';
import caseHook from '../objects/case.hook';
import contactHook from '../objects/contact.hook';
import contractHook from '../objects/contract.hook';
import leadHook from '../objects/lead.hook';
import opportunityHook from '../objects/opportunity.hook';
import productHook from '../objects/product.hook';
import quoteHook from '../objects/quote.hook';
import taskHook from '../objects/task.hook';

const entries: Array<Hook | Hook[]> = [
  accountHook,
  campaignHook,
  caseHook,
  contactHook,
  contractHook,
  leadHook,
  opportunityHook,
  productHook,
  quoteHook,
  taskHook,
];

/** Flat list of every CRM lifecycle hook (each `*.hook.ts` may export one or many). */
export const allHooks: Hook[] = entries.flatMap((entry) =>
  Array.isArray(entry) ? entry : [entry],
);
