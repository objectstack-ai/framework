// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineStack } from '@objectstack/spec';
import {
  AutomationServicePlugin,
  ScreenNodesPlugin,
  CrudNodesPlugin,
  LogicNodesPlugin,
  HttpConnectorPlugin,
} from '@objectstack/service-automation';

// ─── Barrel Imports (one per metadata type) ─────────────────────────
import * as objects from './src/objects';
import * as apis from './src/apis';
import * as actions from './src/actions';
import * as dashboards from './src/dashboards';
import * as reports from './src/reports';
import { allFlows } from './src/flows';
import { allAgents } from './src/agents';
import * as ragPipelines from './src/rag';
import * as profiles from './src/profiles';
import * as apps from './src/apps';
import * as translations from './src/translations';
import { CrmSeedData } from './src/data';

// ─── Sharing & Security (special: mixed single/array values) ───────
import {
  AccountTeamSharingRule, TerritorySharingRules,
  OpportunitySalesSharingRule,
  CaseEscalationSharingRule,
  RoleHierarchy,
} from './src/sharing';

// ─── Action Handler Registration (runtime lifecycle) ────────────────
// Handlers are wired separately from metadata. The `onEnable` export
// is called by the kernel's AppPlugin after the engine is ready.
// See: src/actions/register-handlers.ts for the full registration flow.
import { registerCrmActionHandlers } from './src/actions/register-handlers';

/**
 * Plugin lifecycle hook — called by AppPlugin when the engine is ready.
 * This is where action handlers are registered on the ObjectQL engine.
 */
export const onEnable = async (ctx: { ql: { registerAction: (...args: unknown[]) => void } }) => {
  registerCrmActionHandlers(ctx.ql);
};

export default defineStack({
  manifest: {
    id: 'com.example.crm',
    namespace: 'crm',
    version: '3.0.0',
    type: 'app',
    name: 'Enterprise CRM',
    description: 'Comprehensive enterprise CRM demonstrating all ObjectStack Protocol features including AI, security, and automation',
  },

  // Runtime plugins — register the AutomationEngine and its node executors so
  // server-side flows (e.g. `lead_conversion`) can run end-to-end. CLI serve
  // does NOT auto-register automation; it must be opted-in here.
  plugins: [
    new AutomationServicePlugin(),
    new CrudNodesPlugin(),
    new LogicNodesPlugin(),
    new HttpConnectorPlugin(),
    new ScreenNodesPlugin(),
  ],

  // Auto-collected from barrel index files via Object.values()
  objects: Object.values(objects),
  apis: Object.values(apis),
  actions: Object.values(actions),
  dashboards: Object.values(dashboards),
  reports: Object.values(reports),
  flows: allFlows,
  agents: allAgents,
  ragPipelines: Object.values(ragPipelines),
  permissions: Object.values(profiles),
  apps: Object.values(apps),

  // Seed Data (top-level, registered as metadata)
  data: CrmSeedData,

  // I18n Configuration — per-locale file organization
  i18n: {
    defaultLocale: 'en',
    supportedLocales: ['en', 'zh-CN', 'ja-JP', 'es-ES'],
    fallbackLocale: 'en',
    fileOrganization: 'per_locale',
  },

  // I18n Translation Bundles (en, zh-CN, ja-JP, es-ES)
  translations: Object.values(translations),

  // Sharing & security
  sharingRules: [
    AccountTeamSharingRule,
    OpportunitySalesSharingRule,
    CaseEscalationSharingRule,
    ...TerritorySharingRules,
  ],
  roles: RoleHierarchy.roles.map((r: { name: string; label: string; parentRole: string | null }) => ({
    name: r.name,
    label: r.label,
    parent: r.parentRole ?? undefined,
  })),
});
