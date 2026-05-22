// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useEffect, useState } from 'react';
import { ObjectStackClient } from '@objectstack/client';
import { useClient } from '@objectstack/client-react';
import { getApiBaseUrl } from '../lib/config';

/**
 * Hook to create and manage the ObjectStack client instance.
 *
 * Studio is a single-project, single-tenant metadata browser; there is no
 * X-Project-Id scoping. Every request goes straight to the unscoped
 * `/api/v1/...` surface of the backend.
 */
export function useObjectStackClient() {
  const [client, setClient] = useState<ObjectStackClient | null>(null);

  useEffect(() => {
    const baseUrl = getApiBaseUrl();
    console.log(`[Studio] Connecting to API: ${baseUrl || '(same-origin / proxy)'}`);
    setClient(new ObjectStackClient({ baseUrl }));
  }, []);

  return client;
}

/**
 * Back-compat shim. Studio no longer maintains a per-project client scope —
 * this hook returns the single unscoped client so existing call-sites that
 * pass `params.projectId` keep working without surgery.
 *
 * @deprecated Use {@link useClient} from `@objectstack/client-react` directly.
 */
export function useScopedClient(_projectId?: string | null) {
  return useClient();
}
