import { describe, it, expect } from 'vitest';
import type { IPluginLifecycleEvents, ITypedEventEmitter } from './plugin-lifecycle-events';

describe('Plugin Lifecycle Events Contract', () => {
  describe('IPluginLifecycleEvents interface', () => {
    it('should define all kernel event types', () => {
      // Compile-time check: verify the event map type is correctly shaped
      const events: Record<keyof Pick<IPluginLifecycleEvents,
        'kernel:ready' | 'kernel:bootstrapped' | 'kernel:listening' | 'kernel:shutdown' | 'kernel:before-init' | 'kernel:after-init'
      >, any> = {
        'kernel:ready': [],
        'kernel:bootstrapped': [],
        'kernel:listening': [],
        'kernel:shutdown': [],
        'kernel:before-init': [],
        'kernel:after-init': [150],
      };

      expect(events['kernel:ready']).toEqual([]);
      expect(events['kernel:after-init']).toEqual([150]);
    });

    it('should define all plugin event types', () => {
      const events: Record<keyof Pick<IPluginLifecycleEvents,
        'plugin:registered' | 'plugin:before-init' | 'plugin:init' |
        'plugin:after-init' | 'plugin:before-start' | 'plugin:started' |
        'plugin:after-start' | 'plugin:before-destroy' | 'plugin:destroyed' |
        'plugin:after-destroy' | 'plugin:error'
      >, any> = {
        'plugin:registered': ['my-plugin'],
        'plugin:before-init': ['my-plugin'],
        'plugin:init': ['my-plugin'],
        'plugin:after-init': ['my-plugin', 50],
        'plugin:before-start': ['my-plugin'],
        'plugin:started': ['my-plugin', 100],
        'plugin:after-start': ['my-plugin', 100],
        'plugin:before-destroy': ['my-plugin'],
        'plugin:destroyed': ['my-plugin'],
        'plugin:after-destroy': ['my-plugin', 25],
        'plugin:error': ['my-plugin', new Error('fail'), 'init'],
      };

      expect(events['plugin:registered']).toEqual(['my-plugin']);
      expect(events['plugin:error'][2]).toBe('init');
    });

    it('should define service and hook event types', () => {
      const events: Record<keyof Pick<IPluginLifecycleEvents,
        'service:registered' | 'service:unregistered' | 'hook:registered' | 'hook:triggered'
      >, any> = {
        'service:registered': ['database'],
        'service:unregistered': ['cache'],
        'hook:registered': ['beforeSave', 3],
        'hook:triggered': ['beforeSave', [{ id: 1 }]],
      };

      expect(events['service:registered']).toEqual(['database']);
      expect(events['hook:registered']).toEqual(['beforeSave', 3]);
    });
  });

  describe('ITypedEventEmitter interface', () => {
    it('should allow a minimal implementation with on/off/emit', () => {
      const handlers = new Map<string, Function[]>();

      const emitter: ITypedEventEmitter<IPluginLifecycleEvents> = {
        on(event, handler) {
          const list = handlers.get(event as string) || [];
          list.push(handler as Function);
          handlers.set(event as string, list);
        },
        off(event, handler) {
          const list = handlers.get(event as string) || [];
          const idx = list.indexOf(handler as Function);
          if (idx >= 0) list.splice(idx, 1);
        },
        async emit(event, ...args) {
          const list = handlers.get(event as string) || [];
          for (const h of list) {
            await h(...args);
          }
        },
      };

      expect(typeof emitter.on).toBe('function');
      expect(typeof emitter.off).toBe('function');
      expect(typeof emitter.emit).toBe('function');
    });

    it('should support registering and emitting typed events', async () => {
      const received: string[] = [];
      const handlers = new Map<string, Function[]>();

      const emitter: ITypedEventEmitter<IPluginLifecycleEvents> = {
        on(event, handler) {
          const list = handlers.get(event as string) || [];
          list.push(handler as Function);
          handlers.set(event as string, list);
        },
        off(event, handler) {
          const list = handlers.get(event as string) || [];
          const idx = list.indexOf(handler as Function);
          if (idx >= 0) list.splice(idx, 1);
        },
        async emit(event, ...args) {
          const list = handlers.get(event as string) || [];
          for (const h of list) {
            await h(...args);
          }
        },
      };

      emitter.on('plugin:registered', (pluginName: string) => {
        received.push(pluginName);
      });

      await emitter.emit('plugin:registered', 'auth-plugin');

      expect(received).toEqual(['auth-plugin']);
    });

    it('should allow optional once, listenerCount, and removeAllListeners', () => {
      const emitter: ITypedEventEmitter<IPluginLifecycleEvents> = {
        on: () => {},
        off: () => {},
        emit: async () => {},
        once: () => {},
        listenerCount: () => 0,
        removeAllListeners: () => {},
      };

      expect(emitter.once).toBeDefined();
      expect(emitter.listenerCount).toBeDefined();
      expect(emitter.removeAllListeners).toBeDefined();
    });
  });
});
