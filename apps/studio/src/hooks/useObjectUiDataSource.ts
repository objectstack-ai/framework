// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Bridge between the Studio backend and the @object-ui rendering layer.
 *
 * @object-ui components (ObjectForm, ObjectGrid, ObjectKanban, …) accept a
 * `DataSource` instance to read schemas and records. This hook wraps the
 * `@object-ui/data-objectstack` adapter against the same base URL Studio
 * already uses (see `lib/config.ts`) and memoises it for the session.
 */

import { useMemo } from 'react';
import type { DataSource } from '@object-ui/types';
import { createObjectStackAdapter } from '@object-ui/data-objectstack';
import { getApiBaseUrl } from '@/lib/config';

let cached: DataSource | null = null;

export function useObjectUiDataSource(): DataSource {
  return useMemo(() => {
    if (cached) return cached;
    cached = createObjectStackAdapter({
      // Empty baseUrl ⇒ same-origin requests, which both standalone (Vite
      // proxy → :3000) and embedded (/_studio under the kernel) handle.
      baseUrl: getApiBaseUrl(),
    });
    return cached;
  }, []);
}
