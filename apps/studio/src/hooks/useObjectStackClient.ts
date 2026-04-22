// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useMemo, useState, useEffect } from 'react';
import { ObjectStackClient, type ScopedProjectClient } from '@objectstack/client';
import { useClient } from '@objectstack/client-react';
import { getApiBaseUrl, config } from '../lib/config';
import { recallActiveProject } from './useProjects';

/**
 * Hook to create and manage the ObjectStack client instance.
 *
 * When the browser has a previously-remembered active environment id
 * (see `useEnvironments`), it is applied as the initial `X-Project-Id`
 * header so the first network request already lands in the correct
 * environment's database — no pre-switch roundtrip needed.
 */
export function useObjectStackClient() {
  const [client, setClient] = useState<ObjectStackClient | null>(null);

  useEffect(() => {
    const baseUrl = getApiBaseUrl();
    const projectId = recallActiveProject() ?? undefined;
    console.log(
      `[App] Connecting to API: ${baseUrl} (mode: ${config.mode}, env: ${projectId ?? 'session-default'})`,
    );
    setClient(new ObjectStackClient({ baseUrl, projectId }));
  }, []);

  return client;
}

/**
 * Hook that returns a {@link ScopedProjectClient} bound to the given
 * `projectId`. When `projectId` is `undefined` or an empty string, the hook
 * returns `null` so callers can defer network calls until the route is fully
 * resolved.
 *
 * The scoped client routes every request through
 * `/api/v1/projects/:projectId/...`, which is the canonical URL shape once
 * `enableProjectScoping` is enabled on the server. The dual-mode routing in
 * Phase 2 keeps the unscoped routes working under `projectResolution: 'auto'`,
 * so this migration is safe to ship incrementally.
 */
export function useScopedClient(
  projectId: string | undefined,
): ScopedProjectClient | null {
  const client = useClient();
  return useMemo(() => {
    if (!client || !projectId) return null;
    return client.project(projectId);
  }, [client, projectId]);
}
