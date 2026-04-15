// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * Record Subscription Object
 *
 * System object for storing record-level notification subscriptions.
 * Enables Airtable-style bell icon for record change notifications.
 *
 * Belongs to `service-feed` package per "protocol + service ownership" pattern.
 */
export const RecordSubscription = ObjectSchema.create({
  namespace: 'sys',
  name: 'record_subscription',
  label: 'Record Subscription',
  pluralLabel: 'Record Subscriptions',
  icon: 'bell',
  description: 'Record-level notification subscriptions for feed events',
  titleFormat: '{object}/{record_id} — {user_id}',
  compactLayout: ['object', 'record_id', 'user_id', 'active'],

  fields: {
    id: Field.text({
      label: 'Subscription ID',
      required: true,
      readonly: true,
    }),

    object: Field.text({
      label: 'Object Name',
      required: true,
    }),

    record_id: Field.text({
      label: 'Record ID',
      required: true,
    }),

    user_id: Field.text({
      label: 'User ID',
      required: true,
    }),

    events: Field.textarea({
      label: 'Subscribed Events',
      description: 'Array of event types: comment, mention, field_change, task, approval, all (JSON)',
    }),

    channels: Field.textarea({
      label: 'Notification Channels',
      description: 'Array of channels: in_app, email, push, slack (JSON)',
    }),

    active: Field.boolean({
      label: 'Active',
      defaultValue: true,
    }),

    created_at: Field.datetime({
      label: 'Created At',
      defaultValue: 'NOW()',
      readonly: true,
    }),
  },

  indexes: [
    { fields: ['object', 'record_id', 'user_id'], unique: true },
    { fields: ['user_id'], unique: false },
    { fields: ['object', 'record_id'], unique: false },
  ],

  enable: {
    trackHistory: false,
    searchable: false,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update', 'delete'],
    trash: false,
    mru: false,
  },
});
