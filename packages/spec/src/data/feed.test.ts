import { describe, it, expect } from 'vitest';
import { FeedItemType, FeedFilterMode } from './feed.zod';

describe('FeedItemType', () => {
  it('should accept all valid feed item types', () => {
    const types = [
      'comment', 'field_change', 'task', 'event', 'email', 'call',
      'note', 'file', 'record_create', 'record_delete', 'approval',
      'sharing', 'system',
    ];
    types.forEach(type => {
      expect(() => FeedItemType.parse(type)).not.toThrow();
    });
  });

  it('should reject invalid types', () => {
    expect(() => FeedItemType.parse('unknown')).toThrow();
    expect(() => FeedItemType.parse('')).toThrow();
  });
});

describe('FeedFilterMode', () => {
  it('should accept valid filter modes', () => {
    ['all', 'comments_only', 'changes_only', 'tasks_only'].forEach(mode => {
      expect(() => FeedFilterMode.parse(mode)).not.toThrow();
    });
  });

  it('should reject invalid filter mode', () => {
    expect(() => FeedFilterMode.parse('custom')).toThrow();
  });
});
