// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useState, useEffect } from 'react';
import { ObjectStackClient } from '@objectstack/client';
import { getApiBaseUrl, config } from '../lib/config';

/**
 * Hook to create and manage ObjectStack client instance
 */
export function useObjectStackClient() {
  const [client, setClient] = useState<ObjectStackClient | null>(null);

  useEffect(() => {
    const baseUrl = getApiBaseUrl();
    console.log(`[App] Connecting to API: ${baseUrl} (mode: ${config.mode})`);
    setClient(new ObjectStackClient({ baseUrl }));
  }, []);

  return client;
}
