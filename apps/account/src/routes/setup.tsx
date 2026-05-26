// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useClient } from '@objectstack/client-react';
import { useObjectTranslation } from '@object-ui/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/useSession';

/**
 * First-run setup page.
 *
 * Renders only when `client.auth.bootstrapStatus()` reports `hasOwner: false`.
 * Asks for the **minimum** to bring an instance online: owner credentials
 * + organization name. Slug is auto-derived; teammate invitations were
 * intentionally moved out of this flow — the new owner lands on the
 * dashboard immediately and can invite from there. Keeping setup short
 * matters for first-run impressions.
 */
export const Route = createFileRoute('/setup')({
  component: SetupPage,
});

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function SetupPage() {
  const { t } = useObjectTranslation();
  const navigate = useNavigate();
  const client = useClient() as any;
  const { user, refresh } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bootstrapped, setBootstrapped] = useState<boolean | null>(null);

  // Probe bootstrap-status on mount via the SDK. If an owner already exists,
  // this page shouldn't be reachable — bounce back to /login.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { hasOwner } = await client.auth.bootstrapStatus();
        if (!cancelled) setBootstrapped(hasOwner);
      } catch {
        if (!cancelled) setBootstrapped(false);
      }
    })();
    return () => { cancelled = true; };
  }, [client]);

  useEffect(() => {
    if (bootstrapped === true && !user) {
      navigate({ to: '/login', replace: true });
    }
  }, [bootstrapped, user, navigate]);

  useEffect(() => {
    if (user) {
      // Already authenticated — hand off to the platform home.
      window.location.assign('/');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client?.auth) return;
    setSubmitting(true);
    try {
      // 1. Create the owner user (better-auth standard endpoint).
      await client.auth.register({ name, email, password });

      // 2. Refresh local session (sign-up auto-issues a session cookie).
      await refresh();

      // 3. The Security plugin auto-creates a personal "<User>'s Workspace"
      //    on signup so multi-tenant RLS has something to hang on. Don't
      //    create a *second* org — rename the auto-created one to the
      //    name the user picked. If for some reason no org was auto-created
      //    (security plugin disabled), fall back to creating one.
      const trimmedName = orgName.trim();
      if (trimmedName) {
        try {
          const { organizations: existingOrgs } = await client.organizations.list();
          const personal = existingOrgs?.[0];
          let activeOrgId: string | undefined;
          if (personal?.id) {
            await client.organizations.update(personal.id, {
              name: trimmedName,
              slug: slugify(trimmedName),
            });
            activeOrgId = personal.id;
          } else {
            const created = await client.organizations.create({
              name: trimmedName,
              slug: slugify(trimmedName),
            });
            activeOrgId = (created as any)?.id ?? (created as any)?.data?.id;
          }
          if (activeOrgId) {
            await client.organizations.setActive(activeOrgId).catch(() => {});
          }
        } catch (err) {
          // Non-fatal: user can rename / create from settings later.
          console.warn('[setup] organization rename/create failed', err);
        }
      }

      window.location.assign('/');
    } catch (err) {
      toast({
        title: t('auth.setup.failed'),
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (bootstrapped === null) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center bg-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground/20 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-muted p-6">
      <div className="flex w-full max-w-md flex-col gap-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>{t('auth.setup.welcomeTitle')}</CardTitle>
            <CardDescription>{t('auth.setup.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">{t('auth.setup.yourName')}</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="orgName">{t('auth.setup.orgName')}</Label>
                <Input
                  id="orgName"
                  required
                  placeholder={t('auth.setup.orgNamePlaceholder')}
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">{t('auth.emailLabel')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">{t('auth.passwordLabel')}</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder={t('auth.setup.passwordHint')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="mt-2 w-full" disabled={submitting}>
                {submitting ? t('auth.setup.submitting') : t('auth.setup.submit')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
