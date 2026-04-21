// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useClient } from '@objectstack/client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/useSession';
import { useEnvironments } from '@/hooks/useEnvironments';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const client = useClient() as any;
  const { session, user, refresh } = useSession();
  const { environments, loading: envsLoading } = useEnvironments();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!session?.activeOrganizationId) {
      navigate({ to: '/orgs' });
      return;
    }
    if (envsLoading) return;

    const lastEnvId = localStorage.getItem('objectstack.lastEnvId');
    const targetEnv =
      (lastEnvId && environments.find((e) => e.id === lastEnvId)) ||
      environments.find((e) => e.isDefault) ||
      environments[0];

    if (targetEnv) {
      navigate({
        to: '/environments/$environmentId',
        params: { environmentId: targetEnv.id },
      });
    } else {
      navigate({ to: '/environments' });
    }
  }, [user, session, environments, envsLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client?.auth) return;
    setSubmitting(true);
    try {
      await client.auth.login({ type: 'email', email, password });
      await refresh();
      toast({ title: 'Welcome back' });
    } catch (err) {
      toast({
        title: 'Sign in failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Access your ObjectStack Studio workspace.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
            <p className="text-xs text-muted-foreground">
              No account?{' '}
              <Link to="/register" className="text-primary hover:underline">
                Create one
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
