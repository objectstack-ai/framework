// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ApiEndpoint } from '@objectstack/spec/api';

/**
 * Declarative API endpoints (`apis:`) — the metadata-authored counterpart of
 * the code-mounted endpoint in src/system/server/recalc-endpoint.ts. The
 * runtime dispatcher matches these by path+method and executes the target
 * (`object_operation` → a data read; `flow` → a flow run) with no handler
 * code. Migrated here from app-crm when that example was slimmed back to a
 * pure loading-pipeline smoke fixture.
 */

/** Read-only data projection: GET a filtered task list through a stable URL. */
export const TaskFeedEndpoint: ApiEndpoint = {
  name: 'showcase_task_feed',
  path: '/api/v1/showcase/tasks',
  method: 'GET',
  summary: 'Task feed',
  description: 'Returns tasks via a declarative object_operation endpoint — no handler code.',
  type: 'object_operation',
  target: 'showcase_task',
  objectParams: {
    object: 'showcase_task',
    operation: 'find',
  },
  authRequired: true,
  cacheTtl: 30,
};

/** Flow-typed endpoint: POST triggers the janitor flow (get+delete demo). */
export const InquiryPurgeEndpoint: ApiEndpoint = {
  name: 'showcase_inquiry_purge_api',
  path: '/api/v1/showcase/inquiries/purge',
  method: 'POST',
  summary: 'Purge closed inquiries',
  description: 'Invokes the showcase_inquiry_purge flow (get_record + delete_record janitor) over HTTP.',
  type: 'flow',
  target: 'showcase_inquiry_purge',
  authRequired: true,
};

export const allApis = [TaskFeedEndpoint, InquiryPurgeEndpoint];
