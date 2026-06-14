// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  IFeedService,
  CreateFeedItemInput,
  UpdateFeedItemInput,
  ListFeedOptions,
  FeedListResult,
  SubscribeInput,
} from '@objectstack/spec/contracts';
import type { FeedItem, Reaction } from '@objectstack/spec/data';
import type { RecordSubscription } from '@objectstack/spec/data';

/**
 * Default safety cap on stored feed items. This adapter is process-local and
 * non-durable (the v1 single-instance contract — see launch-readiness.md P0-5),
 * so an unbounded store would grow until the pod OOMs. The cap is a backstop:
 * `createFeedItem` throws loudly once it's reached rather than letting memory
 * grow without bound. Operators who need a higher ceiling raise `maxItems`;
 * `maxItems: 0` opts out entirely (unbounded — only for tests / short-lived
 * processes).
 */
export const DEFAULT_MAX_FEED_ITEMS = 100_000;

/**
 * Configuration options for InMemoryFeedAdapter.
 */
export interface InMemoryFeedAdapterOptions {
  /**
   * Maximum number of feed items to store. Defaults to
   * {@link DEFAULT_MAX_FEED_ITEMS}; `0` = unbounded (explicit opt-out).
   */
  maxItems?: number;
}

/**
 * In-memory Feed/Chatter adapter implementing IFeedService.
 *
 * Uses Map-backed stores for feed items, reactions, and subscriptions.
 * Supports feed CRUD, emoji reactions, threaded replies, and record subscriptions.
 *
 * Suitable for single-process environments, development, and testing.
 * For production deployments, use a database-backed adapter.
 *
 * @example
 * ```ts
 * const feed = new InMemoryFeedAdapter();
 *
 * const item = await feed.createFeedItem({
 *   object: 'account',
 *   recordId: 'rec_123',
 *   type: 'comment',
 *   actor: { type: 'user', id: 'user_1', name: 'Alice' },
 *   body: 'Great progress!',
 * });
 *
 * const list = await feed.listFeed({ object: 'account', recordId: 'rec_123' });
 * ```
 */
export class InMemoryFeedAdapter implements IFeedService {
  private readonly items = new Map<string, FeedItem>();
  private counter = 0;
  private readonly subscriptions = new Map<string, RecordSubscription>();
  private readonly maxItems: number;

  constructor(options: InMemoryFeedAdapterOptions = {}) {
    this.maxItems = options.maxItems ?? DEFAULT_MAX_FEED_ITEMS;
  }

  async listFeed(options: ListFeedOptions): Promise<FeedListResult> {
    let items = Array.from(this.items.values()).filter(
      (item) => item.object === options.object && item.recordId === options.recordId,
    );

    // Apply filter
    if (options.filter && options.filter !== 'all') {
      items = items.filter((item) => {
        switch (options.filter) {
          case 'comments_only':
            return item.type === 'comment';
          case 'changes_only':
            return item.type === 'field_change';
          case 'tasks_only':
            return item.type === 'task';
          default:
            return true;
        }
      });
    }

    // Sort reverse chronological (stable: break ties by ID descending)
    items.sort((a, b) => {
      const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
    });

    const total = items.length;
    const limit = options.limit ?? 20;

    // Cursor-based pagination
    let startIndex = 0;
    if (options.cursor) {
      const cursorIndex = items.findIndex((item) => item.id === options.cursor);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }

    const page = items.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < total;

    return {
      items: page,
      total,
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1].id : undefined,
      hasMore,
    };
  }

  async createFeedItem(input: CreateFeedItemInput): Promise<FeedItem> {
    if (this.maxItems > 0 && this.items.size >= this.maxItems) {
      throw new Error(
        `Maximum feed item limit reached (${this.maxItems}). ` +
        'Delete existing items before adding new ones.',
      );
    }

    const id = `feed_${++this.counter}`;
    const now = new Date().toISOString();

    // Increment parent reply count if threading
    if (input.parentId) {
      const parent = this.items.get(input.parentId);
      if (!parent) {
        throw new Error(`Parent feed item not found: ${input.parentId}`);
      }
      const updatedParent: FeedItem = {
        ...parent,
        replyCount: (parent.replyCount ?? 0) + 1,
        updatedAt: now,
      };
      this.items.set(parent.id, updatedParent);
    }

    const item: FeedItem = {
      id,
      type: input.type as FeedItem['type'],
      object: input.object,
      recordId: input.recordId,
      actor: {
        type: input.actor.type,
        id: input.actor.id,
        ...(input.actor.name ? { name: input.actor.name } : {}),
        ...(input.actor.avatarUrl ? { avatarUrl: input.actor.avatarUrl } : {}),
      },
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.mentions ? { mentions: input.mentions } : {}),
      ...(input.changes ? { changes: input.changes } : {}),
      ...(input.parentId ? { parentId: input.parentId } : {}),
      visibility: input.visibility ?? 'public',
      replyCount: 0,
      isEdited: false,
      pinned: false,
      starred: false,
      createdAt: now,
    };

    this.items.set(id, item);
    return item;
  }

  async updateFeedItem(feedId: string, input: UpdateFeedItemInput): Promise<FeedItem> {
    const existing = this.items.get(feedId);
    if (!existing) {
      throw new Error(`Feed item not found: ${feedId}`);
    }

    const now = new Date().toISOString();
    const updated: FeedItem = {
      ...existing,
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.mentions !== undefined ? { mentions: input.mentions } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
      updatedAt: now,
      editedAt: now,
      isEdited: true,
    };

    this.items.set(feedId, updated);
    return updated;
  }

  async deleteFeedItem(feedId: string): Promise<void> {
    const item = this.items.get(feedId);
    if (!item) {
      throw new Error(`Feed item not found: ${feedId}`);
    }

    // Decrement parent reply count if threaded
    if (item.parentId) {
      const parent = this.items.get(item.parentId);
      if (parent) {
        const updatedParent: FeedItem = {
          ...parent,
          replyCount: Math.max(0, (parent.replyCount ?? 0) - 1),
        };
        this.items.set(parent.id, updatedParent);
      }
    }

    this.items.delete(feedId);
  }

  async getFeedItem(feedId: string): Promise<FeedItem | null> {
    return this.items.get(feedId) ?? null;
  }

  async addReaction(feedId: string, emoji: string, userId: string): Promise<Reaction[]> {
    const item = this.items.get(feedId);
    if (!item) {
      throw new Error(`Feed item not found: ${feedId}`);
    }

    const reactions = [...(item.reactions ?? [])];
    const existing = reactions.find((r) => r.emoji === emoji);

    if (existing) {
      if (existing.userIds.includes(userId)) {
        throw new Error(`Reaction already exists: ${emoji} by ${userId}`);
      }
      existing.userIds = [...existing.userIds, userId];
      existing.count = existing.userIds.length;
    } else {
      reactions.push({ emoji, userIds: [userId], count: 1 });
    }

    const updated: FeedItem = { ...item, reactions };
    this.items.set(feedId, updated);
    return reactions;
  }

  async removeReaction(feedId: string, emoji: string, userId: string): Promise<Reaction[]> {
    const item = this.items.get(feedId);
    if (!item) {
      throw new Error(`Feed item not found: ${feedId}`);
    }

    let reactions = [...(item.reactions ?? [])];
    const existing = reactions.find((r) => r.emoji === emoji);

    if (!existing || !existing.userIds.includes(userId)) {
      throw new Error(`Reaction not found: ${emoji} by ${userId}`);
    }

    existing.userIds = existing.userIds.filter((id) => id !== userId);
    existing.count = existing.userIds.length;

    // Remove reaction entry if no users left
    reactions = reactions.filter((r) => r.count > 0);

    const updated: FeedItem = { ...item, reactions };
    this.items.set(feedId, updated);
    return reactions;
  }

  async subscribe(input: SubscribeInput): Promise<RecordSubscription> {
    const key = this.subscriptionKey(input.object, input.recordId, input.userId);
    const existing = this.findSubscription(input.object, input.recordId, input.userId);

    if (existing) {
      // Update existing subscription
      const updated: RecordSubscription = {
        ...existing,
        events: input.events ?? existing.events,
        channels: input.channels ?? existing.channels,
        active: true,
      };
      this.subscriptions.set(key, updated);
      return updated;
    }

    const now = new Date().toISOString();
    const subscription: RecordSubscription = {
      object: input.object,
      recordId: input.recordId,
      userId: input.userId,
      events: input.events ?? ['all'],
      channels: input.channels ?? ['in_app'],
      active: true,
      createdAt: now,
    };

    this.subscriptions.set(key, subscription);
    return subscription;
  }

  async unsubscribe(object: string, recordId: string, userId: string): Promise<boolean> {
    const key = this.subscriptionKey(object, recordId, userId);
    return this.subscriptions.delete(key);
  }

  async getSubscription(
    object: string,
    recordId: string,
    userId: string,
  ): Promise<RecordSubscription | null> {
    return this.findSubscription(object, recordId, userId);
  }

  /**
   * Get the total number of feed items stored.
   */
  getItemCount(): number {
    return this.items.size;
  }

  /**
   * Get the total number of subscriptions stored.
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  private subscriptionKey(object: string, recordId: string, userId: string): string {
    return `${object}:${recordId}:${userId}`;
  }

  private findSubscription(
    object: string,
    recordId: string,
    userId: string,
  ): RecordSubscription | null {
    const key = this.subscriptionKey(object, recordId, userId);
    return this.subscriptions.get(key) ?? null;
  }
}
