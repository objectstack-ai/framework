// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { ArrowLeft, Clock, Mail, MoreVertical, Trash2, UserPlus, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useOrganizations, useSession } from '@/hooks/useSession';
import {
  useOrganizationMembers,
  useOrganizationInvitations,
} from '@/hooks/useOrganizationMembers';

export const Route = createFileRoute('/orgs/$orgId')({
  component: OrgDetailPage,
});

function OrgDetailPage() {
  const { orgId } = Route.useParams();
  const navigate = useNavigate();
  const { organizations } = useOrganizations();
  const { session, setActiveOrganization } = useSession();
  const org = organizations.find((o) => o.id === orgId);
  
  const {
    members,
    loading: loadingMembers,
    inviteMember,
    removeMember,
  } = useOrganizationMembers(orgId);

  const {
    invitations,
    loading: loadingInvitations,
    cancelInvitation,
  } = useOrganizationInvitations(orgId);

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);

  const handleSetActive = async () => {
    try {
      await setActiveOrganization(orgId);
      toast({ title: 'Organization switched' });
    } catch (err) {
      toast({
        title: 'Failed to switch',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail) {
      toast({
        title: 'Email required',
        description: 'Please enter an email address',
        variant: 'destructive',
      });
      return;
    }

    setInviting(true);
    try {
      await inviteMember(inviteEmail, inviteRole);
      toast({ title: 'Invitation sent successfully' });
      setInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole('member');
    } catch (err) {
      toast({
        title: 'Failed to send invitation',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this organization?`)) {
      return;
    }

    try {
      await removeMember(userId);
      toast({ title: 'Member removed successfully' });
    } catch (err) {
      toast({
        title: 'Failed to remove member',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleCancelInvitation = async (invitationId: string, email: string) => {
    if (!confirm(`Cancel invitation for ${email}?`)) {
      return;
    }

    try {
      await cancelInvitation(invitationId);
      toast({ title: 'Invitation canceled' });
    } catch (err) {
      toast({
        title: 'Failed to cancel invitation',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  const isActive = session?.activeOrganizationId === orgId;
  const pendingInvitations = invitations.filter((i) => i.status === 'pending');

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 px-6 py-8 overflow-auto">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/orgs' })}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            {!isActive && (
              <Button size="sm" onClick={handleSetActive}>
                Set as active
              </Button>
            )}
          </div>

          {/* Organization Overview Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{org?.name ?? 'Organization'}</CardTitle>
                  {org?.slug && (
                    <CardDescription className="font-mono text-xs mt-1">
                      {org.slug}
                    </CardDescription>
                  )}
                </div>
                {isActive && (
                  <Badge variant="outline" className="ml-2">
                    Active
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID</span>
                <code className="text-xs">{orgId}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Members</span>
                <span>{members.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pending Invitations</span>
                <span>{pendingInvitations.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* Tabs for Members and Invitations */}
          <Tabs defaultValue="members" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="members">
                <Users className="mr-2 h-4 w-4" />
                Members ({members.length})
              </TabsTrigger>
              <TabsTrigger value="invitations">
                <Mail className="mr-2 h-4 w-4" />
                Invitations ({pendingInvitations.length})
              </TabsTrigger>
            </TabsList>

            {/* Members Tab */}
            <TabsContent value="members" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Members</CardTitle>
                      <CardDescription>
                        People with access to this organization
                      </CardDescription>
                    </div>
                    <Button size="sm" onClick={() => setInviteDialogOpen(true)}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Invite
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingMembers && (
                    <p className="text-xs text-muted-foreground">Loading members...</p>
                  )}
                  {!loadingMembers && members.length === 0 && (
                    <div className="text-center py-8">
                      <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <p className="mt-4 text-sm text-muted-foreground">
                        No members yet. Invite someone to get started.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-4"
                        onClick={() => setInviteDialogOpen(true)}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Invite member
                      </Button>
                    </div>
                  )}
                  {!loadingMembers && members.length > 0 && (
                    <div className="divide-y">
                      {members.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between py-3"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              {m.user?.name || m.userId}
                            </div>
                            {m.user?.email && (
                              <div className="text-xs text-muted-foreground">
                                {m.user.email}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {m.role ?? 'member'}
                            </Badge>
                            {m.role !== 'owner' && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() =>
                                      handleRemoveMember(
                                        m.userId,
                                        m.user?.name || m.user?.email || m.userId
                                      )
                                    }
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Remove member
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Invitations Tab */}
            <TabsContent value="invitations" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Pending Invitations</CardTitle>
                      <CardDescription>
                        Invitations sent to join this organization
                      </CardDescription>
                    </div>
                    <Button size="sm" onClick={() => setInviteDialogOpen(true)}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Send invitation
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingInvitations && (
                    <p className="text-xs text-muted-foreground">Loading invitations...</p>
                  )}
                  {!loadingInvitations && pendingInvitations.length === 0 && (
                    <div className="text-center py-8">
                      <Mail className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <p className="mt-4 text-sm text-muted-foreground">
                        No pending invitations
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Invitations will appear here once sent
                      </p>
                    </div>
                  )}
                  {!loadingInvitations && pendingInvitations.length > 0 && (
                    <div className="divide-y">
                      {pendingInvitations.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between py-3"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-sm">{inv.email}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {inv.role}
                              </Badge>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Expires {new Date(inv.expiresAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleCancelInvitation(inv.id, inv.email)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <p className="text-xs text-muted-foreground">
            Need to manage projects?{' '}
            <Link to="/projects" className="text-primary hover:underline">
              Go to projects
            </Link>
          </p>
        </div>
      </div>

      {/* Invite Member Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite member</DialogTitle>
            <DialogDescription>
              Send an invitation to join {org?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {inviteRole === 'owner' && 'Full access to manage the organization'}
                {inviteRole === 'admin' &&
                  'Can manage members and settings, but cannot delete the organization'}
                {inviteRole === 'member' && 'Can view and use organization resources'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInviteDialogOpen(false)}
              disabled={inviting}
            >
              Cancel
            </Button>
            <Button onClick={handleInviteMember} disabled={inviting}>
              {inviting ? 'Sending...' : 'Send invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
