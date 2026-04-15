// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * Feed Item Object
 *
 * System object for storing feed/chatter items including comments,
 * field changes, tasks, events, and system activities.
 *
 * Belongs to `service-feed` package per "protocol + service ownership" pattern.
 */
export const FeedItem = ObjectSchema.create({
  namespace: 'sys',
  name: 'feed_item',
  label: 'Feed Item',
  pluralLabel: 'Feed Items',
  icon: 'message-square',
  description: 'Unified activity timeline entries (comments, field changes, tasks, events)',
  titleFormat: '{type}: {body}',
  compactLayout: ['type', 'object', 'record_id', 'created_at'],

  fields: {
    id: Field.text({
      label: 'Feed Item ID',
      required: true,
      readonly: true,
    }),

    type: Field.select({
      label: 'Type',
      required: true,
      options: [
        { label: 'Comment', value: 'comment' },
        { label: 'Field Change', value: 'field_change' },
        { label: 'Task', value: 'task' },
        { label: 'Event', value: 'event' },
        { label: 'Email', value: 'email' },
        { label: 'Call', value: 'call' },
        { label: 'Note', value: 'note' },
        { label: 'File', value: 'file' },
        { label: 'Record Create', value: 'record_create' },
        { label: 'Record Delete', value: 'record_delete' },
        { label: 'Approval', value: 'approval' },
        { label: 'Sharing', value: 'sharing' },
        { label: 'System', value: 'system' },
      ],
    }),

    object: Field.text({
      label: 'Object Name',
      required: true,
      searchable: true,
    }),

    record_id: Field.text({
      label: 'Record ID',
      required: true,
      searchable: true,
    }),

    actor_type: Field.select({
      label: 'Actor Type',
      required: true,
      options: [
        { label: 'User', value: 'user' },
        { label: 'System', value: 'system' },
        { label: 'Service', value: 'service' },
        { label: 'Automation', value: 'automation' },
      ],
    }),

    actor_id: Field.text({
      label: 'Actor ID',
      required: true,
    }),

    actor_name: Field.text({
      label: 'Actor Name',
    }),

    actor_avatar_url: Field.url({
      label: 'Actor Avatar URL',
    }),

    body: Field.textarea({
      label: 'Body',
      description: 'Rich text body (Markdown supported)',
    }),

    mentions: Field.textarea({
      label: 'Mentions',
      description: 'Array of @mention objects (JSON)',
    }),

    changes: Field.textarea({
      label: 'Field Changes',
      description: 'Array of field change entries (JSON)',
    }),

    reactions: Field.textarea({
      label: 'Reactions',
      description: 'Array of emoji reaction objects (JSON)',
    }),

    parent_id: Field.text({
      label: 'Parent Feed Item ID',
      description: 'For threaded replies',
    }),

    reply_count: Field.number({
      label: 'Reply Count',
      defaultValue: 0,
    }),

    visibility: Field.select({
      label: 'Visibility',
      defaultValue: 'public',
      options: [
        { label: 'Public', value: 'public' },
        { label: 'Internal', value: 'internal' },
        { label: 'Private', value: 'private' },
      ],
    }),

    is_edited: Field.boolean({
      label: 'Is Edited',
      defaultValue: false,
    }),

    edited_at: Field.datetime({
      label: 'Edited At',
    }),

    created_at: Field.datetime({
      label: 'Created At',
      defaultValue: 'NOW()',
      readonly: true,
    }),

    updated_at: Field.datetime({
      label: 'Updated At',
      defaultValue: 'NOW()',
      readonly: true,
    }),
  },

  indexes: [
    { fields: ['object', 'record_id'], unique: false },
    { fields: ['actor_id'], unique: false },
    { fields: ['parent_id'], unique: false },
    { fields: ['created_at'], unique: false },
  ],

  enable: {
    trackHistory: false,
    searchable: true,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update', 'delete'],
    trash: false,
    mru: false,
  },
});
