// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * MembersPanel — list + invite + role-management UI for a single project.
 *
 * The list view renders user name / email / role chip and (for privileged
 * callers) a per-row action menu to change role or remove. An "Invite"
 * button opens a dialog that collects an email + role and calls
 * `useMemberMutations().invite`.
 *
 * Permission model is enforced server-side; this component just hides
 * mutation affordances when `canManage` is false so the UI doesn't tease
 * actions that would 403.
 */

import { useState } from 'react';
import { MoreHorizontal, UserPlus, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

import {
  type ProjectMemberRow,
  useMemberMutations,
  useProjectMembers,
} from '@/hooks/useProjects';

const ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
type Role = (typeof ROLES)[number];

interface Props {
  projectId: string;
  /** Caller's role on this project, used to gate mutation affordances. */
  callerRole?: string;
}

export function MembersPanel({ projectId, callerRole }: Props) {
  const { items: members, reload, loading } = useProjectMembers(projectId);
  const { invite, updateRole, remove, busy } = useMemberMutations();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');

  const canManage = callerRole === 'owner' || callerRole === 'admin';
  const ownerCount = members.filter((m) => m.role === 'owner').length;

  const submitInvite = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    try {
      const res = await invite(projectId, { email: trimmed, role });
      toast({
        title: res.alreadyMember
          ? `${trimmed} is already a member`
          : `Invited ${trimmed} as ${role}`,
      });
      setEmail('');
      setRole('member');
      setInviteOpen(false);
      await reload();
    } catch (err: any) {
      toast({ title: 'Failed to invite', description: err?.message, variant: 'destructive' });
    }
  };

  const onChangeRole = async (m: ProjectMemberRow, next: Role) => {
    if (m.role === next) return;
    try {
      await updateRole(projectId, m.id, next);
      toast({ title: `Role updated to ${next}` });
      await reload();
    } catch (err: any) {
      toast({ title: 'Failed to update role', description: err?.message, variant: 'destructive' });
    }
  };

  const onRemove = async (m: ProjectMemberRow) => {
    const label = m.user?.name || m.user?.email || m.user_id;
    if (!confirm(`Remove ${label} from this project?`)) return;
    try {
      await remove(projectId, m.id);
      toast({ title: `${label} removed` });
      await reload();
    } catch (err: any) {
      toast({ title: 'Failed to remove member', description: err?.message, variant: 'destructive' });
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          Members
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{members.length}</span>
          {canManage && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2 text-xs">
                  <UserPlus className="h-3 w-3" />
                  Invite
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite a member</DialogTitle>
                  <DialogDescription>
                    Add a teammate by email. They must already have an account
                    on this server.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="invite-email" className="mb-1 block text-xs font-medium">
                      Email
                    </label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="teammate@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Role</label>
                    <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r} className="capitalize">
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button onClick={submitInvite} disabled={busy || !email.trim()}>
                    {busy ? 'Inviting…' : 'Send invite'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {loading && members.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No members yet. The project creator becomes the owner automatically.
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {members.map((m) => {
            const isLastOwner = m.role === 'owner' && ownerCount <= 1;
            return (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {m.user?.name || m.user?.email || m.user_id}
                  </div>
                  {m.user?.email && m.user?.name && (
                    <div className="truncate text-xs text-muted-foreground">
                      {m.user.email}
                    </div>
                  )}
                </div>
                <Badge variant="secondary" className="capitalize">
                  {m.role}
                </Badge>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        aria-label="Member actions"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuLabel className="text-xs">Change role</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={m.role}
                        onValueChange={(v) => onChangeRole(m, v as Role)}
                      >
                        {ROLES.map((r) => (
                          <DropdownMenuRadioItem
                            key={r}
                            value={r}
                            className="capitalize"
                            disabled={isLastOwner && r !== 'owner'}
                          >
                            {r}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onRemove(m)}
                        disabled={isLastOwner}
                        className="text-destructive focus:text-destructive"
                      >
                        Remove from project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
