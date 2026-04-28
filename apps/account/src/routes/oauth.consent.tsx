// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * /oauth/consent — OAuth/OIDC consent screen.
 *
 * The `@better-auth/oauth-provider` plugin redirects the user here when an
 * OAuth client requests consent. The full query string (including the
 * signed `sig`/`exp` carrier) is the canonical authorization request and
 * must be forwarded back to the consent endpoint as `oauth_query` so the
 * server can verify and re-issue an authorization code.
 *
 * After the user accepts or denies, we POST to `/api/v1/auth/oauth2/consent`
 * which returns `{ redirect_uri }` pointing at the OAuth client's callback.
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Check, KeyRound, X } from 'lucide-react';
import { useClient } from '@objectstack/client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/useSession';
import { useOAuthConsent } from '@/hooks/useOAuthApplications';

export const Route = createFileRoute('/oauth/consent')({
  // Accept arbitrary query params — the consent page receives the full
  // authorization-request query string and forwards it back as
  // `oauth_query` to the consent endpoint.
  validateSearch: (s: Record<string, unknown>) => s,
  component: OAuthConsentPage,
});

function OAuthConsentPage() {
  const navigate = useNavigate();
  const client = useClient() as any;
  const { user, loading: sessionLoading } = useSession();
  const { submit, submitting } = useOAuthConsent();

  const [clientInfo, setClientInfo] = useState<{ name?: string; icon?: string } | null>(null);

  // Read raw query directly so we can forward it verbatim. The router's
  // typed `useSearch` would coerce / re-serialize and risks breaking the
  // signature on `sig=`.
  const rawSearch = typeof window !== 'undefined' ? window.location.search : '';
  const oauthQuery = rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch;
  const params = new URLSearchParams(oauthQuery);
  const clientId = params.get('client_id') ?? undefined;
  const scope = params.get('scope') ?? '';

  // If unauthenticated, bounce to login with a return-to that brings the
  // user back here once signed in.
  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      const here = window.location.pathname + window.location.search;
      navigate({ to: '/login', search: { redirect: here } as any });
    }
  }, [user, sessionLoading, navigate]);

  // Best-effort lookup of the client app's display name + icon.
  useEffect(() => {
    if (!clientId || !client?.oauth?.applications?.getPublic) return;
    let cancelled = false;
    client.oauth.applications.getPublic(clientId).then(
      (res: any) => {
        if (cancelled) return;
        const data = res?.data ?? res;
        setClientInfo({ name: data?.name ?? data?.client_name, icon: data?.icon ?? data?.logo_uri });
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [client, clientId]);

  const scopes = scope.split(/\s+/).filter(Boolean);

  const handleDecision = async (accept: boolean) => {
    try {
      const res: any = await submit({ accept, oauth_query: oauthQuery });
      const redirect = res?.redirect_uri ?? res?.redirectURI ?? res?.url;
      if (redirect) {
        window.location.href = redirect;
        return;
      }
      toast({
        title: accept ? 'Consent granted' : 'Consent denied',
        description: 'No redirect URL returned by the server.',
        variant: accept ? undefined : 'destructive',
      });
    } catch (err) {
      toast({
        title: 'Failed to submit consent',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  const appName = clientInfo?.name ?? clientId ?? 'an application';

  return (
    <div className="flex min-h-svh w-full flex-1 items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mb-3 rounded-full border bg-muted p-3">
            {clientInfo?.icon ? (
              <img
                src={clientInfo.icon}
                alt=""
                className="h-8 w-8 rounded"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            ) : (
              <KeyRound className="h-7 w-7 text-muted-foreground" />
            )}
          </div>
          <CardTitle className="text-xl">Authorize {appName}</CardTitle>
          <CardDescription>
            {appName} is requesting access to your ObjectStack account
            {user?.email ? ` (${user.email})` : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {scopes.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">This will allow it to:</p>
              <ul className="space-y-1.5 rounded-md border bg-muted/40 p-3 text-sm">
                {scopes.map((s) => (
                  <li key={s} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-green-600 dark:text-green-400" />
                    <span>{describeScope(s)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => handleDecision(false)}
              disabled={submitting}
            >
              <X className="mr-2 h-4 w-4" />
              Deny
            </Button>
            <Button onClick={() => handleDecision(true)} disabled={submitting}>
              <Check className="mr-2 h-4 w-4" />
              {submitting ? 'Submitting…' : 'Authorize'}
            </Button>
          </div>

          <p className="pt-2 text-center text-xs text-muted-foreground">
            You can revoke access any time from your account settings.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function describeScope(scope: string): string {
  switch (scope) {
    case 'openid':
      return 'Verify your identity';
    case 'profile':
      return 'Access your basic profile (name, picture)';
    case 'email':
      return 'Access your email address';
    case 'offline_access':
      return 'Stay signed in (refresh tokens)';
    default:
      return scope;
  }
}
