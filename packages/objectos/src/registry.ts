// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ServiceObject } from '@objectstack/spec/data';
import {
  SysMetadata,
  SysObject,
  SysView,
  SysAgent,
  SysTool,
  SysFlow,
} from './objects';

/**
 * System Object Registry
 *
 * The complete catalog of ObjectOS system objects.
 * These objects define the platform's metadata layer as queryable data.
 *
 * ## Architecture
 * - sys_metadata: Generic metadata envelope (source of truth)
 * - sys_object: Object definitions (queryable)
 * - sys_view: View definitions (queryable)
 * - sys_agent: AI Agent definitions (queryable)
 * - sys_tool: AI Tool definitions (queryable)
 * - sys_flow: Flow definitions (queryable)
 *
 * ## Usage
 * ```typescript
 * import { SystemObjects } from '@objectstack/objectos';
 *
 * // Register all system objects
 * for (const [name, definition] of Object.entries(SystemObjects)) {
 *   await kernel.metadata.register('object', name, definition, {
 *     scope: 'system',
 *     isSystem: true,
 *     managedBy: 'platform',
 *   });
 * }
 * ```
 */
export const SystemObjects: Record<string, ServiceObject> = {
  // Metadata envelope (source of truth)
  sys_metadata: SysMetadata as unknown as ServiceObject,

  // Data Protocol
  sys_object: SysObject as unknown as ServiceObject,

  // UI Protocol
  sys_view: SysView as unknown as ServiceObject,

  // Automation Protocol
  sys_flow: SysFlow as unknown as ServiceObject,

  // AI Protocol
  sys_agent: SysAgent as unknown as ServiceObject,
  sys_tool: SysTool as unknown as ServiceObject,
};

/**
 * Get all system object definitions
 */
export function getSystemObjects(): ServiceObject[] {
  return Object.values(SystemObjects);
}

/**
 * Get system object by name
 */
export function getSystemObject(name: string): ServiceObject | undefined {
  return SystemObjects[name];
}

/**
 * Get system object names
 */
export function getSystemObjectNames(): string[] {
  return Object.keys(SystemObjects);
}
