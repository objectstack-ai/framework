// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Real-time Event Subscription Hooks
 *
 * Provides React hooks for subscribing to metadata and data events.
 * Events are automatically cleaned up when components unmount.
 */

import { useEffect, useState, useCallback } from 'react';
import type { MetadataEvent, DataEvent } from '@objectstack/spec/api';
import { useClient } from './context';

/**
 * Hook to subscribe to metadata events
 *
 * @param type - Metadata type to subscribe to (e.g., 'object', 'view', 'agent')
 * @param options - Optional filters (packageId)
 * @returns Latest metadata event or null
 *
 * @example
 * ```tsx
 * function ObjectList() {
 *   const event = useMetadataSubscription('object');
 *
 *   useEffect(() => {
 *     if (event?.type === 'metadata.object.created') {
 *       console.log('New object:', event.name);
 *       // Refresh list
 *     }
 *   }, [event]);
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useMetadataSubscription(
  type: string,
  options?: { packageId?: string }
): MetadataEvent | null {
  const client = useClient();
  const [event, setEvent] = useState<MetadataEvent | null>(null);

  useEffect(() => {
    if (!client) return;

    const unsubscribe = client.events.subscribeMetadata(
      type,
      (e) => setEvent(e),
      options
    );

    return () => {
      unsubscribe();
    };
  }, [client, type, options?.packageId]);

  return event;
}

/**
 * Hook to subscribe to data record events
 *
 * @param object - Object name to subscribe to
 * @param options - Optional filters (recordId for specific record)
 * @returns Latest data event or null
 *
 * @example
 * ```tsx
 * function TaskDetail({ taskId }: { taskId: string }) {
 *   const event = useDataSubscription('project_task', { recordId: taskId });
 *
 *   useEffect(() => {
 *     if (event?.type === 'data.record.updated') {
 *       console.log('Task updated:', event.changes);
 *       // Refresh task data
 *     }
 *   }, [event]);
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useDataSubscription(
  object: string,
  options?: { recordId?: string }
): DataEvent | null {
  const client = useClient();
  const [event, setEvent] = useState<DataEvent | null>(null);

  useEffect(() => {
    if (!client) return;

    const unsubscribe = client.events.subscribeData(
      object,
      (e) => setEvent(e),
      options
    );

    return () => {
      unsubscribe();
    };
  }, [client, object, options?.recordId]);

  return event;
}

/**
 * Hook to subscribe to metadata events with a callback
 *
 * This variant doesn't store events in state, it just triggers a callback.
 * Useful for triggering refetches or side effects without re-renders.
 *
 * @param type - Metadata type to subscribe to
 * @param callback - Callback to invoke on events
 * @param options - Optional filters
 *
 * @example
 * ```tsx
 * function ObjectList() {
 *   const { refetch } = useQuery(...);
 *
 *   useMetadataSubscriptionCallback('object', () => {
 *     refetch(); // Refetch list when objects change
 *   });
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useMetadataSubscriptionCallback(
  type: string,
  callback: (event: MetadataEvent) => void,
  options?: { packageId?: string }
): void {
  const client = useClient();

  useEffect(() => {
    if (!client) return;

    const unsubscribe = client.events.subscribeMetadata(
      type,
      callback,
      options
    );

    return () => {
      unsubscribe();
    };
  }, [client, type, callback, options?.packageId]);
}

/**
 * Hook to subscribe to data events with a callback
 *
 * @param object - Object name to subscribe to
 * @param callback - Callback to invoke on events
 * @param options - Optional filters
 *
 * @example
 * ```tsx
 * function TaskList() {
 *   const { refetch } = useQuery(...);
 *
 *   useDataSubscriptionCallback('project_task', () => {
 *     refetch(); // Refetch list when tasks change
 *   });
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useDataSubscriptionCallback(
  object: string,
  callback: (event: DataEvent) => void,
  options?: { recordId?: string }
): void {
  const client = useClient();

  useEffect(() => {
    if (!client) return;

    const unsubscribe = client.events.subscribeData(
      object,
      callback,
      options
    );

    return () => {
      unsubscribe();
    };
  }, [client, object, callback, options?.recordId]);
}

/**
 * Hook to get connection status of realtime events
 *
 * @returns Whether realtime is connected
 *
 * @example
 * ```tsx
 * function ConnectionIndicator() {
 *   const connected = useRealtimeConnection();
 *
 *   return (
 *     <div>
 *       {connected ? '🟢 Connected' : '🔴 Disconnected'}
 *     </div>
 *   );
 * }
 * ```
 */
export function useRealtimeConnection(): boolean {
  const client = useClient();
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    if (!client) {
      setConnected(false);
      return;
    }

    // For now, assume always connected with in-memory adapter
    // In production, this would listen to WebSocket connection events
    setConnected(true);
  }, [client]);

  return connected;
}

/**
 * Hook for auto-refreshing queries when data changes
 *
 * Combines data subscription with query refetch.
 *
 * @param object - Object name to watch
 * @param refetch - Refetch function from useQuery
 * @param options - Optional filters
 *
 * @example
 * ```tsx
 * function TaskList() {
 *   const { data, refetch } = useQuery('project_task', {});
 *
 *   useAutoRefresh('project_task', refetch);
 *
 *   return <div>{data.map(...)}</div>;
 * }
 * ```
 */
export function useAutoRefresh(
  object: string,
  refetch: () => void,
  options?: { recordId?: string }
): void {
  const handleEvent = useCallback((_event: DataEvent) => {
    // Refetch on any data change
    refetch();
  }, [refetch]);

  useDataSubscriptionCallback(object, handleEvent, options);
}
