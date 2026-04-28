// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * React hooks for managing OAuth/OIDC client applications.
 *
 * Wraps `client.oauth.applications.*` (better-auth `oidc-provider` plugin).
 * Used by the OAuth Apps pages under /account/oauth-applications.
 */

import { useCallback, useEffect, useState } from 'react';
import { useClient } from '@objectstack/client-react';

export interface OAuthApplication {
  id: string;
  name: string;
  client_id: string;
  client_secret?: string | null;
  redirect_urls: string;
  type: 'web' | 'native' | 'user-agent-based' | 'public';
  disabled?: boolean;
  icon?: string | null;
  metadata?: string | null;
  user_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Hook: list the current user's OAuth client applications.
 */
export function useOAuthApplications() {
  const client = useClient() as any;
  const [applications, setApplications] = useState<OAuthApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    if (!client?.oauth?.applications) return;
    setLoading(true);
    setError(null);
    try {
      const res = await client.oauth.applications.list();
      setApplications(res?.applications ?? []);
    } catch (err) {
      setError(err as Error);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { applications, loading, error, reload };
}

/**
 * Hook: register a new OAuth client application.
 *
 * Returns `{ register, registering, error, lastResult }` where `lastResult`
 * holds the response of the most recent successful registration — including
 * the freshly issued `client_secret`, which is only returned once.
 */
export function useRegisterOAuthApplication() {
  const client = useClient() as any;
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);

  const register = useCallback(
    async (req: {
      name?: string;
      client_name?: string;
      redirect_uris: string[];
      token_endpoint_auth_method?: 'none' | 'client_secret_basic' | 'client_secret_post';
      grant_types?: string[];
      response_types?: string[];
      client_uri?: string;
      logo_uri?: string;
      scope?: string;
      contacts?: string[];
      tos_uri?: string;
      policy_uri?: string;
      metadata?: Record<string, unknown>;
    }) => {
      if (!client?.oauth?.applications?.register) throw new Error('Client not ready');
      setRegistering(true);
      setError(null);
      try {
        const result = await client.oauth.applications.register(req);
        setLastResult(result);
        return result;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setRegistering(false);
      }
    },
    [client],
  );

  return { register, registering, error, lastResult };
}

/**
 * Hook: delete (revoke) an OAuth client application by row id.
 */
export function useDeleteOAuthApplication() {
  const client = useClient() as any;
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const remove = useCallback(
    async (clientId: string) => {
      if (!client?.oauth?.applications?.delete) throw new Error('Client not ready');
      setDeleting(true);
      setError(null);
      try {
        return await client.oauth.applications.delete(clientId);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setDeleting(false);
      }
    },
    [client],
  );

  return { remove, deleting, error };
}

/**
 * Hook: submit a consent decision to a pending OAuth authorization request.
 */
export function useOAuthConsent() {
  const client = useClient() as any;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const submit = useCallback(
    async (req: { accept: boolean; scope?: string; oauth_query?: string }) => {
      if (!client?.oauth?.consent) throw new Error('Client not ready');
      setSubmitting(true);
      setError(null);
      try {
        return await client.oauth.consent(req);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [client],
  );

  return { submit, submitting, error };
}
