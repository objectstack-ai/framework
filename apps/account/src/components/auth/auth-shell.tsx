// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * AuthShell — minimal shared layout for every unauthenticated page
 * (login, register, forgot-password, reset-password, verify-email, …).
 *
 *   ┌─────────────────────────────────────────┐
 *   │                                         │
 *   │          centred form card              │
 *   │                                         │
 *   └─────────────────────────────────────────┘
 *
 * Deliberately brand-agnostic. ObjectStack is a developer tool — operators
 * use it to build their own customer-facing apps, and pinning a vendor
 * wordmark / marketing copy on the login screen of every downstream
 * deployment is wrong. The shell only shows a small host pill when the
 * current origin looks like a tenant subdomain, so a user bouncing through
 * an SSO redirect can still tell which workspace they're signing in to.
 *
 * The `headline` and `subline` props are kept for backwards-compat but are
 * intentionally unused; the previous split-panel ad copy is gone. Existing
 * call sites still compile without changes.
 */

import * as React from 'react';
import { useObjectTranslation } from '@object-ui/i18n';
import { cn } from '@/lib/utils';

export interface AuthShellProps {
  /** Form / interactive content rendered in the centred column. */
  children: React.ReactNode;
  /**
   * @deprecated Brand panel was removed for a generic, white-label auth
   * surface. Prop is kept so existing pages still compile.
   */
  headline?: React.ReactNode;
  /**
   * @deprecated Brand panel was removed for a generic, white-label auth
   * surface. Prop is kept so existing pages still compile.
   */
  subline?: React.ReactNode;
  /** Optional max-width on the form container (default `sm`). */
  formWidth?: 'sm' | 'md';
}

/**
 * Hosts that look like a canonical cloud control-plane (e.g. `cloud.*`)
 * — when the page is rendered on one of these we hide the host pill
 * because the URL bar already identifies the workspace.
 */
function isCanonicalCloudHost(host: string): boolean {
  const bare = host.split(':')[0]!.toLowerCase();
  return /^cloud\./.test(bare);
}

function currentHost(): string | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.host;
  return host || null;
}

export function AuthShell({
  children,
  // headline/subline are intentionally ignored — see file header.
  formWidth = 'sm',
}: AuthShellProps) {
  const { t } = useObjectTranslation();
  const widthCls = formWidth === 'md' ? 'max-w-md' : 'max-w-sm';

  const host = currentHost();
  const showHostPill = !!host && !isCanonicalCloudHost(host);

  React.useEffect(() => {
    if (typeof document === 'undefined' || !host) return;
    const original = document.title;
    if (showHostPill) document.title = host;
    return () => {
      document.title = original;
    };
  }, [host, showHostPill]);

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-muted p-6">
      <div className={cn('flex w-full flex-col gap-4', widthCls)}>
        {showHostPill ? (
          <div className="flex justify-center">
            <span
              className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground"
              title={t('auth.shell.tenantHostHint', {
                defaultValue: 'You are signing in to this workspace',
              })}
            >
              {host}
            </span>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
