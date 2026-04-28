// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useClient } from '@objectstack/client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/useSession';
import { GalleryVerticalEnd, ShieldCheck } from 'lucide-react';

/**
 * First-run setup page.
 *
 * Renders only when `/api/v1/auth/bootstrap-status` reports `hasOwner: false`.
 * Creates the first user via better-auth's standard `sign-up/email` and
 * provisions a default organization for them. Once an owner exists this
 * route becomes inert and `__root` will redirect away.
 */
export const Route = createFileRoute('/setup')({
  component: SetupPage,
});

function SetupPage() {
  const navigate = useNavigate();
  const client = useClient() as any;
  const { user, refresh } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('Local');
  const [submitting, setSubmitting] = useState(false);
  const [bootstrapped, setBootstrapped] = useState<boolean | null>(null);

  // Probe bootstrap-status on mount. If an owner already exists, this page
  // shouldn't be reachable — bounce back to /login.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/auth/bootstrap-status');
        const data = await res.json() as { hasOwner: boolean };
        if (!cancelled) setBootstrapped(data.hasOwner);
      } catch {
        if (!cancelled) setBootstrapped(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (bootstrapped === true && !user) {
      navigate({ to: '/login', replace: true });
    }
  }, [bootstrapped, user, navigate]);

  useEffect(() => {
    // Already authenticated — bounce to Studio. Account SPA has no "home";
    // its index just redirects to /login, which would render a blank flicker.
    if (user) {
      window.location.assign('/_studio/');
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

      // 3. Provision the default organization. better-auth's organization
      //    plugin attaches the calling user as owner automatically.
      try {
        const slug = orgName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'local';
        await fetch('/api/v1/auth/organization/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: orgName.trim() || 'Local', slug }),
        });
      } catch {
        // Non-fatal: user can create an org from the dashboard.
      }

      toast({ title: 'Welcome to ObjectStack', description: 'Your owner account has been created.' });
      // Hand off to Studio — that's the actual workspace. The redirect-on-user
      // effect above will also fire, but doing it here avoids a one-frame
      // flash of the form's "submitting" state.
      window.location.assign('/_studio/');
    } catch (err) {
      toast({
        title: 'Setup failed',
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
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <a href="#" className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GalleryVerticalEnd className="size-4" />
          </div>
          ObjectStack
        </a>
        <Card>
          <CardHeader className="text-center">
            <ShieldCheck className="mx-auto mb-2 h-10 w-10 text-primary" />
            <CardTitle className="text-xl">Welcome to ObjectStack</CardTitle>
            <CardDescription>
              No owner account exists yet. Create the first administrator to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">At least 8 characters.</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="orgName">Organization name</Label>
                <Input
                  id="orgName"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  You can rename or add more organizations later.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Creating owner account…' : 'Create owner account'}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="px-6 text-center text-xs text-muted-foreground">
          This screen only appears on first launch. After setup, all users sign in normally.
        </p>
      </div>
    </div>
  );
}
