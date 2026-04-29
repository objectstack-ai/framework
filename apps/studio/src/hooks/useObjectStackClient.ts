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
 * `/api/v1/projects/:projectId/...`. The reserved virtual id `platform`
 * is also valid here — the server's RestServer/HttpDispatcher recognise
 * it and serve those requests from the control-plane protocol, so callers
 * can use a single uniform URL family for both real projects and the
 * platform surface.
 */
export function useScopedClient(
  projectId: string | undefined,
): ScopedProjectClient | null {
  const client = useClient();
  return useMemo(() => {
    if (!client) return null;
    if (!projectId) return null;
    return client.project(projectId);
  }, [client, projectId]);
}
