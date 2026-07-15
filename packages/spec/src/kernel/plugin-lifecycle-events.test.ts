import { describe, it, expect } from 'vitest';
import {
  EventPhaseSchema,
  PluginRegisteredEventSchema,
  PluginLifecyclePhaseEventSchema,
  PluginErrorEventSchema,
  ServiceRegisteredEventSchema,
  ServiceUnregisteredEventSchema,
  HookRegisteredEventSchema,
  HookTriggeredEventSchema,
  KernelReadyEventSchema,
  KernelShutdownEventSchema,
  PluginLifecycleEventType,
} from './plugin-lifecycle-events.zod';

describe('Plugin Lifecycle Events Protocol', () => {
  describe('EventPhaseSchema', () => {
    it('should validate valid phases', () => {
      expect(EventPhaseSchema.safeParse('init').success).toBe(true);
      expect(EventPhaseSchema.safeParse('start').success).toBe(true);
      expect(EventPhaseSchema.safeParse('destroy').success).toBe(true);
    });

    it('should reject invalid phases', () => {
      expect(EventPhaseSchema.safeParse('unknown').success).toBe(false);
    });
  });

  describe('PluginRegisteredEventSchema', () => {
    it('should validate plugin registered event', () => {
      const event = {
        pluginName: 'crm-plugin',
        timestamp: Date.now(),
        version: '1.0.0',
      };

      const result = PluginRegisteredEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('should validate event without version', () => {
      const event = {
        pluginName: 'crm-plugin',
        timestamp: Date.now(),
      };

      const result = PluginRegisteredEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe('PluginLifecyclePhaseEventSchema', () => {
    it('should validate lifecycle phase event', () => {
      const event = {
        pluginName: 'crm-plugin',
        timestamp: Date.now(),
        duration: 1250,
        phase: 'init' as const,
      };

      const result = PluginLifecyclePhaseEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe('PluginErrorEventSchema', () => {
    it('should validate plugin error event', () => {
      const event = {
        pluginName: 'failing-plugin',
        timestamp: Date.now(),
        error: { name: 'Error', message: 'Connection failed' },
        phase: 'start' as const,
        errorMessage: 'Connection failed',
      };

      const result = PluginErrorEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('should require phase field', () => {
      const event = {
        pluginName: 'failing-plugin',
        timestamp: Date.now(),
        error: { name: 'Error', message: 'Connection failed' },
        // missing phase
      };

      const result = PluginErrorEventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });
  });

  describe('ServiceRegisteredEventSchema', () => {
    it('should validate service registered event', () => {
      const event = {
        serviceName: 'database',
        timestamp: Date.now(),
        serviceType: 'IDataEngine',
      };

      const result = ServiceRegisteredEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe('ServiceUnregisteredEventSchema', () => {
    it('should validate service unregistered event', () => {
      const event = {
        serviceName: 'database',
        timestamp: Date.now(),
      };

      const result = ServiceUnregisteredEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe('HookRegisteredEventSchema', () => {
    it('should validate hook registered event', () => {
      const event = {
        hookName: 'data.beforeInsert',
        timestamp: Date.now(),
        handlerCount: 3,
      };

      const result = HookRegisteredEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('should reject negative handler count', () => {
      const event = {
        hookName: 'data.beforeInsert',
        timestamp: Date.now(),
        handlerCount: -1,
      };

      const result = HookRegisteredEventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });
  });

  describe('HookTriggeredEventSchema', () => {
    it('should validate hook triggered event', () => {
      const event = {
        hookName: 'data.beforeInsert',
        timestamp: Date.now(),
        args: [{ object: 'customer', data: { name: 'Test' } }],
        handlerCount: 3,
      };

      const result = HookTriggeredEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe('KernelReadyEventSchema', () => {
    it('should validate kernel ready event', () => {
      const event = {
        timestamp: Date.now(),
        duration: 5400,
        pluginCount: 12,
      };

      const result = KernelReadyEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('should validate minimal kernel ready event', () => {
      const event = {
        timestamp: Date.now(),
      };

      const result = KernelReadyEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe('KernelShutdownEventSchema', () => {
    it('should validate kernel shutdown event', () => {
      const event = {
        timestamp: Date.now(),
        reason: 'SIGTERM received',
      };

      const result = KernelShutdownEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe('PluginLifecycleEventType', () => {
    it('should validate all event types', () => {
      const eventTypes = [
        'kernel:ready',
        'kernel:bootstrapped',
        'kernel:listening',
        'kernel:shutdown',
        'kernel:before-init',
        'kernel:after-init',
        'plugin:registered',
        'plugin:before-init',
        'plugin:init',
        'plugin:after-init',
        'plugin:before-start',
        'plugin:started',
        'plugin:after-start',
        'plugin:before-destroy',
        'plugin:destroyed',
        'plugin:after-destroy',
        'plugin:error',
        'service:registered',
        'service:unregistered',
        'hook:registered',
        'hook:triggered',
      ];

      eventTypes.forEach(eventType => {
        const result = PluginLifecycleEventType.safeParse(eventType);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid event type', () => {
      const result = PluginLifecycleEventType.safeParse('invalid:event');
      expect(result.success).toBe(false);
    });
  });
});
