// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useClient } from '@objectstack/client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/useSession';
import { CheckCircle2, Monitor, AlertCircle } from 'lucide-react';

export const Route = createFileRoute('/auth/device')({
  validateSearch: (search: Record<string, unknown>) => ({
    code: (search.code as string) ?? '',
  }),
  component: DeviceAuthPage,
});

function DeviceAuthPage() {
  const { code } = Route.useSearch();
  const { user, refresh } = useSession();
  const client = useClient() as any;
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState('');

  if (!code) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Invalid Request</CardTitle>
            <CardDescription>No device code provided.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (approved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <CardTitle>Login Approved</CardTitle>
            <CardDescription>
              You can close this tab. The CLI has been authenticated successfully.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await client.auth.login({ type: 'email', email, password });
      await refresh();
    } catch (err: any) {
      setError(err?.message ?? 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    setError('');
    setSubmitting(true);
    try {
      // Get the current session token from better-auth cookie/session
      const sessionRes = await fetch('/api/v1/auth/get-session', { credentials: 'include' });
      const sessionData = await sessionRes.json() as any;
      const token = sessionData?.session?.token;
      if (!token) throw new Error('No active session');

      const res = await fetch('/api/v1/auth/device/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code, token }),
      });
      const data = await res.json() as any;
      if (!data.success) throw new Error(data.error?.message ?? 'Approval failed');

      setApproved(true);
      toast({ title: 'CLI login approved', description: 'The CLI has been authenticated.' });
    } catch (err: any) {
      setError(err?.message ?? 'Approval failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Monitor className="h-10 w-10 text-primary mx-auto mb-2" />
          <CardTitle>CLI Login Request</CardTitle>
          <CardDescription>
            {user
              ? `Approve CLI access for ${user.email}`
              : 'Sign in to approve the CLI login request'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-md px-4 py-2 text-center">
            <p className="text-xs text-muted-foreground mb-1">Device Code</p>
            <p className="font-mono font-semibold tracking-widest text-lg">{code}</p>
          </div>

          {!user ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign In'}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-center text-muted-foreground">
                Logged in as <span className="font-medium text-foreground">{user.email}</span>
              </p>
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
              <Button onClick={handleApprove} className="w-full" disabled={submitting}>
                {submitting ? 'Approving…' : 'Approve CLI Access'}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate({ to: '/' })}
              >
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
