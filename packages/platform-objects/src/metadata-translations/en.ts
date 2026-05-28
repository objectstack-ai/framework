// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { TranslationData } from '@objectstack/spec/system';

/**
 * English (en) — Metadata-Type Form Translations
 *
 * Source-language bundle. Mirrors the `metadataForms.*` namespace for
 * the top-5 form-bearing metadata types (object / field / agent / flow /
 * view). Most entries are intentionally left implicit: at render time
 * `resolveMetadataFormLabels` falls back to the inline literals carried
 * on each `*.form.ts` schema, so authoring English content for every
 * field is unnecessary. This file exists to (a) anchor the `en` slot in
 * the bundle and (b) override any specific entry where the inline form
 * literal differs from the desired display string.
 */
export const en: TranslationData = {
  metadataForms: {
    object: {},
    field: {},
    agent: {},
    flow: {},
    view: {},
    tool: {},
    skill: {},
    workflow: {},
    approval: {},
    role: {},
    action: {},
    app: {},
    page: {},
    dashboard: {},
    report: {},
    hook: {},
    permission: {},
    email_template: {},
  },
};
