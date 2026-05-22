// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * StudioAccessDenied — friendly stop page shown when the signed-in user
 * is not a Studio admin. Studio is the developer / admin surface of
 * ObjectStack; ordinary end users belong in `/_console/`. This page
 * tells them why they're being blocked and offers a one-click path to
 * either switch accounts (logout → re-login) or jump back to Console.
 */

import { ShieldAlert, LogOut, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SessionUser } from '@/hooks/useSession';

export interface StudioAccessDeniedProps {
  user: SessionUser;
  onSwitchAccount: () => void;
}

export function StudioAccessDenied({ user, onSwitchAccount }: StudioAccessDeniedProps) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-7 w-7 text-destructive" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Studio is for admins only</h1>
          <p className="text-sm text-muted-foreground">
            Studio is the developer console for ObjectStack — schema design, runtime
            inspection, and metadata editing. Your account doesn't have admin access on
            this server.
          </p>
        </div>

        <div className="rounded-md border bg-muted/30 px-4 py-3 text-left text-xs">
          <div className="text-muted-foreground">Signed in as</div>
          <div className="mt-0.5 font-medium">
            {user.name ?? user.email ?? user.id}
            {user.email && user.name ? (
              <span className="ml-2 text-muted-foreground">({user.email})</span>
            ) : null}
          </div>
          <div className="mt-2 text-muted-foreground">
            Role: <code className="rounded bg-muted px-1 py-0.5">{user.role ?? 'user'}</code>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button asChild className="w-full gap-2">
            <a href="/_console/">
              Go to Console
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
          <Button variant="outline" onClick={onSwitchAccount} className="w-full gap-2">
            <LogOut className="h-4 w-4" />
            Sign out & switch account
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Need access? Ask a platform admin to grant you the{' '}
          <code className="rounded bg-muted px-1 py-0.5">admin_full_access</code>{' '}
          permission set, or make you an owner/admin of your organization.
        </p>
      </div>
    </div>
  );
}
