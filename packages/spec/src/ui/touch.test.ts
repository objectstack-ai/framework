import { describe, it, expect } from 'vitest';
import {
  TouchTargetConfigSchema,
  GestureTypeSchema,
  SwipeGestureConfigSchema,
  PinchGestureConfigSchema,
  LongPressGestureConfigSchema,
  GestureConfigSchema,
  TouchInteractionSchema,
  type TouchTargetConfig,
  type GestureType,
  type SwipeGestureConfig,
  type PinchGestureConfig,
  type LongPressGestureConfig,
  type GestureConfig,
  type TouchInteraction,
} from './touch.zod';

describe('TouchTargetConfigSchema', () => {
  it('should apply default 44x44 values', () => {
    const result = TouchTargetConfigSchema.parse({});
    expect(result.minWidth).toBe(44);
    expect(result.minHeight).toBe(44);
  });

  it('should accept custom dimensions', () => {
    const config: TouchTargetConfig = { minWidth: 48, minHeight: 56, padding: 8 };
    const result = TouchTargetConfigSchema.parse(config);
    expect(result.minWidth).toBe(48);
    expect(result.minHeight).toBe(56);
    expect(result.padding).toBe(8);
  });

  it('should accept hitSlop configuration', () => {
    const result = TouchTargetConfigSchema.parse({
      hitSlop: { top: 10, right: 10, bottom: 10, left: 10 },
    });
    expect(result.hitSlop?.top).toBe(10);
  });
});

describe('GestureTypeSchema', () => {
  it('should accept all valid gesture types', () => {
    const types = ['swipe', 'pinch', 'long_press', 'double_tap', 'drag', 'rotate', 'pan'] as const;
    types.forEach(type => {
      expect(() => GestureTypeSchema.parse(type)).not.toThrow();
    });
  });

  it('should reject invalid gesture types', () => {
    expect(() => GestureTypeSchema.parse('flick')).toThrow();
    expect(() => GestureTypeSchema.parse('')).toThrow();
  });
});

describe('SwipeGestureConfigSchema', () => {
  it('should accept valid swipe config with directions', () => {
    const config: SwipeGestureConfig = { direction: ['left', 'right'] };
    const result = SwipeGestureConfigSchema.parse(config);
    expect(result.direction).toEqual(['left', 'right']);
  });

  it('should accept all four directions', () => {
    const result = SwipeGestureConfigSchema.parse({
      direction: ['up', 'down', 'left', 'right'],
      threshold: 50,
      velocity: 0.3,
    });
    expect(result.direction).toHaveLength(4);
    expect(result.threshold).toBe(50);
  });

  it('should reject missing direction', () => {
    expect(() => SwipeGestureConfigSchema.parse({})).toThrow();
  });
});

describe('PinchGestureConfigSchema', () => {
  it('should accept min and max scale', () => {
    const config: PinchGestureConfig = { minScale: 0.5, maxScale: 3.0 };
    const result = PinchGestureConfigSchema.parse(config);
    expect(result.minScale).toBe(0.5);
    expect(result.maxScale).toBe(3.0);
  });

  it('should accept empty config', () => {
    expect(() => PinchGestureConfigSchema.parse({})).not.toThrow();
  });
});

describe('LongPressGestureConfigSchema', () => {
  it('should apply default duration of 500ms', () => {
    const result = LongPressGestureConfigSchema.parse({});
    expect(result.duration).toBe(500);
  });

  it('should accept custom duration and tolerance', () => {
    const config: LongPressGestureConfig = { duration: 800, moveTolerance: 10 };
    const result = LongPressGestureConfigSchema.parse(config);
    expect(result.duration).toBe(800);
    expect(result.moveTolerance).toBe(10);
  });
});

describe('GestureConfigSchema', () => {
  it('should accept a swipe gesture config', () => {
    const config: GestureConfig = {
      type: 'swipe',
      swipe: { direction: ['left'] },
    };
    const result = GestureConfigSchema.parse(config);
    expect(result.type).toBe('swipe');
    expect(result.enabled).toBe(true);
  });

  it('should accept a long press gesture with enabled false', () => {
    const result = GestureConfigSchema.parse({
      type: 'long_press',
      enabled: false,
      longPress: { duration: 1000 },
    });
    expect(result.enabled).toBe(false);
  });

  it('should reject missing type', () => {
    expect(() => GestureConfigSchema.parse({})).toThrow();
  });
});

describe('TouchInteractionSchema', () => {
  it('should accept empty config', () => {
    expect(() => TouchInteractionSchema.parse({})).not.toThrow();
  });

  it('should accept full interaction config', () => {
    const config: TouchInteraction = {
      gestures: [
        { type: 'swipe', swipe: { direction: ['up', 'down'] } },
        { type: 'pinch', pinch: { minScale: 1, maxScale: 4 } },
      ],
      touchTarget: { minWidth: 48, minHeight: 48 },
      hapticFeedback: true,
    };
    const result = TouchInteractionSchema.parse(config);
    expect(result.gestures).toHaveLength(2);
    expect(result.hapticFeedback).toBe(true);
  });
});

describe('Type exports', () => {
  it('should have valid type exports', () => {
    const target: TouchTargetConfig = { minWidth: 44, minHeight: 44 };
    const gesture: GestureType = 'swipe';
    const swipe: SwipeGestureConfig = { direction: ['left'] };
    const pinch: PinchGestureConfig = {};
    const longPress: LongPressGestureConfig = {};
    const gestureConfig: GestureConfig = { type: 'drag' };
    const interaction: TouchInteraction = {};
    expect(target).toBeDefined();
    expect(gesture).toBeDefined();
    expect(swipe).toBeDefined();
    expect(pinch).toBeDefined();
    expect(longPress).toBeDefined();
    expect(gestureConfig).toBeDefined();
    expect(interaction).toBeDefined();
  });
});

describe('I18n and ARIA integration', () => {
  it('should reject I18n label on GestureConfigSchema', () => {
    expect(() => GestureConfigSchema.parse({
      type: 'swipe',
      label: { key: 'gestures.swipe_left', defaultValue: 'Swipe to delete' },
    })).toThrow();
  });

  it('should accept plain string label on GestureConfigSchema', () => {
    const result = GestureConfigSchema.parse({ type: 'pinch', label: 'Pinch to zoom' });
    expect(result.label).toBe('Pinch to zoom');
  });

  it('should accept ARIA props on TouchInteractionSchema', () => {
    const result = TouchInteractionSchema.parse({
      ariaLabel: 'Touch-enabled area',
      role: 'application',
    });
    expect(result.ariaLabel).toBe('Touch-enabled area');
    expect(result.role).toBe('application');
  });

  it('should leave I18n/ARIA fields undefined when not provided', () => {
    const gesture = GestureConfigSchema.parse({ type: 'drag' });
    expect(gesture.label).toBeUndefined();
    const interaction = TouchInteractionSchema.parse({});
    expect(interaction.ariaLabel).toBeUndefined();
  });
});
