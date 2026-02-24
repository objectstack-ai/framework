import { describe, it, expect } from 'vitest';
import {
  TransitionPresetSchema,
  EasingFunctionSchema,
  TransitionConfigSchema,
  AnimationTriggerSchema,
  ComponentAnimationSchema,
  PageTransitionSchema,
  MotionConfigSchema,
  type TransitionPreset,
  type EasingFunction,
  type TransitionConfig,
  type AnimationTrigger,
  type ComponentAnimation,
  type PageTransition,
  type MotionConfig,
} from './animation.zod';

describe('TransitionPresetSchema', () => {
  it('should accept all valid presets', () => {
    const presets = ['fade', 'slide_up', 'slide_down', 'slide_left', 'slide_right', 'scale', 'rotate', 'flip', 'none'] as const;
    presets.forEach(preset => {
      expect(() => TransitionPresetSchema.parse(preset)).not.toThrow();
    });
  });

  it('should reject invalid presets', () => {
    expect(() => TransitionPresetSchema.parse('dissolve')).toThrow();
    expect(() => TransitionPresetSchema.parse('')).toThrow();
  });
});

describe('EasingFunctionSchema', () => {
  it('should accept all valid easing functions', () => {
    const easings = ['linear', 'ease', 'ease_in', 'ease_out', 'ease_in_out', 'spring'] as const;
    easings.forEach(easing => {
      expect(() => EasingFunctionSchema.parse(easing)).not.toThrow();
    });
  });

  it('should reject invalid easing functions', () => {
    expect(() => EasingFunctionSchema.parse('bounce')).toThrow();
    expect(() => EasingFunctionSchema.parse('')).toThrow();
  });
});

describe('TransitionConfigSchema', () => {
  it('should accept empty config', () => {
    const result = TransitionConfigSchema.parse({});
    expect(result).toEqual({});
  });

  it('should accept full config with all fields', () => {
    const config: TransitionConfig = {
      preset: 'fade',
      duration: 200,
      easing: 'ease_in_out',
      delay: 50,
      customKeyframes: 'bounce-in',
    };
    const result = TransitionConfigSchema.parse(config);
    expect(result.preset).toBe('fade');
    expect(result.duration).toBe(200);
    expect(result.easing).toBe('ease_in_out');
    expect(result.delay).toBe(50);
    expect(result.customKeyframes).toBe('bounce-in');
  });

  it('should leave optional fields undefined when not provided', () => {
    const result = TransitionConfigSchema.parse({ duration: 100 });
    expect(result.duration).toBe(100);
    expect(result.preset).toBeUndefined();
    expect(result.easing).toBeUndefined();
    expect(result.delay).toBeUndefined();
    expect(result.customKeyframes).toBeUndefined();
  });
});

describe('AnimationTriggerSchema', () => {
  it('should accept all valid triggers', () => {
    const triggers = ['on_mount', 'on_unmount', 'on_hover', 'on_focus', 'on_click', 'on_scroll', 'on_visible'] as const;
    triggers.forEach(trigger => {
      expect(() => AnimationTriggerSchema.parse(trigger)).not.toThrow();
    });
  });

  it('should reject invalid triggers', () => {
    expect(() => AnimationTriggerSchema.parse('on_drag')).toThrow();
    expect(() => AnimationTriggerSchema.parse('')).toThrow();
  });
});

describe('ComponentAnimationSchema', () => {
  it('should apply default reducedMotion for empty config', () => {
    const result = ComponentAnimationSchema.parse({});
    expect(result.reducedMotion).toBe('respect');
  });

  it('should accept full config with enter/exit/hover/trigger/reducedMotion', () => {
    const config: ComponentAnimation = {
      enter: { preset: 'slide_up', duration: 300, easing: 'ease_out' },
      exit: { preset: 'fade', duration: 200 },
      hover: { preset: 'scale', duration: 150 },
      trigger: 'on_visible',
      reducedMotion: 'alternative',
    };
    const result = ComponentAnimationSchema.parse(config);
    expect(result.enter?.preset).toBe('slide_up');
    expect(result.exit?.preset).toBe('fade');
    expect(result.hover?.preset).toBe('scale');
    expect(result.trigger).toBe('on_visible');
    expect(result.reducedMotion).toBe('alternative');
  });

  it('should accept disable for reducedMotion', () => {
    const result = ComponentAnimationSchema.parse({ reducedMotion: 'disable' });
    expect(result.reducedMotion).toBe('disable');
  });
});

describe('PageTransitionSchema', () => {
  it('should apply defaults for empty config', () => {
    const result = PageTransitionSchema.parse({});
    expect(result.type).toBe('fade');
    expect(result.duration).toBe(300);
    expect(result.easing).toBe('ease_in_out');
    expect(result.crossFade).toBe(false);
  });

  it('should accept full config overriding defaults', () => {
    const config: PageTransition = {
      type: 'slide_left',
      duration: 500,
      easing: 'spring',
      crossFade: true,
    };
    const result = PageTransitionSchema.parse(config);
    expect(result.type).toBe('slide_left');
    expect(result.duration).toBe(500);
    expect(result.easing).toBe('spring');
    expect(result.crossFade).toBe(true);
  });
});

describe('MotionConfigSchema', () => {
  it('should apply defaults for empty config', () => {
    const result = MotionConfigSchema.parse({});
    expect(result.enabled).toBe(true);
    expect(result.reducedMotion).toBe(false);
  });

  it('should accept full config with componentAnimations record', () => {
    const config: MotionConfig = {
      defaultTransition: { preset: 'fade', duration: 250, easing: 'ease' },
      pageTransitions: { type: 'slide_right', duration: 400, easing: 'ease_in_out', crossFade: false },
      componentAnimations: {
        card: { enter: { preset: 'scale', duration: 200 }, reducedMotion: 'respect' },
        modal: { enter: { preset: 'slide_up' }, exit: { preset: 'fade' }, reducedMotion: 'disable' },
      },
      reducedMotion: true,
      enabled: false,
    };
    const result = MotionConfigSchema.parse(config);
    expect(result.defaultTransition?.preset).toBe('fade');
    expect(result.pageTransitions?.type).toBe('slide_right');
    expect(result.componentAnimations?.card.enter?.preset).toBe('scale');
    expect(result.componentAnimations?.modal.reducedMotion).toBe('disable');
    expect(result.reducedMotion).toBe(true);
    expect(result.enabled).toBe(false);
  });

  it('should leave optional fields undefined when not provided', () => {
    const result = MotionConfigSchema.parse({});
    expect(result.defaultTransition).toBeUndefined();
    expect(result.pageTransitions).toBeUndefined();
    expect(result.componentAnimations).toBeUndefined();
  });
});

describe('Type exports', () => {
  it('should have valid type exports', () => {
    const preset: TransitionPreset = 'fade';
    const easing: EasingFunction = 'linear';
    const transition: TransitionConfig = {};
    const trigger: AnimationTrigger = 'on_mount';
    const component: ComponentAnimation = { reducedMotion: 'respect' };
    const page: PageTransition = { type: 'fade', duration: 300, easing: 'ease_in_out', crossFade: false };
    const motion: MotionConfig = { reducedMotion: false, enabled: true };
    expect(preset).toBeDefined();
    expect(easing).toBeDefined();
    expect(transition).toBeDefined();
    expect(trigger).toBeDefined();
    expect(component).toBeDefined();
    expect(page).toBeDefined();
    expect(motion).toBeDefined();
  });
});

describe('I18n and ARIA integration', () => {
  it('should accept I18n label on ComponentAnimationSchema', () => {
    const result = ComponentAnimationSchema.parse({
      label: { key: 'animations.card_enter', defaultValue: 'Card Enter' },
    });
    expect(result.label).toEqual({ key: 'animations.card_enter', defaultValue: 'Card Enter' });
  });

  it('should accept plain string label on ComponentAnimationSchema', () => {
    const result = ComponentAnimationSchema.parse({ label: 'Slide In' });
    expect(result.label).toBe('Slide In');
  });

  it('should accept ARIA props on ComponentAnimationSchema', () => {
    const result = ComponentAnimationSchema.parse({
      ariaLabel: 'Animated card',
      ariaDescribedBy: 'card-desc',
      role: 'presentation',
    });
    expect(result.ariaLabel).toBe('Animated card');
    expect(result.ariaDescribedBy).toBe('card-desc');
    expect(result.role).toBe('presentation');
  });

  it('should accept I18n label on MotionConfigSchema', () => {
    const result = MotionConfigSchema.parse({
      label: { key: 'motion.global', defaultValue: 'Global Motion Config' },
    });
    expect(result.label).toEqual({ key: 'motion.global', defaultValue: 'Global Motion Config' });
  });

  it('should leave I18n/ARIA fields undefined when not provided', () => {
    const result = ComponentAnimationSchema.parse({});
    expect(result.label).toBeUndefined();
    expect(result.ariaLabel).toBeUndefined();
    expect(result.ariaDescribedBy).toBeUndefined();
    expect(result.role).toBeUndefined();
  });
});

// ============================================================================
// Issue #6: TransitionConfigSchema themeToken support
// ============================================================================
describe('TransitionConfigSchema - themeToken', () => {
  it('should accept transition with themeToken reference', () => {
    const result = TransitionConfigSchema.parse({
      themeToken: 'animation.duration.fast',
    });
    expect(result.themeToken).toBe('animation.duration.fast');
  });

  it('should accept transition combining themeToken with explicit values', () => {
    const result = TransitionConfigSchema.parse({
      preset: 'fade',
      duration: 200,
      easing: 'ease_in_out',
      themeToken: 'animation.timing.ease_in_out',
    });
    expect(result.themeToken).toBe('animation.timing.ease_in_out');
    expect(result.duration).toBe(200);
  });

  it('should leave themeToken undefined when not provided', () => {
    const result = TransitionConfigSchema.parse({ duration: 300 });
    expect(result.themeToken).toBeUndefined();
  });
});
