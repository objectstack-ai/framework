// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { I18nLabelSchema, AriaPropsSchema } from './i18n.zod';

/**
 * Touch Target Configuration Schema
 * Ensures touch targets meet WCAG 2.5.5 minimum size requirements (44x44px).
 */
export const TouchTargetConfigSchema = z.object({
  minWidth: z.number().default(44).describe('Minimum touch target width in pixels (WCAG 2.5.5: 44px)'),
  minHeight: z.number().default(44).describe('Minimum touch target height in pixels (WCAG 2.5.5: 44px)'),
  padding: z.number().optional().describe('Additional padding around touch target in pixels'),
  hitSlop: z.object({
    top: z.number().optional().describe('Extra hit area above the element'),
    right: z.number().optional().describe('Extra hit area to the right of the element'),
    bottom: z.number().optional().describe('Extra hit area below the element'),
    left: z.number().optional().describe('Extra hit area to the left of the element'),
  }).optional().describe('Invisible hit area extension beyond the visible bounds'),
}).describe('Touch target sizing configuration (WCAG accessible)');

export type TouchTargetConfig = z.infer<typeof TouchTargetConfigSchema>;

/**
 * Gesture Type Enum
 * Supported touch gesture types.
 */
export const GestureTypeSchema = z.enum([
  'swipe',
  'pinch',
  'long_press',
  'double_tap',
  'drag',
  'rotate',
  'pan',
]).describe('Touch gesture type');

export type GestureType = z.infer<typeof GestureTypeSchema>;

/**
 * Swipe Direction Enum
 */
export const SwipeDirectionSchema = z.enum(['up', 'down', 'left', 'right']);

export type SwipeDirection = z.infer<typeof SwipeDirectionSchema>;

/**
 * Swipe Gesture Configuration Schema
 */
export const SwipeGestureConfigSchema = z.object({
  direction: z.array(SwipeDirectionSchema).describe('Allowed swipe directions'),
  threshold: z.number().optional().describe('Minimum distance in pixels to recognize swipe'),
  velocity: z.number().optional().describe('Minimum velocity (px/ms) to trigger swipe'),
}).describe('Swipe gesture recognition settings');

export type SwipeGestureConfig = z.infer<typeof SwipeGestureConfigSchema>;

/**
 * Pinch Gesture Configuration Schema
 */
export const PinchGestureConfigSchema = z.object({
  minScale: z.number().optional().describe('Minimum scale factor (e.g., 0.5 for 50%)'),
  maxScale: z.number().optional().describe('Maximum scale factor (e.g., 3.0 for 300%)'),
}).describe('Pinch/zoom gesture recognition settings');

export type PinchGestureConfig = z.infer<typeof PinchGestureConfigSchema>;

/**
 * Long Press Gesture Configuration Schema
 */
export const LongPressGestureConfigSchema = z.object({
  duration: z.number().default(500).describe('Hold duration in milliseconds to trigger long press'),
  moveTolerance: z.number().optional().describe('Max movement in pixels allowed during press'),
}).describe('Long press gesture recognition settings');

export type LongPressGestureConfig = z.infer<typeof LongPressGestureConfigSchema>;

/**
 * Gesture Configuration Schema
 * Unified configuration for all supported gesture types.
 */
export const GestureConfigSchema = z.object({
  type: GestureTypeSchema.describe('Gesture type to configure'),
  label: I18nLabelSchema.optional().describe('Descriptive label for the gesture action'),
  enabled: z.boolean().default(true).describe('Whether this gesture is active'),
  swipe: SwipeGestureConfigSchema.optional().describe('Swipe gesture settings (when type is swipe)'),
  pinch: PinchGestureConfigSchema.optional().describe('Pinch gesture settings (when type is pinch)'),
  longPress: LongPressGestureConfigSchema.optional().describe('Long press settings (when type is long_press)'),
}).describe('Per-gesture configuration');

export type GestureConfig = z.infer<typeof GestureConfigSchema>;

/**
 * Touch Interaction Schema
 * Top-level touch and gesture interaction configuration for a component.
 */
export const TouchInteractionSchema = z.object({
  gestures: z.array(GestureConfigSchema).optional().describe('Configured gesture recognizers'),
  touchTarget: TouchTargetConfigSchema.optional().describe('Touch target sizing and hit area'),
  hapticFeedback: z.boolean().optional().describe('Enable haptic feedback on touch interactions'),
}).merge(AriaPropsSchema.partial()).describe('Touch and gesture interaction configuration');

export type TouchInteraction = z.infer<typeof TouchInteractionSchema>;
