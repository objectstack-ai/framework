// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @module studio/page-builder
 *
 * Studio Page Builder Protocol
 *
 * Defines the specification for the drag-and-drop Page Builder UI.
 * The builder allows visual composition of blank pages by placing
 * elements on a grid canvas with snapping, alignment, and layer ordering.
 */

import { z } from 'zod';

/**
 * Canvas Snap Settings Schema
 * Controls grid snapping behavior during element placement.
 */
import { lazySchema } from '../shared/lazy-schema';
export const CanvasSnapSettingsSchema = lazySchema(() => z.object({
  enabled: z.boolean().default(true).describe('Enable snap-to-grid'),
  gridSize: z.number().int().min(1).default(8).describe('Snap grid size in pixels'),
  showGrid: z.boolean().default(true).describe('Show grid overlay on canvas'),
  showGuides: z.boolean().default(true).describe('Show alignment guides when dragging'),
}));

/**
 * Canvas Zoom Settings Schema
 * Controls zoom behavior for the builder canvas.
 */
export const CanvasZoomSettingsSchema = lazySchema(() => z.object({
  min: z.number().min(0.1).default(0.25).describe('Minimum zoom level'),
  max: z.number().max(10).default(3).describe('Maximum zoom level'),
  default: z.number().default(1).describe('Default zoom level'),
  step: z.number().default(0.1).describe('Zoom step increment'),
}));

/**
 * Element Palette Item Schema
 * An element available in the builder palette for drag-and-drop placement.
 */
export const ElementPaletteItemSchema = lazySchema(() => z.object({
  type: z.string().describe('Component type (e.g. "element:button", "element:text")'),
  label: z.string().describe('Display label in palette'),
  icon: z.string().optional().describe('Icon name for palette display'),
  category: z.enum(['content', 'interactive', 'data', 'layout'])
    .describe('Palette category grouping'),
  defaultWidth: z.number().int().min(1).default(4).describe('Default width in grid columns'),
  defaultHeight: z.number().int().min(1).default(2).describe('Default height in grid rows'),
}));

/**
 * Page Builder Config Schema
 * Configuration for the Studio Page Builder.
 */
export const PageBuilderConfigSchema = lazySchema(() => z.object({
  snap: CanvasSnapSettingsSchema.optional().describe('Canvas snap settings'),
  zoom: CanvasZoomSettingsSchema.optional().describe('Canvas zoom settings'),
  palette: z.array(ElementPaletteItemSchema).optional()
    .describe('Custom element palette (defaults to all registered elements)'),
  showLayerPanel: z.boolean().default(true).describe('Show layer ordering panel'),
  showPropertyPanel: z.boolean().default(true).describe('Show property inspector panel'),
  undoLimit: z.number().int().min(1).default(50).describe('Maximum undo history steps'),
}));

// Backward compatibility alias
/** @deprecated Use PageBuilderConfigSchema instead */
export const InterfaceBuilderConfigSchema = lazySchema(() => PageBuilderConfigSchema);

// Type Exports
export type CanvasSnapSettings = z.infer<typeof CanvasSnapSettingsSchema>;
export type CanvasZoomSettings = z.infer<typeof CanvasZoomSettingsSchema>;
export type ElementPaletteItem = z.infer<typeof ElementPaletteItemSchema>;
/** @deprecated Use PageBuilderConfig instead */
export type InterfaceBuilderConfig = z.infer<typeof PageBuilderConfigSchema>;
export type PageBuilderConfig = z.infer<typeof PageBuilderConfigSchema>;
