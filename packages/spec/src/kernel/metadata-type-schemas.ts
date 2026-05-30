// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Metadata Type → Canonical Zod Schema map.
 *
 * Single source of truth used by:
 *
 *   1. Runtime validators (`MetadataManager.validate`) — already wired
 *      through the domain-specific overlay validator in `objectql/protocol`.
 *   2. The `/api/v1/meta/types/:type` endpoint, which converts each
 *      registered schema to JSON Schema (`z.toJSONSchema()`) and exposes
 *      it as `MetadataTypeInfo.schema`. Studio's metadata-admin engine
 *      renders the result with its generic `SchemaForm`, so adding a new
 *      writable metadata type now requires **zero** Studio-side code.
 *
 * The map intentionally only contains types that meaningfully round-trip
 * through the runtime metadata API. Code-only types whose entries cannot
 * be created via REST (`function`, `service`, `router`) are excluded —
 * `DEFAULT_METADATA_TYPE_REGISTRY` already marks them `allowRuntimeCreate:
 * false`, so the engine never tries to render a form for them.
 *
 * Profile shares `PermissionSetSchema` (a profile is a permission set
 * with `isProfile: true`); `validation` exposes the discriminated union
 * over all built-in rule variants. Custom plugin types can extend this
 * registry at runtime via `registerMetadataTypeSchema()`.
 */

import type { z } from 'zod';

import { FieldSchema } from '../data/field.zod';
import { ObjectSchema } from '../data/object.zod';
import { HookSchema } from '../data/hook.zod';
import { ValidationRuleSchema } from '../data/validation.zod';
import { DatasourceSchema } from '../data/datasource.zod';

import { ViewSchema } from '../ui/view.zod';
import { PageSchema } from '../ui/page.zod';
import { DashboardSchema } from '../ui/dashboard.zod';
import { AppSchema } from '../ui/app.zod';
import { ActionSchema } from '../ui/action.zod';
import { ReportSchema } from '../ui/report.zod';

import { FlowSchema } from '../automation/flow.zod';
import { StateMachineSchema } from '../automation/state-machine.zod';
import { ApprovalProcessSchema } from '../automation/approval.zod';

import { JobSchema } from '../system/job.zod';
import { EmailTemplateDefinitionSchema } from '../system/email-template.zod';
import { AppTranslationBundleSchema } from '../system/translation.zod';

import { PermissionSetSchema } from '../security/permission.zod';
import { RoleSchema } from '../identity/role.zod';

import { AgentSchema } from '../ai/agent.zod';
import { ToolSchema } from '../ai/tool.zod';
import { SkillSchema } from '../ai/skill.zod';

import type { MetadataType } from './metadata-plugin.zod';

/**
 * Built-in mapping from metadata type identifier → its canonical Zod
 * schema. Types omitted here have no runtime-editable form (and are
 * marked `allowRuntimeCreate: false` in `DEFAULT_METADATA_TYPE_REGISTRY`).
 */
const BUILTIN_METADATA_TYPE_SCHEMAS: Partial<Record<MetadataType, z.ZodType>> = {
  // Data Protocol
  object: ObjectSchema,
  field: FieldSchema,
  hook: HookSchema,
  validation: ValidationRuleSchema,
  // `trigger` — no standalone Zod schema yet; falls back to raw-JSON
  // editor until the data-trigger spec lands.

  // UI Protocol
  view: ViewSchema,
  page: PageSchema,
  dashboard: DashboardSchema,
  app: AppSchema,
  action: ActionSchema,
  report: ReportSchema,

  // Automation Protocol
  flow: FlowSchema,
  workflow: StateMachineSchema,
  approval: ApprovalProcessSchema,
  job: JobSchema,

  // System Protocol
  datasource: DatasourceSchema,
  translation: AppTranslationBundleSchema,
  email_template: EmailTemplateDefinitionSchema,
  // `router` / `function` / `service` are code-only (allowRuntimeCreate: false).

  // Security Protocol
  permission: PermissionSetSchema,
  profile: PermissionSetSchema, // profile = permission set with isProfile=true
  role: RoleSchema,

  // AI Protocol
  agent: AgentSchema,
  tool: ToolSchema,
  skill: SkillSchema,
};

/** Runtime-extensible overlay populated via `registerMetadataTypeSchema`. */
const EXTRA_METADATA_TYPE_SCHEMAS = new Map<string, z.ZodType>();

/**
 * Look up the canonical Zod schema for a metadata type.
 *
 * Returns the user-registered override if any, otherwise the built-in
 * schema. Returns `undefined` for types with no schema (e.g. `trigger`,
 * `function`, `service`, `router`).
 */
export function getMetadataTypeSchema(type: string): z.ZodType | undefined {
  return EXTRA_METADATA_TYPE_SCHEMAS.get(type) ?? BUILTIN_METADATA_TYPE_SCHEMAS[type as MetadataType];
}

/**
 * Register (or replace) the canonical Zod schema for a metadata type.
 *
 * Plugins that introduce custom metadata types — declared through
 * `additionalTypes` on `MetadataPluginConfig` — should call this from
 * their `onInstall` hook so the engine's `/meta/types/:type` endpoint
 * starts emitting a real JSON Schema for them. Idempotent.
 */
export function registerMetadataTypeSchema(type: string, schema: z.ZodType): void {
  EXTRA_METADATA_TYPE_SCHEMAS.set(type, schema);
}

/** Snapshot of every type that currently has a schema (built-in + extras). */
export function listMetadataTypeSchemaTypes(): string[] {
  const types = new Set<string>(Object.keys(BUILTIN_METADATA_TYPE_SCHEMAS));
  for (const t of EXTRA_METADATA_TYPE_SCHEMAS.keys()) types.add(t);
  return Array.from(types).sort();
}
