// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useObjectTranslation } from '@object-ui/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { AuthShell } from '@/components/auth/auth-shell';

export const Route = createFileRoute('/reset-password')({
  validateSearch: (search: Record<string, unknown>): { token?: string } => {
    const t = search.token;
    return typeof t === 'string' ? { token: t } : {};
  },
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useObjectTranslation();
  const navigate = useNavigate();
  const { token } = Route.useSearch();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: t('auth.resetPassword.passwordsMismatch'), variant: 'destructive' });
      return;
    }
    if (!token) {
      toast({ title: t('auth.resetPassword.missingToken'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any)?.message || `Request failed: ${res.status}`);
      }
      toast({ title: t('auth.resetPassword.success') });
      navigate({ to: '/login' });
    } catch (err) {
      toast({
        title: t('auth.resetPassword.failed'),
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <Card className="border-border/60 shadow-sm shadow-primary/5 backdrop-blur supports-[backdrop-filter]:bg-card/95">
        <CardHeader className="text-center">
          <CardTitle className="text-xl tracking-tight">{t('auth.resetPassword.title')}</CardTitle>
          <CardDescription>{t('auth.resetPassword.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <p className="text-sm text-muted-foreground text-center">
              {t('auth.resetPassword.invalidToken')}{' '}
              <Link to="/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">
                {t('auth.resetPassword.requestNewLink')}
              </Link>
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-password">{t('auth.resetPassword.newPassword')}</Label>
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
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm-password">{t('auth.resetPassword.confirmPassword')}</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-brand-gradient text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:opacity-95 hover:shadow-md hover:shadow-primary/30"
                disabled={submitting}
              >
                {submitting ? t('auth.resetPassword.submitting') : t('auth.resetPassword.submit')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}
