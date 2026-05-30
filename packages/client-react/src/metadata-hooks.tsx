// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Metadata Hooks
 * 
 * React hooks for accessing ObjectStack metadata (schemas, views, fields)
 */

import { useState, useEffect, useCallback } from 'react';
import { useClient, useObjectStackLocale } from './context';

/**
 * Metadata query options
 */
export interface UseMetadataOptions {
  /** Enable/disable automatic query execution */
  enabled?: boolean;
  /** Use cached metadata if available */
  useCache?: boolean;
  /** ETag for conditional requests */
  ifNoneMatch?: string;
  /** If-Modified-Since header for conditional requests */
  ifModifiedSince?: string;
  /** Callback on successful query */
  onSuccess?: (data: any) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Metadata query result
 */
export interface UseMetadataResult<T = any> {
  /** Metadata data */
  data: T | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch the metadata */
  refetch: () => Promise<void>;
  /** ETag from last fetch */
  etag?: string;
  /** Whether data came from cache (304 Not Modified) */
  fromCache: boolean;
}

/**
 * Hook for fetching object schema/metadata
 * 
 * @example
 * ```tsx
 * function ObjectSchemaViewer({ objectName }: { objectName: string }) {
 *   const { data: schema, isLoading, error } = useObject(objectName);
 * 
 *   if (isLoading) return <div>Loading schema...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 * 
 *   return (
 *     <div>
 *       <h2>{schema.label}</h2>
 *       <p>Fields: {Object.keys(schema.fields).length}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useObject(
  objectName: string,
  options: UseMetadataOptions = {}
): UseMetadataResult {
  const client = useClient();
  // Active UI locale: object/field labels are translated server-side, so a
  // language switch must re-fetch (it is *not* reactive via i18next). Folding
  // `locale` into the fetch deps below triggers that re-fetch (issue #1319).
  const locale = useObjectStackLocale();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [etag, setEtag] = useState<string>();
  const [fromCache, setFromCache] = useState(false);

  const {
    enabled = true,
    useCache = true,
    ifNoneMatch,
    ifModifiedSince,
    onSuccess,
    onError
  } = options;

  const fetchMetadata = useCallback(async () => {
    if (!enabled) return;

    try {
      setIsLoading(true);
      setError(null);
      setFromCache(false);

      if (useCache) {
        // Use cached metadata endpoint
        const result = await client.meta.getCached(objectName, {
          ifNoneMatch: ifNoneMatch || etag,
          ifModifiedSince
        });

        if (result.notModified) {
          setFromCache(true);
        } else {
          setData(result.data);
          if (result.etag) {
            setEtag(result.etag.value);
          }
        }

        onSuccess?.(result.data || data);
      } else {
        // Direct fetch without cache
        const result = await client.meta.getItem('object', objectName);
        setData(result);
        onSuccess?.(result);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch object metadata');
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [client, objectName, locale, enabled, useCache, ifNoneMatch, ifModifiedSince, etag, data, onSuccess, onError]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  const refetch = useCallback(async () => {
    await fetchMetadata();
  }, [fetchMetadata]);

  return {
    data,
    isLoading,
    error,
    refetch,
    etag,
    fromCache
  };
}

/**
 * Hook for fetching view configuration
 * 
 * @example
 * ```tsx
 * function ViewConfiguration({ objectName }: { objectName: string }) {
 *   const { data: view, isLoading } = useView(objectName, 'list');
 * 
 *   if (isLoading) return <div>Loading view...</div>;
 * 
 *   return (
 *     <div>
 *       <h3>List View for {objectName}</h3>
 *       <p>Columns: {view?.columns?.length}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useView(
  objectName: string,
  viewType: 'list' | 'form' = 'list',
  options: UseMetadataOptions = {}
): UseMetadataResult {
  const client = useClient();
  // View headers/labels are translated server-side — re-fetch on locale change.
  const locale = useObjectStackLocale();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { enabled = true, onSuccess, onError } = options;

  const fetchView = useCallback(async () => {
    if (!enabled) return;

    try {
      setIsLoading(true);
      setError(null);

      const result = await client.meta.getView(objectName, viewType);
      setData(result);
      onSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch view configuration');
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [client, objectName, viewType, locale, enabled, onSuccess, onError]);

  useEffect(() => {
    fetchView();
  }, [fetchView]);

  const refetch = useCallback(async () => {
    await fetchView();
  }, [fetchView]);

  return {
    data,
    isLoading,
    error,
    refetch,
    fromCache: false
  };
}

/**
 * Hook for extracting fields from object schema
 * 
 * @example
 * ```tsx
 * function FieldList({ objectName }: { objectName: string }) {
 *   const { data: fields, isLoading } = useFields(objectName);
 * 
 *   if (isLoading) return <div>Loading fields...</div>;
 * 
 *   return (
 *     <ul>
 *       {fields?.map(field => (
 *         <li key={field.name}>{field.label} ({field.type})</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useFields(
  objectName: string,
  options: UseMetadataOptions = {}
): UseMetadataResult<any[]> {
  const objectResult = useObject(objectName, options);

  const fields = objectResult.data?.fields
    ? Object.entries(objectResult.data.fields).map(([name, field]: [string, any]) => ({
        name,
        ...field
      }))
    : null;

  return {
    ...objectResult,
    data: fields
  };
}

/**
 * Generic metadata hook for custom metadata queries
 * 
 * @example
 * ```tsx
 * function CustomMetadata() {
 *   const { data, isLoading } = useMetadata(async (client) => {
 *     // Custom metadata fetching logic
 *     const object = await client.meta.getObject('custom_object');
 *     const view = await client.meta.getView('custom_object', 'list');
 *     return { object, view };
 *   });
 * 
 *   return <pre>{JSON.stringify(data, null, 2)}</pre>;
 * }
 * ```
 */
export function useMetadata<T = any>(
  fetcher: (client: ReturnType<typeof useClient>) => Promise<T>,
  options: Omit<UseMetadataOptions, 'useCache' | 'ifNoneMatch' | 'ifModifiedSince'> = {}
): UseMetadataResult<T> {
  const client = useClient();
  // Custom fetchers commonly read server-translated metadata too — refetch on
  // locale change so their labels follow the active language.
  const locale = useObjectStackLocale();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { enabled = true, onSuccess, onError } = options;

  const fetchMetadata = useCallback(async () => {
    if (!enabled) return;

    try {
      setIsLoading(true);
      setError(null);

      const result = await fetcher(client);
      setData(result);
      onSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch metadata');
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [client, fetcher, locale, enabled, onSuccess, onError]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  const refetch = useCallback(async () => {
    await fetchMetadata();
  }, [fetchMetadata]);

  return {
    data,
    isLoading,
    error,
    refetch,
    fromCache: false
  };
}
