// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * /platform — back-compat redirect to /projects/platform.
 *
 * The platform surface is now modelled as a fixed-name project (id
 * `platform`) that flows through the regular project route tree. This
 * file exists only so that bookmarks, external links, and older docs
 * pointing at `/platform` still resolve to the new canonical URL.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';
import { PLATFORM_PROJECT_ID } from '@/lib/platform-project';

export const Route = createFileRoute('/platform')({
  beforeLoad: () => {
    throw redirect({
      to: '/projects/$projectId',
      params: { projectId: PLATFORM_PROJECT_ID },
      replace: true,
    });
  },
  component: () => null,
});
