// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * UserMenu — avatar dropdown shown on the right of the Account chrome.
 * Surfaces account info and a sign-out action.
 */

import { useNavigate } from '@tanstack/react-router';
import { LogOut, User as UserIcon, Building2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/useSession';

function initials(name?: string | null, email?: string | null): string {
  const src = (name || email || '?').trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function UserMenu() {
  const navigate = useNavigate();
  const { user, loading, logout } = useSession();

  if (loading && !user) {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-muted" aria-hidden />;
  }

  if (!user) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-8"
        onClick={() => navigate({ to: '/login' })}
      >
        Sign in
      </Button>
    );
  }

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate({ to: '/login', replace: true });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
          <Avatar className="h-7 w-7">
            {user.image ? <AvatarImage src={user.image} alt={user.name ?? user.email ?? 'User'} /> : null}
            <AvatarFallback className="text-[11px]">
              {initials(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{user.name || user.email}</span>
            {user.email && (
              <span className="truncate text-[11px] text-muted-foreground">{user.email}</span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate({ to: '/account' })}>
          <UserIcon className="mr-2 h-3.5 w-3.5" />
          Account
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: '/organizations' })}>
          <Building2 className="mr-2 h-3.5 w-3.5" />
          Organizations
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout}>
          <LogOut className="mr-2 h-3.5 w-3.5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
