// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineStack } from '@objectstack/spec';
import * as cubes from './src/cubes/index.js';

import * as objects from './src/objects/index.js';
import * as actions from './src/actions/index.js';
import * as dashboards from './src/dashboards/index.js';
import * as reports from './src/reports/index.js';
import { allFlows } from './src/flows/index.js';
import { allAgents } from './src/agents/index.js';
import { allSkills } from './src/skills/index.js';
import * as ragPipelines from './src/rag/index.js';
import * as profiles from './src/profiles/index.js';
import * as apps from './src/apps/index.js';
import * as views from './src/views/index.js';
import * as pages from './src/pages/index.js';
import * as approvals from './src/approvals/index.js';
import * as translations from './src/translations/index.js';
import { CrmSeedData } from './src/data/index.js';

import {
  AccountTeamSharingRule, TerritorySharingRules,
  OpportunitySalesSharingRule,
  CaseEscalationSharingRule,
  RoleHierarchy,
} from './src/sharing/index.js';

import { allHooks } from './src/hooks/index.js';

export default defineStack({
  manifest: {
    id: 'com.example.crm',
    namespace: 'crm',
    version: '3.0.0',
    type: 'app',
    name: 'Enterprise CRM',
    description: 'Comprehensive enterprise CRM demonstrating all ObjectStack Protocol features including AI, security, and automation',
  },

  // ─── Platform capabilities this app needs ─────────────────────────
  // The runtime resolves each capability name to a built-in service plugin
  // and auto-loads it (with extras like Automation's node packs). No need
  // to hand-instantiate plugins or pass `--preset` flags. See
  // packages/cli/src/commands/serve.ts CAPABILITY_PROVIDERS for the
  // complete map; explicit `plugins: [...]` always shadows the resolver.
  // `auth` enables /api/v1/auth/* (login/register) via @objectstack/plugin-auth.
  // `ui`   serves the Studio shell and CRM apps under /_studio/.
  // Both are required for a clickable login flow when running `objectstack start`
  // off the compiled artifact.
  // Note: the foundational slate (queue, job, cache, settings, email,
  // storage) is auto-injected by the CLI for every non-`minimal`
  // preset — see `ALWAYS_CAPS` in packages/cli/src/commands/serve.ts.
  // Listed below only the *opt-in* capabilities this stack actually
  // wants on top of that slate.
  requires: ['ai', 'automation', 'analytics', 'auth', 'ui', 'approvals', 'sharing', 'webhooks'],

  objects: Object.values(objects),
  actions: Object.values(actions),
  dashboards: Object.values(dashboards),
  reports: Object.values(reports),
  flows: allFlows,
  agents: allAgents,
  skills: allSkills,
  ragPipelines: Object.values(ragPipelines),
  permissions: Object.values(profiles),
  apps: Object.values(apps),
  views: Object.values(views),
  pages: Object.values(pages),
  approvals: Object.values(approvals),
  analyticsCubes: Object.values(cubes),

  hooks: allHooks,

  data: CrmSeedData,

  i18n: {
    defaultLocale: 'en',
    supportedLocales: ['en', 'zh-CN', 'ja-JP', 'es-ES'],
    fallbackLocale: 'en',
    fileOrganization: 'per_locale',
  },

  translations: Object.values(translations),

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
