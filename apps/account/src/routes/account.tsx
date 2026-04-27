// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { LogOut, Monitor, Shield, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/useSession';

export const Route = createFileRoute('/account')({
  component: AccountPage,
});

// ---------------------------------------------------------------------------
// Profile tab
// ---------------------------------------------------------------------------

function ProfileTab() {
  const { user, refresh } = useSession();
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name ?? '');
  }, [user?.name]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/v1/auth/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any)?.message || `Request failed: ${res.status}`);
      }
      await refresh();
      toast({ title: 'Profile updated' });
    } catch (err) {
      toast({ title: 'Failed to update profile', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profile</CardTitle>
        <CardDescription>Update your display name.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={user?.email ?? ''} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Security tab (change password)
// ---------------------------------------------------------------------------

function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any)?.message || `Request failed: ${res.status}`);
      }
      toast({ title: 'Password changed' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast({ title: 'Failed to change password', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Change password</CardTitle>
        <CardDescription>Update your account password.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-new-password">Confirm new password</Label>
            <Input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Change password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sessions tab
// ---------------------------------------------------------------------------

interface SessionRecord {
  id: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
  expiresAt: string;
  token: string;
}

function SessionsTab() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const loadSessions = async () => {
    try {
      const res = await fetch('/api/v1/auth/list-sessions', { credentials: 'include' });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      setSessions((data as any)?.sessions ?? data ?? []);
    } catch (err) {
      toast({ title: 'Failed to load sessions', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSessions(); }, []);

  const handleRevoke = async (token: string) => {
    setRevoking(token);
    try {
      const res = await fetch('/api/v1/auth/revoke-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any)?.message || `Request failed: ${res.status}`);
      }
      toast({ title: 'Session revoked' });
      await loadSessions();
    } catch (err) {
      toast({ title: 'Failed to revoke session', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeOthers = async () => {
    setRevokingOthers(true);
    try {
      const res = await fetch('/api/v1/auth/revoke-other-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any)?.message || `Request failed: ${res.status}`);
      }
      toast({ title: 'Other sessions revoked' });
      await loadSessions();
    } catch (err) {
      toast({ title: 'Failed to revoke sessions', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setRevokingOthers(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Active sessions</CardTitle>
            <CardDescription>Manage devices that are signed in to your account.</CardDescription>
          </div>
          {sessions.length > 1 && (
            <Button variant="outline" size="sm" onClick={handleRevokeOthers} disabled={revokingOthers}>
              {revokingOthers ? 'Revoking…' : 'Revoke all others'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-xs text-muted-foreground">Loading sessions…</p>}
        {!loading && sessions.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No active sessions found.</p>
        )}
        {!loading && sessions.length > 0 && (
          <div className="divide-y">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {s.userAgent ?? 'Unknown device'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 space-x-3">
                    {s.ipAddress && <span>{s.ipAddress}</span>}
                    <span>Expires {new Date(s.expiresAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevoke(s.token)}
                  disabled={revoking === s.token}
                  className="ml-3 shrink-0"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Two-Factor tab
// ---------------------------------------------------------------------------

function TwoFactorTab() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disabling, setDisabling] = useState(false);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/two-factor/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any)?.message || `Request failed: ${res.status}`);
      }
      const data = await res.json();
      setTotpUri((data as any)?.totpURI ?? null);
    } catch (err) {
      toast({ title: 'Failed to enable 2FA', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    try {
      const res = await fetch('/api/v1/auth/two-factor/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: verifyCode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any)?.message || `Request failed: ${res.status}`);
      }
      toast({ title: 'Two-factor authentication enabled' });
      setEnabled(true);
      setTotpUri(null);
      setVerifyCode('');
    } catch (err) {
      toast({ title: 'Invalid code', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setVerifying(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisabling(true);
    try {
      const res = await fetch('/api/v1/auth/two-factor/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: disablePassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any)?.message || `Request failed: ${res.status}`);
      }
      toast({ title: 'Two-factor authentication disabled' });
      setEnabled(false);
      setDisablePassword('');
    } catch (err) {
      toast({ title: 'Failed to disable 2FA', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setDisabling(false);
    }
  };

  if (totpUri) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Set up two-factor authentication</CardTitle>
          <CardDescription>Scan the QR code with your authenticator app, then enter the verification code.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded bg-muted p-3 font-mono text-xs break-all">{totpUri}</div>
          <p className="text-xs text-muted-foreground">Copy this URI into your authenticator app if you cannot scan the QR code.</p>
          <Separator />
          <form onSubmit={handleVerifyTotp} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="totp-code">Verification code</Label>
              <Input
                id="totp-code"
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={verifying}>
                {verifying ? 'Verifying…' : 'Verify and enable'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setTotpUri(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (enabled === true) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Two-factor authentication</CardTitle>
            <Badge variant="outline" className="text-green-600 border-green-600">Enabled</Badge>
          </div>
          <CardDescription>Your account is protected with 2FA. Enter your password to disable it.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleDisable} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="disable-password">Password</Label>
              <Input
                id="disable-password"
                type="password"
                autoComplete="current-password"
                required
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
              />
            </div>
            <Button variant="destructive" type="submit" disabled={disabling}>
              {disabling ? 'Disabling…' : 'Disable 2FA'}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Two-factor authentication</CardTitle>
          <Badge variant="outline">Not enabled</Badge>
        </div>
        <CardDescription>Add an extra layer of security to your account using a TOTP authenticator app.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleEnable} disabled={loading}>
          {loading ? 'Loading…' : 'Enable 2FA'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function AccountPage() {
  const { user, logout } = useSession();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await logout();
    } finally {
      navigate({ to: '/login' });
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 px-6 py-8 overflow-auto">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Account</h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile">
                <User className="mr-2 h-4 w-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="security">
                <Shield className="mr-2 h-4 w-4" />
                Security
              </TabsTrigger>
              <TabsTrigger value="sessions">
                <Monitor className="mr-2 h-4 w-4" />
                Sessions
              </TabsTrigger>
              <TabsTrigger value="2fa">
                <Shield className="mr-2 h-4 w-4" />
                Two-Factor
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-4">
              <ProfileTab />
            </TabsContent>

            <TabsContent value="security" className="mt-4">
              <SecurityTab />
            </TabsContent>

            <TabsContent value="sessions" className="mt-4">
              <SessionsTab />
            </TabsContent>

            <TabsContent value="2fa" className="mt-4">
              <TwoFactorTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
