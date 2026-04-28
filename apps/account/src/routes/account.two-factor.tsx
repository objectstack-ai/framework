// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';

export const Route = createFileRoute('/account/two-factor')({
  component: TwoFactorPage,
});

function TwoFactorPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [enablePassword, setEnablePassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disabling, setDisabling] = useState(false);

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/two-factor/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: enablePassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any)?.message || `Request failed: ${res.status}`);
      }
      const data = await res.json();
      setTotpUri((data as any)?.totpURI ?? null);
      setEnablePassword('');
    } catch (err) {
      toast({
        title: 'Failed to enable 2FA',
        description: (err as Error).message,
        variant: 'destructive',
      });
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
      toast({
        title: 'Invalid code',
        description: (err as Error).message,
        variant: 'destructive',
      });
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
      toast({
        title: 'Failed to disable 2FA',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setDisabling(false);
    }
  };

  if (totpUri) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Set up two-factor authentication</CardTitle>
          <CardDescription>
            Scan the QR code with your authenticator app, then enter the verification code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded bg-muted p-3 font-mono text-xs break-all">{totpUri}</div>
          <p className="text-xs text-muted-foreground">
            Copy this URI into your authenticator app if you cannot scan the QR code.
          </p>
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
            <Badge variant="outline" className="border-green-600 text-green-600">
              Enabled
            </Badge>
          </div>
          <CardDescription>
            Your account is protected with 2FA. Enter your password to disable it.
          </CardDescription>
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
        <CardDescription>
          Add an extra layer of security to your account using a TOTP authenticator app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleEnable} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="enable-password">Password</Label>
            <Input
              id="enable-password"
              type="password"
              autoComplete="current-password"
              required
              value={enablePassword}
              onChange={(e) => setEnablePassword(e.target.value)}
              placeholder="Confirm with your account password"
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? 'Loading…' : 'Enable 2FA'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
