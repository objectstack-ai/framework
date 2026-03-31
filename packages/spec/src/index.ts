// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @objectstack/spec
 * 
 * ObjectStack Protocol & Specification
 * 
 * This package does NOT export types at the root level to prevent naming conflicts.
 * Please use namespaced imports or subpath imports.
 * 
 * ## Import Styles
 * 
 * ### Style 1: Namespace Imports from Root
 * ```typescript
 * import { Data, UI, System, Auth, AI, API } from '@objectstack/spec';
 * 
 * const field: Data.Field = { name: 'task_name', type: 'text' };
 * const user: Auth.User = { id: 'u1', email: 'user@example.com' };
 * ```
 * 
 * ### Style 2: Namespace Imports via Subpath
 * ```typescript
 * import * as Data from '@objectstack/spec/data';
 * import * as UI from '@objectstack/spec/ui';
 * import * as System from '@objectstack/spec/system';
 * import * as Auth from '@objectstack/spec/auth';
 * 
 * const field: Data.Field = { name: 'task_name', type: 'text' };
 * const user: Auth.User = { id: 'u1', email: 'user@example.com' };
 * ```
 * 
 * ### Style 3: Direct Subpath Imports
 * ```typescript
 * import { Field, FieldType } from '@objectstack/spec/data';
 * import { User, Session } from '@objectstack/spec/auth';
 * 
 * const field: Field = { name: 'task_name', type: 'text' };
 * const user: User = { id: 'u1', email: 'user@example.com' };
 * ```
 */

// ============================================================================
// NAMESPACE EXPORTS
// ============================================================================
// Export protocol domains as namespaces to prevent naming conflicts
// and establish clear boundaries between different protocol layers.
export * as Shared from './shared';
export * as Data from './data';
export * as Security from './security';
export * as UI from './ui';
export * as System from './system';
export * as Kernel from './kernel';
export * as Cloud from './cloud';
export * as QA from './qa';
export * as Identity from './identity';
export * as AI from './ai';
export * as API from './api';

export * as Automation from './automation';
export * as Integration from './integration';
export * as Contracts from './contracts';
export * as Studio from './studio';

export {
  defineStack,
  composeStacks,
  ComposeStacksOptionsSchema,
  ConflictStrategySchema,
  ObjectStackDefinitionSchema,
  ObjectStackSchema,
  ObjectStackCapabilitiesSchema,
  ObjectQLCapabilitiesSchema,
  ObjectUICapabilitiesSchema,
  ObjectOSCapabilitiesSchema
} from './stack.zod';

export type { DefineStackOptions, ComposeStacksOptions, ConflictStrategy, ObjectStackDefinitionInput } from './stack.zod';

export * from './stack.zod';

// DX Helper Functions (re-exported for convenience)
export { defineView } from './ui/view.zod';
export { defineApp } from './ui/app.zod';
export { defineFlow } from './automation/flow.zod';
export { defineAgent } from './ai/agent.zod';
export type { Agent } from './ai/agent.zod';

// DX Validation Utilities (re-exported for convenience)
export { objectStackErrorMap, formatZodError, formatZodIssue, safeParsePretty } from './shared/error-map.zod';
export { suggestFieldType, findClosestMatches, formatSuggestion } from './shared/suggestions.zod';
export { normalizeMetadataCollection, normalizeStackInput, normalizePluginMetadata, MAP_SUPPORTED_FIELDS, METADATA_ALIASES } from './shared/metadata-collection.zod';
export type { MetadataCollectionInput, MapSupportedField } from './shared/metadata-collection.zod';

export { type PluginContext } from './kernel/plugin.zod';

