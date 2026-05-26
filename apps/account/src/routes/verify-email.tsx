// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useObjectTranslation } from '@object-ui/i18n';
import { useClient } from '@objectstack/client-react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthShell } from '@/components/auth/auth-shell';

export const Route = createFileRoute('/verify-email')({
  validateSearch: (search: Record<string, unknown>): { token?: string } => {
    const t = search.token;
    return typeof t === 'string' ? { token: t } : {};
  },
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { t } = useObjectTranslation();
  const { token } = Route.useSearch();
  const client = useClient() as any;
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage(t('auth.verifyEmail.missingToken'));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await client.auth.verifyEmail({ token });
        if (!cancelled) setStatus('success');
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setMessage((err as Error).message || t('auth.verifyEmail.errorDescription'));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token, t, client]);

  return (
    <AuthShell>
      <Card className="border-border/60 shadow-sm shadow-primary/5 backdrop-blur supports-[backdrop-filter]:bg-card/95">
        {status === 'loading' && (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-xl tracking-tight">{t('auth.verifyEmail.verifyingTitle')}</CardTitle>
              <CardDescription>{t('auth.verifyEmail.verifyingDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center py-6">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
            </CardContent>
          </>
        )}
        {status === 'success' && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/30">
                <CheckCircle2 className="size-6" />
              </div>
              <CardTitle className="text-xl tracking-tight">{t('auth.verifyEmail.successTitle')}</CardTitle>
              <CardDescription>{t('auth.verifyEmail.successDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link to="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                {t('auth.verifyEmail.signInLink')}
              </Link>
            </CardContent>
          </>
        )}
        {status === 'error' && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/30">
                <XCircle className="size-6" />
              </div>
              <CardTitle className="text-xl tracking-tight">{t('auth.verifyEmail.errorTitle')}</CardTitle>
              <CardDescription>{message || t('auth.verifyEmail.errorDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link to="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                {t('auth.verifyEmail.backToSignIn')}
              </Link>
            </CardContent>
          </>
        )}
      </Card>
    </AuthShell>
  );
}
