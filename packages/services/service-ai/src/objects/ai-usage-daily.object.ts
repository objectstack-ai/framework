// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * ai_usage_daily — per-user, per-day AI chat usage counters
 *
 * One row per (UTC day, environment, user). The agent chat route increments
 * `messages` once per user turn; {@link DailyMessageQuota} reads it to decide
 * whether a daily message limit has been reached.
 *
 * This is a quota counter, not billing-grade metering: increments are
 * last-write-wins and a lost update under concurrency only ever under-counts
 * by a message — acceptable for an abuse/entitlement gate, not for invoicing.
 *
 * @namespace ai
 */
export const AiUsageDailyObject = ObjectSchema.create({
  name: 'ai_usage_daily',
  label: 'AI Daily Usage',
  pluralLabel: 'AI Daily Usage',
  icon: 'gauge',
  isSystem: true,
  description: 'Per-user daily AI chat usage counters (quota enforcement)',

  fields: {
    id: Field.text({
      label: 'Usage ID',
      required: true,
      readonly: true,
      description: 'Deterministic key: <day>:<environment|->:<user>',
    }),

    day: Field.text({
      label: 'Day (UTC)',
      required: true,
      maxLength: 10,
      description: 'UTC calendar day, YYYY-MM-DD',
    }),

    user_id: Field.text({
      label: 'User ID',
      required: true,
      maxLength: 255,
    }),

    environment_id: Field.text({
      label: 'Environment ID',
      required: false,
      maxLength: 255,
    }),

    messages: Field.number({
      label: 'Messages',
      required: true,
      description: 'User chat turns consumed this day',
    }),
  },
});
