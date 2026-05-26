// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useObjectTranslation } from '@object-ui/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { AuthShell } from '@/components/auth/auth-shell';

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useObjectTranslation();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const redirectTo = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '') + '/reset-password';
      const res = await fetch('/api/v1/auth/forget-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, redirectTo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any)?.message || `Request failed: ${res.status}`);
      }
      setSent(true);
    } catch (err) {
      toast({
        title: t('auth.forgotPassword.failed'),
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
        {sent ? (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-xl tracking-tight">{t('auth.forgotPassword.checkEmailTitle')}</CardTitle>
              <CardDescription>
                {t('auth.forgotPassword.checkEmailDescription', { email })}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link to="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                {t('auth.forgotPassword.backToSignIn')}
              </Link>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-xl tracking-tight">{t('auth.forgotPassword.title')}</CardTitle>
              <CardDescription>{t('auth.forgotPassword.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                <Button
                  type="submit"
                  className="w-full bg-brand-gradient text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:opacity-95 hover:shadow-md hover:shadow-primary/30"
                  disabled={submitting}
                >
                  {submitting ? t('auth.forgotPassword.submitting') : t('auth.forgotPassword.submit')}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  {t('auth.forgotPassword.rememberPassword')}{' '}
                  <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
                    {t('auth.forgotPassword.signIn')}
                  </Link>
                </p>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </AuthShell>
  );
}
