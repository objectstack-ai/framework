// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * Feed Reaction Object
 *
 * System object for storing individual emoji reactions on feed items.
 * Each row represents one user's reaction on one feed item.
 *
 * Belongs to `service-feed` package per "protocol + service ownership" pattern.
 */
export const FeedReaction = ObjectSchema.create({
  namespace: 'sys',
  name: 'feed_reaction',
  label: 'Feed Reaction',
  pluralLabel: 'Feed Reactions',
  icon: 'smile',
  description: 'Emoji reactions on feed items',
  titleFormat: '{emoji} by {user_id}',
  compactLayout: ['feed_item_id', 'emoji', 'user_id'],

  fields: {
    id: Field.text({
      label: 'Reaction ID',
      required: true,
      readonly: true,
    }),

    feed_item_id: Field.text({
      label: 'Feed Item ID',
      required: true,
    }),

    emoji: Field.text({
      label: 'Emoji',
      required: true,
      description: 'Emoji character or shortcode (e.g., "👍", ":thumbsup:")',
    }),

    user_id: Field.text({
      label: 'User ID',
      required: true,
    }),

    created_at: Field.datetime({
      label: 'Created At',
      defaultValue: 'NOW()',
      readonly: true,
    }),
  },

  indexes: [
    { fields: ['feed_item_id', 'emoji', 'user_id'], unique: true },
    { fields: ['feed_item_id'], unique: false },
    { fields: ['user_id'], unique: false },
  ],

  enable: {
    trackHistory: false,
    searchable: false,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'delete'],
    trash: false,
    mru: false,
  },
});
