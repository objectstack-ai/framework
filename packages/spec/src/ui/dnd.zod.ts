// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { I18nLabelSchema, AriaPropsSchema } from './i18n.zod';

/**
 * Drag Handle Schema
 * Defines how a drag interaction is initiated on an element.
 */
import { lazySchema } from '../shared/lazy-schema';
export const DragHandleSchema = lazySchema(() => z.enum([
  'element',
  'handle',
  'grip_icon',
]).describe('Drag initiation method'));

export type DragHandle = z.infer<typeof DragHandleSchema>;

/**
 * Drop Effect Schema
 * Visual feedback indicating the result of a drop operation.
 */
export const DropEffectSchema = lazySchema(() => z.enum([
  'move',
  'copy',
  'link',
  'none',
]).describe('Drop operation effect'));

export type DropEffect = z.infer<typeof DropEffectSchema>;

/**
 * Drag Constraint Schema
 * Constrains drag movement along axes, within bounds, or to a grid.
 */
export const DragConstraintSchema = lazySchema(() => z.object({
  axis: z.enum(['x', 'y', 'both']).default('both').describe('Constrain drag axis'),
  bounds: z.enum(['parent', 'viewport', 'none']).default('none').describe('Constrain within bounds'),
  grid: z.tuple([z.number(), z.number()]).optional().describe('Snap to grid [x, y] in pixels'),
}).describe('Drag movement constraints'));

export type DragConstraint = z.infer<typeof DragConstraintSchema>;

/**
 * Drop Zone Schema
 * Configures a container that accepts dragged items.
 */
export const DropZoneSchema = lazySchema(() => z.object({
  label: I18nLabelSchema.optional().describe('Accessible label for the drop zone'),
  accept: z.array(z.string()).describe('Accepted drag item types'),
  maxItems: z.number().optional().describe('Maximum items allowed in drop zone'),
  highlightOnDragOver: z.boolean().default(true).describe('Highlight drop zone when dragging over'),
  dropEffect: DropEffectSchema.default('move').describe('Visual effect on drop'),
}).merge(AriaPropsSchema.partial()).describe('Drop zone configuration'));

export type DropZone = z.infer<typeof DropZoneSchema>;

/**
 * Drag Item Schema
 * Configures a draggable element including handle, constraints, and preview.
 */
export const DragItemSchema = lazySchema(() => z.object({
  type: z.string().describe('Drag item type identifier for matching with drop zones'),
  label: I18nLabelSchema.optional().describe('Accessible label describing the draggable item'),
  handle: DragHandleSchema.default('element').describe('How to initiate drag'),
  constraint: DragConstraintSchema.optional().describe('Drag movement constraints'),
  preview: z.enum(['element', 'custom', 'none']).default('element').describe('Drag preview type'),
  disabled: z.boolean().default(false).describe('Disable dragging'),
}).merge(AriaPropsSchema.partial()).describe('Draggable item configuration'));

export type DragItem = z.infer<typeof DragItemSchema>;

/**
 * Drag and Drop Configuration Schema
 * Top-level drag-and-drop interaction configuration for a component.
 */
export const DndConfigSchema = lazySchema(() => z.object({
  enabled: z.boolean().default(false).describe('Enable drag and drop'),
  dragItem: DragItemSchema.optional().describe('Configuration for draggable item'),
  dropZone: DropZoneSchema.optional().describe('Configuration for drop target'),
  sortable: z.boolean().default(false).describe('Enable sortable list behavior'),
  autoScroll: z.boolean().default(true).describe('Auto-scroll during drag near edges'),
  touchDelay: z.number().default(200).describe('Delay in ms before drag starts on touch devices'),
}).describe('Drag and drop interaction configuration'));

export type DndConfig = z.infer<typeof DndConfigSchema>;
