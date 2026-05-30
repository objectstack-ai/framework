// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Canonical registry of {@link FormView} layouts used by the platform's
 * metadata configuration UI ("metadata admin" / Studio).
 *
 * Each entry maps a metadata-type machine name (singular, e.g. `'agent'`,
 * `'flow'`) to the {@link FormView} produced by `defineForm({ schemaId })`
 * in the corresponding `*.form.ts`. The registry is consumed by:
 *
 * - `getMetaTypes()` in `@objectstack/objectql` — surfaces `entry.form` so
 *   the generic SchemaForm renderer can lay each metadata editor out as
 *   sections/tabs/wizards with widget hints (instead of a flat JSON list).
 * - `os i18n extract` — walks the registry to enumerate translatable
 *   strings under `metadataForms.<type>.{sections,fields}.*` and emit
 *   them into generated translation bundles, eliminating hand-maintained
 *   English skeletons.
 *
 * Both producers live above `@objectstack/objectql` in the dependency
 * graph, so the registry must live in `@objectstack/spec` (the only
 * package both can safely import from). Keeping a single canonical map
 * here prevents drift between the runtime form payload and the
 * extractor's notion of "which forms exist".
 *
 * Types **without** an entry here render via the auto-generated single
 * section layout derived from their JSON Schema — acceptable for simple
 * types whose Zod schema has no nested grouping needs.
 *
 * @see resolveMetadataFormLabels (i18n-resolver) — consumes the same keys
 * @see DEFAULT_METADATA_TYPE_REGISTRY — companion registry of type labels
 */

import type { FormView } from '../ui/view.zod';

import { objectForm, fieldForm, hookForm } from '../data';
import {
    viewForm,
    appForm,
    dashboardForm,
    actionForm,
    pageForm,
    reportForm,
} from '../ui';
import { roleForm } from '../identity';
import { permissionForm } from '../security';
import { agentForm, toolForm, skillForm } from '../ai';
import { flowForm, approvalForm } from '../automation';
import { emailTemplateForm } from './email-template.form';

/**
 * Frozen map of metadata type → canonical {@link FormView} layout.
 *
 * Insertion order is preserved (Studio renders the list in this order
 * when no explicit ordering is supplied by the consumer).
 *
 * @example
 * ```ts
 * import { METADATA_FORM_REGISTRY } from '@objectstack/spec/system';
 *
 * for (const [type, form] of Object.entries(METADATA_FORM_REGISTRY)) {
 *   console.log(type, form.sections?.length, 'sections');
 * }
 * ```
 */
export const METADATA_FORM_REGISTRY: Readonly<Record<string, FormView>> = Object.freeze({
    object: objectForm,
    field: fieldForm,
    hook: hookForm,
    report: reportForm,
    view: viewForm,
    app: appForm,
    dashboard: dashboardForm,
    role: roleForm,
    action: actionForm,
    page: pageForm,
    agent: agentForm,
    tool: toolForm,
    skill: skillForm,
    flow: flowForm,
    approval: approvalForm,
    permission: permissionForm,
    profile: permissionForm,
    email_template: emailTemplateForm,
});

/** Union of metadata type keys with a registered {@link FormView}. */
export type MetadataFormType = keyof typeof METADATA_FORM_REGISTRY;
