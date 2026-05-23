// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useClient } from '@objectstack/client-react';
import { useObjectTranslation } from '@object-ui/i18n';
import { Button } from '@/components/ui/button';

interface SocialProvider {
  id: string;
  name: string;
  enabled: boolean;
  type?: 'social' | 'oidc';
}

interface Props {
  mode: 'sign-in' | 'sign-up';
  redirect?: string;
}

export function SocialSignInButtons({ mode, redirect }: Props) {
  const { t } = useObjectTranslation();
  const client = useClient() as any;
  const [providers, setProviders] = useState<SocialProvider[]>([]);
  const [loading, setLoading] = useState(true);
  // Tracks which provider button was clicked. We keep it set until the
  // browser actually navigates away — the full-page overlay below relies
  // on it so the user gets unmistakable feedback during the (sometimes
  // multi-second) cross-origin redirect to the IdP. On a slow link there
  // was previously no visual hint that the click registered, and users
  // would click the button repeatedly thinking it was broken.
  const [redirectingTo, setRedirectingTo] = useState<SocialProvider | null>(null);

  useEffect(() => {
    if (!client?.auth?.getConfig) return;
    client.auth.getConfig()
      .then((res: any) => {
        const list: SocialProvider[] = res?.socialProviders ?? res?.data?.socialProviders ?? [];
        setProviders(list.filter((p) => p.enabled));
      })
      .catch((err: unknown) => {
        console.warn('[SocialSignInButtons] failed to load auth config', err);
      })
      .finally(() => setLoading(false));
  }, [client]);

  if (loading || providers.length === 0) return null;

  const label =
    mode === 'sign-in' ? t('auth.social.continueWith') : t('auth.social.signUpWith');

  const base = window.location.origin + import.meta.env.BASE_URL;
  const loginUrl = base + 'login' + (redirect ? `?redirect=${encodeURIComponent(redirect)}` : '');

  const handleProviderClick = (p: SocialProvider) => {
    if (redirectingTo) return;
    setRedirectingTo(p);
    // signInWithProvider triggers a full-page navigation. We deliberately
    // do NOT clear `redirectingTo` on success — the overlay stays up until
    // the browser unloads this document, which is the most reliable signal
    // that "the click is doing something". On failure we clear it so the
    // user can retry / fall back to email login.
    Promise.resolve(
      client.auth.signInWithProvider(p.id, {
        callbackURL: loginUrl,
        errorCallbackURL: loginUrl,
        type: p.type ?? 'social',
      }),
    ).catch((err: unknown) => {
      console.warn('[SocialSignInButtons] signInWithProvider failed', err);
      setRedirectingTo(null);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {providers.map((p) => {
        const isRedirecting = redirectingTo?.id === p.id;
        return (
          <Button
            key={p.id}
            type="button"
            variant="outline"
            className="w-full"
            disabled={!!redirectingTo}
            onClick={() => handleProviderClick(p)}
          >
            {isRedirecting ? (
              <span className="mr-2 inline-block size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            ) : (
              <span className="mr-2 flex h-4 w-4 items-center justify-center rounded-sm bg-muted text-[10px] font-bold uppercase">
                {p.id[0]}
              </span>
            )}
            {isRedirecting
              ? t('auth.social.redirectingTo', {
                  provider: p.name,
                  defaultValue: `Redirecting to ${p.name}…`,
                })
              : `${label} ${p.name}`}
          </Button>
        );
      })}
      <div className="relative my-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">{t('auth.social.orContinueEmail')}</span>
        </div>
      </div>
      {redirectingTo && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="status"
              aria-live="polite"
              className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"
            >
              <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
                <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                <span>
                  {t('auth.social.redirectingTo', {
                    provider: redirectingTo.name,
                    defaultValue: `Redirecting to ${redirectingTo.name}…`,
                  })}
                </span>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
