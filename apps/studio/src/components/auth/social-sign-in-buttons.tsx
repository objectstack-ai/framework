// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useEffect, useState } from 'react';
import { useClient } from '@objectstack/client-react';
import { Button } from '@/components/ui/button';

interface SocialProvider {
  id: string;
  name: string;
  enabled: boolean;
  type?: 'social' | 'oidc';
}

interface Props {
  mode: 'sign-in' | 'sign-up';
}

export function SocialSignInButtons({ mode }: Props) {
  const client = useClient() as any;
  const [providers, setProviders] = useState<SocialProvider[]>([]);
  const [loading, setLoading] = useState(true);

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

  const label = mode === 'sign-in' ? 'Continue with' : 'Sign up with';

  return (
    <div className="flex flex-col gap-2">
      {providers.map((p) => (
        <Button
          key={p.id}
          type="button"
          variant="outline"
          className="w-full"
          onClick={() =>
            client.auth.signInWithProvider(p.id, {
              callbackURL: window.location.origin + import.meta.env.BASE_URL + 'login',
              errorCallbackURL: window.location.origin + import.meta.env.BASE_URL + 'login',
              type: p.type ?? 'social',
            })
          }
        >
          {/* TODO: replace with provider icon from lucide-react or simple-icons */}
          <span className="mr-2 flex h-4 w-4 items-center justify-center rounded-sm bg-muted text-[10px] font-bold uppercase">
            {p.id[0]}
          </span>
          {label} {p.name}
        </Button>
      ))}
      <div className="relative my-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
        </div>
      </div>
    </div>
  );
}
