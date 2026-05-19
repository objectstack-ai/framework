// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @objectstack/plugin-sharing
 *
 * Record-level sharing for ObjectStack. Implements `ISharingService`
 * and installs an engine middleware that enforces
 * `object.sharingModel` (`private` / `read`) against the
 * authenticated execution context.
 */

export { SysRecordShare, SysSharingRule } from '@objectstack/platform-objects/security';
export { SysDepartment, SysDepartmentMember } from '@objectstack/platform-objects/identity';
export {
  SharingService,
  type SharingEngine,
  type SharingServiceOptions,
} from './sharing-service.js';
export {
  SharingRuleService,
  type SharingRuleServiceOptions,
} from './sharing-rule-service.js';
export { TeamGraphService, expandPrincipal, type TeamGraphOptions } from './team-graph.js';
export { DepartmentGraphService, type DepartmentGraphOptions } from './department-graph.js';
export { bindRuleHooks, unbindAllRuleHooks, SHARING_RULE_HOOK_PACKAGE } from './rule-hooks.js';
export {
  SharingServicePlugin,
  buildSharingMiddleware,
  type SharingPluginOptions,
} from './sharing-plugin.js';
export type {
  ISharingService,
  ISharingRuleService,
  ITeamGraphService,
  IDepartmentGraphService,
  RecordShare,
  GrantShareInput,
  SharingExecutionContext,
  ShareAccessLevel,
  ShareRecipientType,
  ShareSource,
  SharingRuleRow,
  DefineSharingRuleInput,
  SharingRuleEvaluationResult,
  SharingRuleRecipientType,
} from '@objectstack/spec/contracts';
