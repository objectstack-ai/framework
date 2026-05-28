// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineStack } from '@objectstack/spec';

import * as objects from './src/objects/index.js';
import * as views from './src/views/index.js';
import * as apps from './src/apps/index.js';
import * as dashboards from './src/dashboards/index.js';
import * as reports from './src/reports/index.js';
import * as pages from './src/pages/index.js';
import * as actions from './src/actions/index.js';
import * as emails from './src/emails/index.js';
import { allHooks } from './src/hooks/index.js';
import { allFlows } from './src/flows/index.js';
import { HighValueDealWorkflow, StaleOpportunityWorkflow } from './src/workflows/index.js';
import { DiscountApprovalProcess } from './src/approvals/index.js';
import {
  SalesAssistantAgent,
  LookupContactTool,
  DealManagementSkill,
} from './src/agents/index.js';
import {
  SalesRepRole,
  SalesManagerRole,
  FinanceApproverRole,
  SalesUserPermissionSet,
} from './src/security/index.js';
import { CrmSeedData } from './src/data/index.js';

/**
 * CRM example — exercises the full metadata loading pipeline with at
 * least one record of every form-bearing metadata type so the Studio
 * metadata-admin UI can be developed and validated against real data.
 *
 * For a full enterprise reference (10+ objects, RAG, sharing rules,
 * etc.) see https://github.com/objectstack-ai/hotcrm
 */
export default defineStack({
  manifest: {
    id: 'com.example.crm',
    namespace: 'crm',
    version: '4.0.0',
    type: 'app',
    name: 'CRM (minimal example)',
    description: 'Minimal CRM workspace used by the framework to validate the metadata loading pipeline end-to-end.',
  },

  // Auto-resolved by the CLI; `ui` enables the Studio shell.
  requires: ['ui'],

  // Data
  objects: Object.values(objects),

  // UI
  apps: Object.values(apps),
  views: Object.values(views),
  pages: Object.values(pages),
  dashboards: Object.values(dashboards),
  reports: Object.values(reports),
  actions: Object.values(actions),

  // Logic
  hooks: allHooks,
  flows: allFlows,
  workflows: [HighValueDealWorkflow, StaleOpportunityWorkflow],
  approvals: [DiscountApprovalProcess],

  // AI
  agents: [SalesAssistantAgent],
  skills: [DealManagementSkill],

  // Security
  roles: [SalesRepRole, SalesManagerRole, FinanceApproverRole],
  permissions: [SalesUserPermissionSet],

  // Seed data
  data: CrmSeedData,
});

/**
 * Reference templates for metadata types not (yet) wired into a
 * top-level defineStack collection. The Studio metadata-admin UI
 * can copy from these when authoring.
 */
export const referenceMetadata = {
  tools: [LookupContactTool],
  emailTemplates: Object.values(emails),
};
