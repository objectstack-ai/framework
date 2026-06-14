// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { InMemoryFeedAdapter, DEFAULT_MAX_FEED_ITEMS } from './in-memory-feed-adapter';
import type { IFeedService, CreateFeedItemInput } from '@objectstack/spec/contracts';

/** Helper to create a standard comment input. */
function commentInput(overrides: Partial<CreateFeedItemInput> = {}): CreateFeedItemInput {
  return {
    object: 'account',
    recordId: 'rec_123',
    type: 'comment',
    actor: { type: 'user', id: 'user_1', name: 'Alice' },
    body: 'Hello world',
    ...overrides,
  };
}

describe('InMemoryFeedAdapter', () => {
  // ==========================================
  // Contract compliance
  // ==========================================

  it('should implement IFeedService contract', () => {
    const feed: IFeedService = new InMemoryFeedAdapter();
    expect(typeof feed.listFeed).toBe('function');
    expect(typeof feed.createFeedItem).toBe('function');
    expect(typeof feed.updateFeedItem).toBe('function');
    expect(typeof feed.deleteFeedItem).toBe('function');
    expect(typeof feed.getFeedItem).toBe('function');
    expect(typeof feed.addReaction).toBe('function');
    expect(typeof feed.removeReaction).toBe('function');
    expect(typeof feed.subscribe).toBe('function');
    expect(typeof feed.unsubscribe).toBe('function');
    expect(typeof feed.getSubscription).toBe('function');
  });

  // ==========================================
  // Feed CRUD
  // ==========================================

  it('should start with zero items', () => {
    const feed = new InMemoryFeedAdapter();
    expect(feed.getItemCount()).toBe(0);
  });

  it('should create a feed item and return it', async () => {
    const feed = new InMemoryFeedAdapter();
    const item = await feed.createFeedItem(commentInput());

    expect(item.id).toBeDefined();
    expect(item.type).toBe('comment');
    expect(item.object).toBe('account');
    expect(item.recordId).toBe('rec_123');
    expect(item.actor.id).toBe('user_1');
    expect(item.body).toBe('Hello world');
    expect(item.visibility).toBe('public');
    expect(item.replyCount).toBe(0);
    expect(item.isEdited).toBe(false);
    expect(item.createdAt).toBeDefined();
    expect(feed.getItemCount()).toBe(1);
  });

  it('should get a feed item by ID', async () => {
    const feed = new InMemoryFeedAdapter();
    const item = await feed.createFeedItem(commentInput());

    const fetched = await feed.getFeedItem(item.id);
    expect(fetched).toEqual(item);
  });

  it('should return null for unknown feed item ID', async () => {
    const feed = new InMemoryFeedAdapter();
    const result = await feed.getFeedItem('nonexistent');
    expect(result).toBeNull();
  });

  it('should update a feed item body and mark as edited', async () => {
    const feed = new InMemoryFeedAdapter();
    const item = await feed.createFeedItem(commentInput());

    const updated = await feed.updateFeedItem(item.id, { body: 'Updated text' });
    expect(updated.body).toBe('Updated text');
    expect(updated.isEdited).toBe(true);
    expect(updated.editedAt).toBeDefined();
    expect(updated.updatedAt).toBeDefined();
  });

  it('should update feed item visibility', async () => {
    const feed = new InMemoryFeedAdapter();
    const item = await feed.createFeedItem(commentInput());

    const updated = await feed.updateFeedItem(item.id, { visibility: 'internal' });
    expect(updated.visibility).toBe('internal');
  });

  it('should throw when updating a non-existent feed item', async () => {
    const feed = new InMemoryFeedAdapter();
    await expect(feed.updateFeedItem('nonexistent', { body: 'x' }))
      .rejects.toThrow(/Feed item not found/);
  });

  it('should delete a feed item', async () => {
    const feed = new InMemoryFeedAdapter();
    const item = await feed.createFeedItem(commentInput());

    await feed.deleteFeedItem(item.id);
    expect(feed.getItemCount()).toBe(0);
    expect(await feed.getFeedItem(item.id)).toBeNull();
  });

  it('should throw when deleting a non-existent feed item', async () => {
    const feed = new InMemoryFeedAdapter();
    await expect(feed.deleteFeedItem('nonexistent'))
      .rejects.toThrow(/Feed item not found/);
  });

  it('should enforce maxItems limit', async () => {
    const feed = new InMemoryFeedAdapter({ maxItems: 2 });

    await feed.createFeedItem(commentInput({ body: 'first' }));
    await feed.createFeedItem(commentInput({ body: 'second' }));

    await expect(feed.createFeedItem(commentInput({ body: 'third' })))
      .rejects.toThrow(/Maximum feed item limit reached/);
  });

  it('enforces a default maxItems cap when none is configured (P0-5 backstop)', async () => {
    // The cap is default-on so a long-running single-instance feed can't grow
    // until OOM. Adapter constructed with no options uses the default cap.
    const feed = new InMemoryFeedAdapter();
    expect(DEFAULT_MAX_FEED_ITEMS).toBeGreaterThan(0);
    expect(Number.isFinite(DEFAULT_MAX_FEED_ITEMS)).toBe(true);
    expect((feed as unknown as { maxItems: number }).maxItems).toBe(DEFAULT_MAX_FEED_ITEMS);
  });

  it('treats maxItems: 0 as an explicit unbounded opt-out', async () => {
    const feed = new InMemoryFeedAdapter({ maxItems: 0 });
    expect((feed as unknown as { maxItems: number }).maxItems).toBe(0);
    for (let i = 0; i < 5; i++) {
      await feed.createFeedItem(commentInput({ body: `c${i}` }));
    }
    expect(feed.getItemCount()).toBe(5);
  });

  // ==========================================
  // Feed Listing & Filtering
  // ==========================================

  it('should list feed items for a record in reverse chronological order', async () => {
    const feed = new InMemoryFeedAdapter();
    await feed.createFeedItem(commentInput({ body: 'first' }));
    await feed.createFeedItem(commentInput({ body: 'second' }));
    await feed.createFeedItem(commentInput({ body: 'third' }));

    const result = await feed.listFeed({ object: 'account', recordId: 'rec_123' });
    expect(result.items).toHaveLength(3);
    expect(result.total).toBe(3);
    expect(result.hasMore).toBe(false);
    // Reverse chronological: third, second, first
    expect(result.items[0].body).toBe('third');
    expect(result.items[2].body).toBe('first');
  });

  it('should not return items from other records', async () => {
    const feed = new InMemoryFeedAdapter();
    await feed.createFeedItem(commentInput({ recordId: 'rec_A' }));
    await feed.createFeedItem(commentInput({ recordId: 'rec_B' }));

    const result = await feed.listFeed({ object: 'account', recordId: 'rec_A' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].recordId).toBe('rec_A');
  });

  it('should filter comments only', async () => {
    const feed = new InMemoryFeedAdapter();
    await feed.createFeedItem(commentInput({ type: 'comment', body: 'comment' }));
    await feed.createFeedItem(commentInput({ type: 'field_change' }));

    const result = await feed.listFeed({
      object: 'account',
      recordId: 'rec_123',
      filter: 'comments_only',
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].type).toBe('comment');
  });

  it('should filter changes only', async () => {
    const feed = new InMemoryFeedAdapter();
    await feed.createFeedItem(commentInput({ type: 'comment' }));
    await feed.createFeedItem(commentInput({ type: 'field_change' }));

    const result = await feed.listFeed({
      object: 'account',
      recordId: 'rec_123',
      filter: 'changes_only',
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].type).toBe('field_change');
  });

  it('should filter tasks only', async () => {
    const feed = new InMemoryFeedAdapter();
    await feed.createFeedItem(commentInput({ type: 'comment' }));
    await feed.createFeedItem(commentInput({ type: 'task' }));

    const result = await feed.listFeed({
      object: 'account',
      recordId: 'rec_123',
      filter: 'tasks_only',
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].type).toBe('task');
  });

  it('should paginate with limit and cursor', async () => {
    const feed = new InMemoryFeedAdapter();
    await feed.createFeedItem(commentInput({ body: 'A' }));
    await feed.createFeedItem(commentInput({ body: 'B' }));
    await feed.createFeedItem(commentInput({ body: 'C' }));

    // First page
    const page1 = await feed.listFeed({
      object: 'account',
      recordId: 'rec_123',
      limit: 2,
    });
    expect(page1.items).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBeDefined();

    // Second page
    const page2 = await feed.listFeed({
      object: 'account',
      recordId: 'rec_123',
      limit: 2,
      cursor: page1.nextCursor,
    });
    expect(page2.items).toHaveLength(1);
    expect(page2.hasMore).toBe(false);
  });

  // ==========================================
  // Threading
  // ==========================================

  it('should support threaded replies and track reply count', async () => {
    const feed = new InMemoryFeedAdapter();
    const parent = await feed.createFeedItem(commentInput({ body: 'parent' }));

    await feed.createFeedItem(commentInput({
      body: 'reply 1',
      parentId: parent.id,
    }));

    const updatedParent = await feed.getFeedItem(parent.id);
    expect(updatedParent!.replyCount).toBe(1);
  });

  it('should decrement reply count on reply deletion', async () => {
    const feed = new InMemoryFeedAdapter();
    const parent = await feed.createFeedItem(commentInput({ body: 'parent' }));
    const reply = await feed.createFeedItem(commentInput({
      body: 'reply',
      parentId: parent.id,
    }));

    await feed.deleteFeedItem(reply.id);

    const updatedParent = await feed.getFeedItem(parent.id);
    expect(updatedParent!.replyCount).toBe(0);
  });

  it('should throw when creating a reply with invalid parent', async () => {
    const feed = new InMemoryFeedAdapter();
    await expect(
      feed.createFeedItem(commentInput({ parentId: 'nonexistent' })),
    ).rejects.toThrow(/Parent feed item not found/);
  });

  // ==========================================
  // Reactions
  // ==========================================

  it('should add a reaction to a feed item', async () => {
    const feed = new InMemoryFeedAdapter();
    const item = await feed.createFeedItem(commentInput());

    const reactions = await feed.addReaction(item.id, '👍', 'user_1');
    expect(reactions).toHaveLength(1);
    expect(reactions[0].emoji).toBe('👍');
    expect(reactions[0].userIds).toEqual(['user_1']);
    expect(reactions[0].count).toBe(1);
  });

  it('should add multiple users to the same reaction', async () => {
    const feed = new InMemoryFeedAdapter();
    const item = await feed.createFeedItem(commentInput());

    await feed.addReaction(item.id, '👍', 'user_1');
    const reactions = await feed.addReaction(item.id, '👍', 'user_2');

    expect(reactions[0].userIds).toEqual(['user_1', 'user_2']);
    expect(reactions[0].count).toBe(2);
  });

  it('should support multiple emoji types on the same item', async () => {
    const feed = new InMemoryFeedAdapter();
    const item = await feed.createFeedItem(commentInput());

    await feed.addReaction(item.id, '👍', 'user_1');
    const reactions = await feed.addReaction(item.id, '❤️', 'user_1');

    expect(reactions).toHaveLength(2);
  });

  it('should throw when adding duplicate reaction', async () => {
    const feed = new InMemoryFeedAdapter();
    const item = await feed.createFeedItem(commentInput());

    await feed.addReaction(item.id, '👍', 'user_1');
    await expect(feed.addReaction(item.id, '👍', 'user_1'))
      .rejects.toThrow(/Reaction already exists/);
  });

  it('should remove a reaction', async () => {
    const feed = new InMemoryFeedAdapter();
    const item = await feed.createFeedItem(commentInput());

    await feed.addReaction(item.id, '👍', 'user_1');
    await feed.addReaction(item.id, '👍', 'user_2');

    const reactions = await feed.removeReaction(item.id, '👍', 'user_1');
    expect(reactions[0].userIds).toEqual(['user_2']);
    expect(reactions[0].count).toBe(1);
  });

  it('should remove reaction entry when last user removes', async () => {
    const feed = new InMemoryFeedAdapter();
    const item = await feed.createFeedItem(commentInput());

    await feed.addReaction(item.id, '👍', 'user_1');
    const reactions = await feed.removeReaction(item.id, '👍', 'user_1');

    expect(reactions).toHaveLength(0);
  });

  it('should throw when removing a non-existent reaction', async () => {
    const feed = new InMemoryFeedAdapter();
    const item = await feed.createFeedItem(commentInput());

    await expect(feed.removeReaction(item.id, '👍', 'user_1'))
      .rejects.toThrow(/Reaction not found/);
  });

  it('should throw when adding/removing reaction on non-existent item', async () => {
    const feed = new InMemoryFeedAdapter();

    await expect(feed.addReaction('nonexistent', '👍', 'user_1'))
      .rejects.toThrow(/Feed item not found/);
    await expect(feed.removeReaction('nonexistent', '👍', 'user_1'))
      .rejects.toThrow(/Feed item not found/);
  });

  // ==========================================
  // Subscriptions
  // ==========================================

  it('should start with zero subscriptions', () => {
    const feed = new InMemoryFeedAdapter();
    expect(feed.getSubscriptionCount()).toBe(0);
  });

  it('should subscribe to record notifications', async () => {
    const feed = new InMemoryFeedAdapter();

    const sub = await feed.subscribe({
      object: 'account',
      recordId: 'rec_123',
      userId: 'user_1',
      events: ['comment', 'field_change'],
      channels: ['in_app', 'email'],
    });

    expect(sub.object).toBe('account');
    expect(sub.recordId).toBe('rec_123');
    expect(sub.userId).toBe('user_1');
    expect(sub.events).toEqual(['comment', 'field_change']);
    expect(sub.channels).toEqual(['in_app', 'email']);
    expect(sub.active).toBe(true);
    expect(sub.createdAt).toBeDefined();
    expect(feed.getSubscriptionCount()).toBe(1);
  });

  it('should use default events and channels', async () => {
    const feed = new InMemoryFeedAdapter();

    const sub = await feed.subscribe({
      object: 'account',
      recordId: 'rec_123',
      userId: 'user_1',
    });

    expect(sub.events).toEqual(['all']);
    expect(sub.channels).toEqual(['in_app']);
  });

  it('should update existing subscription instead of creating duplicate', async () => {
    const feed = new InMemoryFeedAdapter();

    await feed.subscribe({
      object: 'account',
      recordId: 'rec_123',
      userId: 'user_1',
      events: ['comment'],
    });

    const updated = await feed.subscribe({
      object: 'account',
      recordId: 'rec_123',
      userId: 'user_1',
      events: ['comment', 'field_change'],
    });

    expect(feed.getSubscriptionCount()).toBe(1);
    expect(updated.events).toEqual(['comment', 'field_change']);
  });

  it('should get a subscription by record and user', async () => {
    const feed = new InMemoryFeedAdapter();

    await feed.subscribe({
      object: 'account',
      recordId: 'rec_123',
      userId: 'user_1',
    });

    const sub = await feed.getSubscription('account', 'rec_123', 'user_1');
    expect(sub).not.toBeNull();
    expect(sub!.userId).toBe('user_1');
  });

  it('should return null for non-existent subscription', async () => {
    const feed = new InMemoryFeedAdapter();
    const sub = await feed.getSubscription('account', 'rec_123', 'user_1');
    expect(sub).toBeNull();
  });

  it('should unsubscribe from record notifications', async () => {
    const feed = new InMemoryFeedAdapter();

    await feed.subscribe({
      object: 'account',
      recordId: 'rec_123',
      userId: 'user_1',
    });

    const result = await feed.unsubscribe('account', 'rec_123', 'user_1');
    expect(result).toBe(true);
    expect(feed.getSubscriptionCount()).toBe(0);
  });

  it('should return false when unsubscribing without existing subscription', async () => {
    const feed = new InMemoryFeedAdapter();
    const result = await feed.unsubscribe('account', 'rec_123', 'user_1');
    expect(result).toBe(false);
  });

  // ==========================================
  // Edge cases
  // ==========================================

  it('should create feed items with mentions', async () => {
    const feed = new InMemoryFeedAdapter();

    const item = await feed.createFeedItem(commentInput({
      body: 'Hello @jane',
      mentions: [{ type: 'user', id: 'user_2', name: 'Jane', offset: 6, length: 5 }],
    }));

    expect(item.mentions).toHaveLength(1);
    expect(item.mentions![0].name).toBe('Jane');
  });

  it('should create feed items with field changes', async () => {
    const feed = new InMemoryFeedAdapter();

    const item = await feed.createFeedItem({
      object: 'account',
      recordId: 'rec_123',
      type: 'field_change',
      actor: { type: 'user', id: 'user_1' },
      changes: [
        { field: 'status', oldDisplayValue: 'New', newDisplayValue: 'Active' },
      ],
    });

    expect(item.type).toBe('field_change');
    expect(item.changes).toHaveLength(1);
    expect(item.changes![0].field).toBe('status');
  });

  it('should return unique feed item IDs', async () => {
    const feed = new InMemoryFeedAdapter();

    const item1 = await feed.createFeedItem(commentInput({ body: 'A' }));
    const item2 = await feed.createFeedItem(commentInput({ body: 'B' }));
    const item3 = await feed.createFeedItem(commentInput({ body: 'C' }));

    expect(item1.id).not.toBe(item2.id);
    expect(item2.id).not.toBe(item3.id);
  });

  it('should persist reaction state in the feed item', async () => {
    const feed = new InMemoryFeedAdapter();
    const item = await feed.createFeedItem(commentInput());

    await feed.addReaction(item.id, '👍', 'user_1');

    const fetched = await feed.getFeedItem(item.id);
    expect(fetched!.reactions).toHaveLength(1);
    expect(fetched!.reactions![0].emoji).toBe('👍');
  });
});
