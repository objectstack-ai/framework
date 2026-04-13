// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * Feed Item Type
 * Unified activity types for the record timeline.
 * Covers comments, field changes, tasks, events, and system activities.
 */
export const FeedItemType = z.enum([
  'comment',
  'field_change',
  'task',
  'event',
  'email',
  'call',
  'note',
  'file',
  'record_create',
  'record_delete',
  'approval',
  'sharing',
  'system',
]);
export type FeedItemType = z.infer<typeof FeedItemType>;

/**
 * Mention Schema
 * Represents an @mention within comment body text.
 */
export const MentionSchema = z.object({
  type: z.enum(['user', 'team', 'record']).describe('Mention target type'),
  id: z.string().describe('Target ID'),
  name: z.string().describe('Display name for rendering'),
  offset: z.number().int().min(0).describe('Character offset in body text'),
  length: z.number().int().min(1).describe('Length of mention token in body text'),
});
export type Mention = z.infer<typeof MentionSchema>;

/**
 * Field Change Entry Schema
 * Represents a single field-level change within a field_change feed item.
 */
export const FieldChangeEntrySchema = z.object({
  field: z.string().describe('Field machine name'),
  fieldLabel: z.string().optional().describe('Field display label'),
  oldValue: z.unknown().optional().describe('Previous value'),
  newValue: z.unknown().optional().describe('New value'),
  oldDisplayValue: z.string().optional().describe('Human-readable old value'),
  newDisplayValue: z.string().optional().describe('Human-readable new value'),
});
export type FieldChangeEntry = z.infer<typeof FieldChangeEntrySchema>;

/**
 * Reaction Schema
 * Represents an emoji reaction on a feed item.
 */
export const ReactionSchema = z.object({
  emoji: z.string().describe('Emoji character or shortcode (e.g., "👍", ":thumbsup:")'),
  userIds: z.array(z.string()).describe('Users who reacted'),
  count: z.number().int().min(1).describe('Total reaction count'),
});
export type Reaction = z.infer<typeof ReactionSchema>;

/**
 * Feed Actor Schema
 * Represents the actor who performed the action.
 */
export const FeedActorSchema = z.object({
  type: z.enum(['user', 'system', 'service', 'automation']).describe('Actor type'),
  id: z.string().describe('Actor ID'),
  name: z.string().optional().describe('Actor display name'),
  avatarUrl: z.string().url().optional().describe('Actor avatar URL'),
  source: z.string().optional().describe('Source application (e.g., "Omni", "API", "Studio")'),
});
export type FeedActor = z.infer<typeof FeedActorSchema>;

/**
 * Feed Item Visibility
 */
export const FeedVisibility = z.enum(['public', 'internal', 'private']);
export type FeedVisibility = z.infer<typeof FeedVisibility>;

/**
 * Feed Item Schema
 * A single entry in the unified activity timeline.
 *
 * @example Comment
 * {
 *   id: 'feed_001',
 *   type: 'comment',
 *   object: 'account',
 *   recordId: 'rec_123',
 *   body: 'Great progress! @jane.doe can you follow up?',
 *   mentions: [{ type: 'user', id: 'user_123', name: 'Jane Doe', offset: 17, length: 9 }],
 *   actor: { type: 'user', id: 'user_456', name: 'John Smith' },
 *   createdAt: '2026-01-15T10:30:00Z',
 * }
 *
 * @example Field Change
 * {
 *   id: 'feed_002',
 *   type: 'field_change',
 *   object: 'account',
 *   recordId: 'rec_123',
 *   changes: [
 *     { field: 'status', oldDisplayValue: 'New', newDisplayValue: 'Active' },
 *     { field: 'region', oldDisplayValue: '', newDisplayValue: 'Asia-Pacific' },
 *   ],
 *   actor: { type: 'user', id: 'user_456', name: 'John Smith' },
 *   createdAt: '2026-01-15T10:25:00Z',
 * }
 */
export const FeedItemSchema = z.object({
  /** Unique identifier */
  id: z.string().describe('Feed item ID'),

  /** Feed item type */
  type: FeedItemType.describe('Activity type'),

  /** Target record reference */
  object: z.string().describe('Object name (e.g., "account")'),
  recordId: z.string().describe('Record ID this feed item belongs to'),

  /** Actor (who performed the action) */
  actor: FeedActorSchema.describe('Who performed this action'),

  /** Content (for comments/notes) */
  body: z.string().optional().describe('Rich text body (Markdown supported)'),

  /** @Mentions */
  mentions: z.array(MentionSchema).optional().describe('Mentioned users/teams/records'),

  /** Field changes (for field_change type) */
  changes: z.array(FieldChangeEntrySchema).optional().describe('Field-level changes'),

  /** Reactions */
  reactions: z.array(ReactionSchema).optional().describe('Emoji reactions on this item'),

  /** Reply threading */
  parentId: z.string().optional().describe('Parent feed item ID for threaded replies'),
  replyCount: z.number().int().min(0).default(0).describe('Number of replies'),

  /** Pin / Star */
  pinned: z.boolean().default(false).describe('Whether the feed item is pinned to the top of the timeline'),
  pinnedAt: z.string().datetime().optional().describe('Timestamp when the item was pinned'),
  pinnedBy: z.string().optional().describe('User ID who pinned the item'),
  starred: z.boolean().default(false).describe('Whether the feed item is starred/bookmarked by the current user'),
  starredAt: z.string().datetime().optional().describe('Timestamp when the item was starred'),

  /** Visibility */
  visibility: FeedVisibility.default('public')
    .describe('Visibility: public (all users), internal (team only), private (author + mentioned)'),

  /** Timestamps */
  createdAt: z.string().datetime().describe('Creation timestamp'),
  updatedAt: z.string().datetime().optional().describe('Last update timestamp'),
  editedAt: z.string().datetime().optional().describe('When comment was last edited'),
  isEdited: z.boolean().default(false).describe('Whether comment has been edited'),
});
export type FeedItem = z.infer<typeof FeedItemSchema>;

/**
 * Feed Filter Mode
 * Controls which feed item types to display in the timeline.
 */
export const FeedFilterMode = z.enum([
  'all',
  'comments_only',
  'changes_only',
  'tasks_only',
]);
export type FeedFilterMode = z.infer<typeof FeedFilterMode>;
