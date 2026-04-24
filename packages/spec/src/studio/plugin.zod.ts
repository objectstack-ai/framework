// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @module studio/plugin
 * 
 * Studio Plugin Protocol
 * 
 * Defines the specification for Studio plugins — a VS Code-like extension model
 * that allows each metadata type to contribute custom viewers, designers, 
 * sidebar groups, actions, and commands.
 * 
 * ## Architecture
 * 
 * Like VS Code extensions, Studio plugins have two layers:
 * 1. **Manifest (Declarative)** — JSON-serializable contribution points
 * 2. **Activation (Imperative)** — Runtime registration of React components & handlers
 * 
 * ```
 * ┌─────────────────────────────────────────────────────────┐
 * │                    Studio Host                          │
 * │  ┌───────────────────────────────────────────────────┐  │
 * │  │              Plugin Registry                      │  │
 * │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐         │  │
 * │  │  │ Object   │ │  Flow    │ │  Agent   │  ...     │  │
 * │  │  │ Plugin   │ │  Plugin  │ │  Plugin  │         │  │
 * │  │  └──────────┘ └──────────┘ └──────────┘         │  │
 * │  └───────────────────────────────────────────────────┘  │
 * │                                                         │
 * │  ┌─── Sidebar ───┐  ┌──── Main Panel ────────────────┐ │
 * │  │ [plugin icons] │  │  PluginHost renders viewer     │ │
 * │  │ [plugin groups]│  │  from highest-priority plugin  │ │
 * │  └────────────────┘  └────────────────────────────────┘ │
 * └─────────────────────────────────────────────────────────┘
 * ```
 * 
 * @example
 * ```typescript
 * import { StudioPluginManifestSchema } from '@objectstack/spec/studio';
 * 
 * const manifest = StudioPluginManifestSchema.parse({
 *   id: 'objectstack.object-designer',
 *   name: 'Object Designer',
 *   version: '1.0.0',
 *   contributes: {
 *     metadataViewers: [{
 *       id: 'object-explorer',
 *       metadataTypes: ['object', 'objects'],
 *       label: 'Object Explorer',
 *       priority: 100,
 *       modes: ['preview', 'design', 'data'],
 *     }],
 *   },
 * });
 * ```
 */

import { z } from 'zod';

// ─── View Mode ───────────────────────────────────────────────────────

/** Supported view modes for metadata viewers */
import { lazySchema } from '../shared/lazy-schema';
export const ViewModeSchema = lazySchema(() => z.enum(['preview', 'design', 'code', 'data']));
export type ViewMode = z.infer<typeof ViewModeSchema>;

// ─── Metadata Viewer Contribution ────────────────────────────────────

/**
 * Declares a metadata viewer/designer component.
 * The runtime component is registered imperatively during plugin activation.
 */
export const MetadataViewerContributionSchema = lazySchema(() => z.object({
  /** Unique viewer ID (namespaced: `pluginId.viewerId`) */
  id: z.string().describe('Unique viewer identifier'),

  /** Metadata type(s) this viewer handles (e.g., "object", "flow", "agent") */
  metadataTypes: z.array(z.string()).min(1).describe('Metadata types this viewer can handle'),

  /** Human-readable label shown in the view switcher */
  label: z.string().describe('Viewer display label'),

  /** Priority — highest-priority viewer becomes default. Built-in default = 0 */
  priority: z.number().default(0).describe('Viewer priority (higher wins)'),

  /** View modes this viewer supports */
  modes: z.array(ViewModeSchema).default(['preview']).describe('Supported view modes'),
}));

export type MetadataViewerContribution = z.infer<typeof MetadataViewerContributionSchema>;

// ─── Sidebar Group Contribution ──────────────────────────────────────

/**
 * Declares a sidebar group that organizes metadata types.
 * Plugins can add new groups or extend existing ones.
 */
export const SidebarGroupContributionSchema = lazySchema(() => z.object({
  /** Unique group key */
  key: z.string().describe('Unique group key'),

  /** Display label */
  label: z.string().describe('Group display label'),

  /** Lucide icon name (e.g., "database", "workflow") */
  icon: z.string().optional().describe('Lucide icon name'),

  /** Metadata types belonging to this group */
  metadataTypes: z.array(z.string()).describe('Metadata types in this group'),

  /** Sort order — lower values appear first */
  order: z.number().default(100).describe('Sort order (lower = higher)'),
}));

export type SidebarGroupContribution = z.infer<typeof SidebarGroupContributionSchema>;

// ─── Action Contribution ─────────────────────────────────────────────

/** Where an action can appear in the UI */
export const ActionLocationSchema = lazySchema(() => z.enum(['toolbar', 'contextMenu', 'commandPalette']));

/**
 * Declares an action that can be triggered on metadata items.
 * The handler is registered imperatively during activation.
 */
export const ActionContributionSchema = lazySchema(() => z.object({
  /** Unique action ID */
  id: z.string().describe('Unique action identifier'),

  /** Display label */
  label: z.string().describe('Action display label'),

  /** Lucide icon name */
  icon: z.string().optional().describe('Lucide icon name'),

  /** Where this action appears */
  location: ActionLocationSchema.describe('UI location'),

  /** Metadata types this action applies to (empty = all types) */
  metadataTypes: z.array(z.string()).default([]).describe('Applicable metadata types'),
}));

export type ActionContribution = z.infer<typeof ActionContributionSchema>;

// ─── Metadata Icon Contribution ──────────────────────────────────────

/**
 * Declares an icon and label for a metadata type.
 * Used by the sidebar and breadcrumbs.
 */
export const MetadataIconContributionSchema = lazySchema(() => z.object({
  /** Metadata type this icon represents */
  metadataType: z.string().describe('Metadata type'),

  /** Human-readable label */
  label: z.string().describe('Display label'),

  /** Lucide icon name */
  icon: z.string().describe('Lucide icon name'),
}));

export type MetadataIconContribution = z.infer<typeof MetadataIconContributionSchema>;

// ─── Panel Contribution ──────────────────────────────────────────────

/** Where a panel can be placed */
export const PanelLocationSchema = lazySchema(() => z.enum(['bottom', 'right', 'modal']));

/**
 * Declares an auxiliary panel (like VS Code's Terminal, Problems, Output panels).
 */
export const PanelContributionSchema = lazySchema(() => z.object({
  /** Unique panel ID */
  id: z.string().describe('Unique panel identifier'),

  /** Display label */
  label: z.string().describe('Panel display label'),

  /** Lucide icon name */
  icon: z.string().optional().describe('Lucide icon name'),

  /** Panel placement */
  location: PanelLocationSchema.default('bottom').describe('Panel location'),
}));

export type PanelContribution = z.infer<typeof PanelContributionSchema>;

// ─── Command Contribution ────────────────────────────────────────────

/**
 * Declares a command that can be invoked from the command palette
 * or programmatically by other plugins.
 */
export const CommandContributionSchema = lazySchema(() => z.object({
  /** Unique command ID (namespaced: `pluginId.commandName`) */
  id: z.string().describe('Unique command identifier'),

  /** Display label */
  label: z.string().describe('Command display label'),

  /** Keyboard shortcut (e.g., "Ctrl+Shift+P") */
  shortcut: z.string().optional().describe('Keyboard shortcut'),

  /** Lucide icon name */
  icon: z.string().optional().describe('Lucide icon name'),
}));

export type CommandContribution = z.infer<typeof CommandContributionSchema>;

// ─── Studio Plugin Contributions ─────────────────────────────────────

/**
 * All contribution points a Studio plugin can declare.
 * Analogous to VS Code's `contributes` section in `package.json`.
 */
export const StudioPluginContributionsSchema = lazySchema(() => z.object({
  /** Metadata viewer/designer components */
  metadataViewers: z.array(MetadataViewerContributionSchema).default([]),

  /** Sidebar navigation groups */
  sidebarGroups: z.array(SidebarGroupContributionSchema).default([]),

  /** Toolbar / context menu / command palette actions */
  actions: z.array(ActionContributionSchema).default([]),

  /** Metadata type icons & labels */
  metadataIcons: z.array(MetadataIconContributionSchema).default([]),

  /** Auxiliary panels */
  panels: z.array(PanelContributionSchema).default([]),

  /** Command palette entries */
  commands: z.array(CommandContributionSchema).default([]),
}));

export type StudioPluginContributions = z.infer<typeof StudioPluginContributionsSchema>;

// ─── Activation Events ───────────────────────────────────────────────

/**
 * Events that trigger plugin activation.
 * Similar to VS Code's `activationEvents`.
 * 
 * Patterns:
 * - `*` — Activate immediately (eager)
 * - `onMetadataType:object` — Activate when metadata type "object" is loaded
 * - `onCommand:myPlugin.doSomething` — Activate when command is invoked
 * - `onView:myPlugin.myPanel` — Activate when panel is opened
 */
export const ActivationEventSchema = lazySchema(() => z.string().describe('Activation event pattern'));

// ─── Studio Plugin Manifest ──────────────────────────────────────────

/**
 * The declarative manifest for a Studio plugin.
 * 
 * This is the "package.json" equivalent for Studio extensions.
 * All contribution points are declared here; runtime components
 * are registered imperatively during the `activate()` call.
 */
export const StudioPluginManifestSchema = lazySchema(() => z.object({
  /** 
   * Unique plugin ID using reverse-domain notation.
   * @example "objectstack.object-designer"
   */
  id: z.string()
    .regex(/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/)
    .describe('Plugin ID (dot-separated lowercase)'),

  /** Human-readable plugin name */
  name: z.string().describe('Plugin display name'),

  /** Semantic version */
  version: z.string().default('0.0.1').describe('Plugin version'),

  /** Plugin description */
  description: z.string().optional().describe('Plugin description'),

  /** Author name */
  author: z.string().optional().describe('Author'),

  /** Declarative contribution points */
  contributes: StudioPluginContributionsSchema.default({
    metadataViewers: [],
    sidebarGroups: [],
    actions: [],
    metadataIcons: [],
    panels: [],
    commands: [],
  }),

  /** 
   * Activation events — when to load this plugin.
   * Default `['*']` means eager activation.
   */
  activationEvents: z.array(ActivationEventSchema).default(['*']),
}));

export type StudioPluginManifest = z.infer<typeof StudioPluginManifestSchema>;

// ─── Helper: defineStudioPlugin ──────────────────────────────────────

/**
 * Type-safe helper for defining a Studio plugin manifest.
 * 
 * @example
 * ```typescript
 * const manifest = defineStudioPlugin({
 *   id: 'objectstack.flow-designer',
 *   name: 'Flow Designer',
 *   contributes: {
 *     metadataViewers: [{
 *       id: 'flow-canvas',
 *       metadataTypes: ['flows'],
 *       label: 'Flow Canvas',
 *       priority: 100,
 *       modes: ['design', 'code'],
 *     }],
 *   },
 * });
 * ```
 */
export function defineStudioPlugin(
  input: z.input<typeof StudioPluginManifestSchema>
): StudioPluginManifest {
  return StudioPluginManifestSchema.parse(input);
}
