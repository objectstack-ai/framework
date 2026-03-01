// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineStack } from '@objectstack/spec';

// ─── Barrel Imports (one per metadata type) ─────────────────────────
import * as objects from './src/objects';
import * as apis from './src/apis';
import * as actions from './src/actions';
import * as dashboards from './src/dashboards';
import * as reports from './src/reports';
import * as flows from './src/flows';
import * as agents from './src/agents';
import * as ragPipelines from './src/rag';
import * as profiles from './src/profiles';
import * as apps from './src/apps';
import * as interfaces from './src/interfaces';
import * as translations from './src/translations';
import { CrmSeedData } from './src/data';

// ─── Sharing & Security (special: mixed single/array values) ───────
import {
  OrganizationDefaults,
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
export const onEnable = async (ctx: { ql: { registerAction: Function } }) => {
  registerCrmActionHandlers(ctx.ql as any);
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

  // Auto-collected from barrel index files via Object.values()
  objects: Object.values(objects),
  apis: Object.values(apis),
  actions: Object.values(actions),
  dashboards: Object.values(dashboards),
  reports: Object.values(reports),
  flows: Object.values(flows) as any,
  agents: Object.values(agents) as any,
  ragPipelines: Object.values(ragPipelines),
  profiles: Object.values(profiles),
  apps: Object.values(apps),
  interfaces: Object.values(interfaces),

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

  // Sharing & security (requires explicit wiring)
  sharingRules: [
    AccountTeamSharingRule,
    OpportunitySalesSharingRule,
    CaseEscalationSharingRule,
    ...TerritorySharingRules,
  ],
  roleHierarchy: RoleHierarchy,
  organizationDefaults: OrganizationDefaults,
} as any);
