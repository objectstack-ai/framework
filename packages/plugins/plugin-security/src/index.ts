// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @objectstack/plugin-security
 * 
 * Security Plugin for ObjectStack
 * Provides RBAC, Row-Level Security (RLS), and Field-Level Security runtime.
 */

export { SecurityPlugin } from './security-plugin.js';
export { PermissionEvaluator } from './permission-evaluator.js';
export { RLSCompiler } from './rls-compiler.js';
export { FieldMasker } from './field-masker.js';

// System Object Definitions (sys namespace)
export { SysRole, SysPermissionSet } from './objects/index.js';
