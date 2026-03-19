// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/core';
import { InMemoryFeedAdapter } from './in-memory-feed-adapter.js';
import type { InMemoryFeedAdapterOptions } from './in-memory-feed-adapter.js';
import { FeedItem, FeedReaction, RecordSubscription } from './objects/index.js';

/**
 * Configuration options for the FeedServicePlugin.
 */
export interface FeedServicePluginOptions {
  /** Feed adapter type (default: 'memory') */
  adapter?: 'memory';
  /** Options for the in-memory adapter */
  memory?: InMemoryFeedAdapterOptions;
}

/**
 * FeedServicePlugin — Production IFeedService implementation.
 *
 * Registers a Feed/Chatter service with the kernel during the init phase.
 * Currently supports in-memory storage for single-process environments.
 *
 * @example
 * ```ts
 * import { ObjectKernel } from '@objectstack/core';
 * import { FeedServicePlugin } from '@objectstack/service-feed';
 *
 * const kernel = new ObjectKernel();
 * kernel.use(new FeedServicePlugin());
 * await kernel.bootstrap();
 *
 * const feed = kernel.getService('feed');
 * const item = await feed.createFeedItem({
 *   object: 'account',
 *   recordId: 'rec_123',
 *   type: 'comment',
 *   actor: { type: 'user', id: 'user_1', name: 'Alice' },
 *   body: 'Great progress!',
 * });
 * ```
 */
export class FeedServicePlugin implements Plugin {
  name = 'com.objectstack.service.feed';
  version = '1.0.0';
  type = 'standard';

  private readonly options: FeedServicePluginOptions;

  constructor(options: FeedServicePluginOptions = {}) {
    this.options = { adapter: 'memory', ...options };
  }

  async init(ctx: PluginContext): Promise<void> {
    const feed = new InMemoryFeedAdapter(this.options.memory);
    ctx.registerService('feed', feed);

    // Register feed system objects so ObjectQLPlugin auto-discovers them
    ctx.registerService('app.com.objectstack.service.feed', {
      id: 'com.objectstack.service.feed',
      name: 'Feed Service',
      version: '1.0.0',
      type: 'plugin',
      objects: [FeedItem, FeedReaction, RecordSubscription],
    });

    ctx.logger.info('FeedServicePlugin: registered in-memory feed adapter');
  }
}
