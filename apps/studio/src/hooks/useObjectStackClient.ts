// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useState, useEffect } from 'react';
import { ObjectStackClient } from '@objectstack/client';
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
