// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Studio Plugin Runtime Types
 * 
 * React-specific types for the plugin system.
 * These extend the protocol-level schemas with actual component references.
 */

import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type {
  StudioPluginManifest,
  ViewMode,
} from '@objectstack/spec/studio';

// ─── Component Props ─────────────────────────────────────────────────

/** Props passed to metadata viewer/designer components */
export interface MetadataViewerProps {
  /** Metadata type (e.g., "object", "flow", "agent") */
  metadataType: string;
  /** Metadata item name / identifier */
  metadataName: string;
  /** Raw metadata payload (loaded from API) */
  data?: any;
  /** Current view mode */
  mode: ViewMode;
  /** Package ID to filter metadata by (optional) */
  packageId?: string;
}

/** Context passed to action handlers */
export interface ActionContext {
  metadataType: string;
  metadataName: string;
  data?: any;
}

// ─── Resolved Runtime Entries ────────────────────────────────────────

/** A viewer with its React component resolved */
export interface ResolvedViewer {
  id: string;
  pluginId: string;
  label: string;
  metadataTypes: string[];
  modes: ViewMode[];
  priority: number;
  component: ComponentType<MetadataViewerProps>;
}

/** A panel with its React component resolved */
export interface ResolvedPanel {
  id: string;
  pluginId: string;
  label: string;
  icon?: string;
  location: 'bottom' | 'right' | 'modal';
  component: ComponentType<any>;
}

/** An action with its handler resolved */
export interface ResolvedAction {
  id: string;
  pluginId: string;
  label: string;
  icon?: string;
  location: 'toolbar' | 'contextMenu' | 'commandPalette';
  metadataTypes: string[];
  handler: (ctx: ActionContext) => void | Promise<void>;
}

/** A command with its handler resolved */
export interface ResolvedCommand {
  id: string;
  pluginId: string;
  label: string;
  shortcut?: string;
  icon?: string;
  handler: () => void | Promise<void>;
}

/** Resolved metadata icon (with actual Lucide component) */
export interface ResolvedMetadataIcon {
  metadataType: string;
  label: string;
  icon: LucideIcon;
}

// ─── Plugin API ──────────────────────────────────────────────────────

/**
 * API provided to plugins during activation.
 * 
 * Similar to VS Code's `vscode` module — plugins use this to register
 * their runtime components and handlers.
 * 
 * @example
 * ```tsx
 * const myPlugin: StudioPlugin = {
 *   manifest: defineStudioPlugin({ ... }),
 *   activate(api) {
 *     api.registerViewer('my-viewer', MyViewerComponent);
 *     api.registerAction('my-action', (ctx) => { ... });
 *     api.registerCommand('my-command', () => { ... });
 *   },
 * };
 * ```
 */
export interface StudioPluginAPI {
  /** Register a React component as a metadata viewer */
  registerViewer(viewerId: string, component: ComponentType<MetadataViewerProps>): void;

  /** Register a panel component */
  registerPanel(panelId: string, component: ComponentType<any>): void;

  /** Register an action handler */
  registerAction(actionId: string, handler: ResolvedAction['handler']): void;

  /** Register a command handler */
  registerCommand(commandId: string, handler: ResolvedCommand['handler']): void;

  /** Register a Lucide icon for a metadata type */
  registerMetadataIcon(metadataType: string, icon: LucideIcon, label?: string): void;
}

// ─── Studio Plugin (Full Definition) ─────────────────────────────────

/**
 * A complete Studio plugin with both declarative manifest and imperative activation.
 * 
 * This is the primary interface that plugin authors implement.
 * 
 * @example
 * ```tsx
 * import { defineStudioPlugin } from '@objectstack/spec/studio';
 * import type { StudioPlugin } from './plugins/types';
 * 
 * export const flowDesignerPlugin: StudioPlugin = {
 *   manifest: defineStudioPlugin({
 *     id: 'objectstack.flow-designer',
 *     name: 'Flow Designer',
 *     contributes: {
 *       metadataViewers: [{
 *         id: 'flow-canvas',
 *         metadataTypes: ['flows'],
 *         label: 'Flow Canvas',
 *         priority: 100,
 *         modes: ['design', 'code'],
 *       }],
 *     },
 *   }),
 *   activate(api) {
 *     api.registerViewer('flow-canvas', FlowCanvasComponent);
 *   },
 * };
 * ```
 */
export interface StudioPlugin {
  /** Declarative plugin manifest */
  manifest: StudioPluginManifest;

  /** 
   * Called when the plugin is activated. 
   * Register components, handlers, and other runtime artifacts here.
   */
  activate: (api: StudioPluginAPI) => void | Promise<void>;

  /** Called when the plugin is deactivated (cleanup) */
  deactivate?: () => void;
}
