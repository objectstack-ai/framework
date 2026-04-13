// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineStack } from '@objectstack/spec';

// ─── Barrel Imports (one per metadata type) ─────────────────────────
import * as objects from './src/objects';
import * as actions from './src/actions';
import * as dashboards from './src/dashboards';
import * as reports from './src/reports';
import * as flows from './src/flows';
import * as apps from './src/apps';
import * as translations from './src/translations';

// ─── Action Handler Registration (runtime lifecycle) ────────────────
// Handlers are wired separately from metadata. The `onEnable` export
// is called by the kernel's AppPlugin after the engine is ready.
// See: src/actions/register-handlers.ts for the full registration flow.
import { registerTaskActionHandlers } from './src/actions/register-handlers';

/**
 * Plugin lifecycle hook — called by AppPlugin when the engine is ready.
 * This is where action handlers are registered on the ObjectQL engine.
 */
export const onEnable = async (ctx: { ql: { registerAction: (...args: unknown[]) => void } }) => {
  registerTaskActionHandlers(ctx.ql);
};

export default defineStack({
  manifest: {
    id: 'com.example.todo',
    namespace: 'todo',
    version: '2.0.0',
    type: 'app',
    name: 'Todo Manager',
    description: 'A comprehensive Todo app demonstrating ObjectStack Protocol features including automation, dashboards, and reports',
  },

  // Seed Data (top-level, registered as metadata)
  data: [
    {
      object: 'task',
      mode: 'upsert' as const,
      externalId: 'subject',
      records: [
        { subject: 'Learn ObjectStack', status: 'completed', priority: 'high', category: 'work' },
        { subject: 'Build a cool app', status: 'in_progress', priority: 'normal', category: 'work', due_date: new Date(Date.now() + 86400000 * 3) },
        { subject: 'Review PR #102', status: 'completed', priority: 'high', category: 'work' },
        { subject: 'Write Documentation', status: 'not_started', priority: 'normal', category: 'work', due_date: new Date(Date.now() + 86400000) },
        { subject: 'Fix Server bug', status: 'waiting', priority: 'urgent', category: 'work' },
        { subject: 'Buy groceries', status: 'not_started', priority: 'low', category: 'shopping', due_date: new Date() },
        { subject: 'Schedule dentist appointment', status: 'not_started', priority: 'normal', category: 'health', due_date: new Date(Date.now() + 86400000 * 7) },
        { subject: 'Pay utility bills', status: 'not_started', priority: 'high', category: 'finance', due_date: new Date(Date.now() + 86400000 * 2) },
      ]
    }
  ],

  // Auto-collected from barrel index files via Object.values()
  objects: Object.values(objects),
  actions: Object.values(actions),
  dashboards: Object.values(dashboards),
  reports: Object.values(reports),
  flows: Object.values(flows) as any,
  apps: Object.values(apps),

  // I18n Configuration — per-locale file organization
  i18n: {
    defaultLocale: 'en',
    supportedLocales: ['en', 'zh-CN', 'ja-JP'],
    fallbackLocale: 'en',
    fileOrganization: 'per_locale',
  },

  // I18n Translation Bundles (en, zh-CN, ja-JP)
  translations: Object.values(translations),
});

