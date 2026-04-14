# @objectstack/service-feed

Feed/Chatter Service for ObjectStack — implements `IFeedService` with in-memory adapter for comments, reactions, field changes, and record subscriptions.

## Features

- **Activity Feed**: Track all record changes and user activities
- **Comments & Mentions**: Add comments with @mentions support
- **Reactions**: Like, upvote, or react to records and comments
- **Field Change Tracking**: Automatic history of field value changes
- **Subscriptions**: Subscribe to records for notifications
- **Rich Content**: Support for markdown, attachments, and embeds
- **Real-time Updates**: Integrates with `@objectstack/service-realtime` for live updates

## Installation

```bash
pnpm add @objectstack/service-feed
```

## Basic Usage

```typescript
import { defineStack } from '@objectstack/spec';
import { ServiceFeed } from '@objectstack/service-feed';

const stack = defineStack({
  services: [
    ServiceFeed.configure({
      enableFieldTracking: true,
      enableMentions: true,
    }),
  ],
});
```

## Configuration

```typescript
interface FeedServiceConfig {
  /** Enable automatic field change tracking */
  enableFieldTracking?: boolean;

  /** Enable @mention support in comments */
  enableMentions?: boolean;

  /** Enable reactions (likes, upvotes, etc.) */
  enableReactions?: boolean;

  /** Maximum feed items per page */
  pageSize?: number;
}
```

## Service API

```typescript
// Get feed service
const feed = kernel.getService<IFeedService>('feed');
```

### Comments

```typescript
// Add a comment to a record
await feed.addComment({
  object: 'opportunity',
  recordId: '123',
  userId: 'user:456',
  body: 'Great progress on this deal! @john can you follow up?',
});

// Get comments for a record
const comments = await feed.getComments({
  object: 'opportunity',
  recordId: '123',
  limit: 20,
});

// Update a comment
await feed.updateComment({
  commentId: 'comment:789',
  body: 'Updated comment text',
});

// Delete a comment
await feed.deleteComment('comment:789');
```

### Reactions

```typescript
// Add a reaction
await feed.addReaction({
  targetType: 'record', // or 'comment'
  targetId: '123',
  userId: 'user:456',
  type: 'like', // 'like', 'love', 'upvote', 'celebrate'
});

// Remove a reaction
await feed.removeReaction({
  targetType: 'record',
  targetId: '123',
  userId: 'user:456',
  type: 'like',
});

// Get reactions for a record
const reactions = await feed.getReactions({
  targetType: 'record',
  targetId: '123',
});
// Returns: { like: 12, love: 5, upvote: 8 }
```

### Activity Feed

```typescript
// Get feed for a specific record
const recordFeed = await feed.getFeed({
  object: 'account',
  recordId: '123',
  types: ['comment', 'field_change', 'record_created'],
  limit: 50,
});

// Get user's personalized feed (records they follow)
const userFeed = await feed.getUserFeed({
  userId: 'user:456',
  limit: 100,
});

// Example feed item:
// {
//   id: 'feed:abc',
//   type: 'field_change',
//   object: 'opportunity',
//   recordId: '123',
//   userId: 'user:456',
//   timestamp: '2024-01-15T10:30:00Z',
//   data: {
//     field: 'stage',
//     oldValue: 'prospecting',
//     newValue: 'proposal'
//   }
// }
```

### Subscriptions

```typescript
// Subscribe to a record
await feed.subscribe({
  object: 'opportunity',
  recordId: '123',
  userId: 'user:456',
});

// Unsubscribe from a record
await feed.unsubscribe({
  object: 'opportunity',
  recordId: '123',
  userId: 'user:456',
});

// Check if user is subscribed
const isSubscribed = await feed.isSubscribed({
  object: 'opportunity',
  recordId: '123',
  userId: 'user:456',
});

// Get all subscriptions for a user
const subscriptions = await feed.getUserSubscriptions('user:456');
```

### Field Change Tracking

Field changes are automatically tracked when `enableFieldTracking` is enabled:

```typescript
// Automatically creates feed items like:
// {
//   type: 'field_change',
//   object: 'opportunity',
//   recordId: '123',
//   userId: 'user:456',
//   data: {
//     field: 'amount',
//     oldValue: 50000,
//     newValue: 75000
//   }
// }
```

Customize which fields to track:

```typescript
ServiceFeed.configure({
  enableFieldTracking: true,
  trackedObjects: {
    opportunity: ['stage', 'amount', 'close_date'],
    account: ['status', 'industry'],
  },
});
```

## Advanced Features

### Mentions & Notifications

```typescript
// Parse mentions from comment body
const mentions = feed.parseMentions('Hey @john and @sarah, check this out!');
// Returns: ['john', 'sarah']

// Get mentions for a user
const userMentions = await feed.getMentions('user:456', {
  unreadOnly: true,
});

// Mark mention as read
await feed.markMentionRead({
  mentionId: 'mention:abc',
  userId: 'user:456',
});
```

### Rich Content

```typescript
await feed.addComment({
  object: 'opportunity',
  recordId: '123',
  userId: 'user:456',
  body: '## Great News!\n\nWe closed the deal at **$100k**!',
  format: 'markdown',
  attachments: [
    {
      type: 'file',
      url: 'https://example.com/contract.pdf',
      name: 'contract.pdf',
      size: 1024000,
    },
  ],
});
```

### Filtering & Search

```typescript
// Get feed with filters
const feed = await feed.getFeed({
  object: 'opportunity',
  recordId: '123',
  types: ['comment'], // Only comments
  userId: 'user:456', // Only from specific user
  since: '2024-01-01T00:00:00Z',
  until: '2024-01-31T23:59:59Z',
});

// Search comments
const results = await feed.searchComments({
  query: 'follow up',
  object: 'opportunity',
  recordId: '123',
});
```

## Integration with Realtime Service

```typescript
// Subscribe to real-time feed updates
const realtime = kernel.getService<IRealtimeService>('realtime');

realtime.subscribe(`feed:opportunity:123`, (event) => {
  if (event.type === 'comment_added') {
    console.log('New comment:', event.data);
  } else if (event.type === 'field_changed') {
    console.log('Field changed:', event.data);
  }
});
```

## REST API Endpoints

```
POST   /api/v1/feed/comments                    # Add comment
GET    /api/v1/feed/comments/:object/:recordId  # Get comments
PATCH  /api/v1/feed/comments/:id                # Update comment
DELETE /api/v1/feed/comments/:id                # Delete comment

POST   /api/v1/feed/reactions                   # Add reaction
DELETE /api/v1/feed/reactions                   # Remove reaction
GET    /api/v1/feed/reactions/:type/:id         # Get reactions

GET    /api/v1/feed/:object/:recordId           # Get record feed
GET    /api/v1/feed/user/:userId                # Get user feed

POST   /api/v1/feed/subscriptions               # Subscribe
DELETE /api/v1/feed/subscriptions               # Unsubscribe
GET    /api/v1/feed/subscriptions/:userId       # Get subscriptions
```

## UI Integration

### React Hook Example

```typescript
import { useFeed } from '@objectstack/client-react';

function OpportunityFeed({ recordId }: { recordId: string }) {
  const { feed, addComment, loading } = useFeed({
    object: 'opportunity',
    recordId,
  });

  return (
    <div>
      {feed.map((item) => (
        <FeedItem key={item.id} item={item} />
      ))}
      <CommentBox onSubmit={addComment} />
    </div>
  );
}
```

## Best Practices

1. **Enable Selective Tracking**: Track only important fields to reduce noise
2. **Use Pagination**: Always paginate feed queries to avoid performance issues
3. **Subscribe Sparingly**: Don't auto-subscribe users to too many records
4. **Moderate Content**: Implement moderation for user-generated comments
5. **Archive Old Data**: Periodically archive old feed items
6. **Index Efficiently**: Ensure database indexes on object/recordId/timestamp

## Performance Considerations

- **In-Memory Adapter**: Current implementation is in-memory only (future: database persistence)
- **Pagination**: Always use pagination for feed queries
- **Filtering**: Filter by type and date range to reduce result set
- **Caching**: Cache recent feed items for frequently accessed records

## Contract Implementation

Implements `IFeedService` from `@objectstack/spec/contracts`:

```typescript
interface IFeedService {
  addComment(options: AddCommentOptions): Promise<Comment>;
  getComments(options: GetCommentsOptions): Promise<Comment[]>;
  updateComment(options: UpdateCommentOptions): Promise<void>;
  deleteComment(commentId: string): Promise<void>;

  addReaction(options: AddReactionOptions): Promise<void>;
  removeReaction(options: RemoveReactionOptions): Promise<void>;
  getReactions(options: GetReactionsOptions): Promise<ReactionCounts>;

  getFeed(options: GetFeedOptions): Promise<FeedItem[]>;
  getUserFeed(options: GetUserFeedOptions): Promise<FeedItem[]>;

  subscribe(options: SubscribeOptions): Promise<void>;
  unsubscribe(options: UnsubscribeOptions): Promise<void>;
  isSubscribed(options: IsSubscribedOptions): Promise<boolean>;
}
```

## License

Apache-2.0

## See Also

- [@objectstack/service-realtime](../service-realtime/)
- [@objectstack/spec/contracts](../../spec/src/contracts/)
- [Activity Feed Guide](/content/docs/guides/feed/)
