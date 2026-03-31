// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/core';
import { InMemoryRealtimeAdapter } from './in-memory-realtime-adapter.js';
import type { InMemoryRealtimeAdapterOptions } from './in-memory-realtime-adapter.js';
import { SysPresence } from './objects/index.js';

/**
 * Configuration options for the RealtimeServicePlugin.
 */
export interface RealtimeServicePluginOptions {
  /** Realtime adapter type (default: 'memory') */
  adapter?: 'memory';
  /** Options for the in-memory adapter */
  memory?: InMemoryRealtimeAdapterOptions;
}

/**
 * RealtimeServicePlugin — Production IRealtimeService implementation.
 *
 * Registers a realtime pub/sub service with the kernel during the init phase.
 * Currently supports in-memory pub/sub for single-process environments.
 *
 * @example
 * ```ts
 * import { ObjectKernel } from '@objectstack/core';
 * import { RealtimeServicePlugin } from '@objectstack/service-realtime';
 *
 * const kernel = new ObjectKernel();
 * kernel.use(new RealtimeServicePlugin());
 * await kernel.bootstrap();
 *
 * const realtime = kernel.getService('realtime');
 * await realtime.subscribe('records', (event) => {
 *   console.log(event.type, event.payload);
 * });
 * ```
 */
export class RealtimeServicePlugin implements Plugin {
  name = 'com.objectstack.service.realtime';
  version = '1.0.0';
  type = 'standard';

  private readonly options: RealtimeServicePluginOptions;

  constructor(options: RealtimeServicePluginOptions = {}) {
    this.options = { adapter: 'memory', ...options };
  }

  async init(ctx: PluginContext): Promise<void> {
    const realtime = new InMemoryRealtimeAdapter(this.options.memory);
    ctx.registerService('realtime', realtime);

    // Register realtime system objects so ObjectQLPlugin auto-discovers them
    ctx.registerService('app.com.objectstack.service.realtime', {
      id: 'com.objectstack.service.realtime',
      name: 'Realtime Service',
      version: '1.0.0',
      type: 'plugin',
      namespace: 'sys',
      objects: [SysPresence],
    });

    ctx.logger.info('RealtimeServicePlugin: registered in-memory realtime adapter');
  }
}
