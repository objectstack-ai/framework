// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * React hooks for organization member and invitation management.
 * Built on top of better-auth's organization plugin APIs.
 */

import { useCallback, useEffect, useState } from 'react';
import { useClient } from '@objectstack/client-react';

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  createdAt?: string;
  user?: {
    id: string;
    name?: string;
    email?: string;
    image?: string;
  };
}

export interface OrganizationInvitation {
  id: string;
  email: string;
  organizationId: string;
  role: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'canceled';
  inviterId: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * Hook to manage members of an organization
 */
export function useOrganizationMembers(organizationId: string | undefined) {
  const client = useClient() as any;
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadMembers = useCallback(async () => {
    if (!organizationId || !client?.organizations) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await client.organizations.listMembers(organizationId);
      const membersList = res?.members ?? res?.data?.members ?? res ?? [];
      setMembers(membersList);
    } catch (err) {
      setError(err as Error);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [client, organizationId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const inviteMember = useCallback(
    async (email: string, role: string = 'member') => {
      if (!organizationId || !client?.organizations) {
        throw new Error('Organization ID or client not available');
      }

      const res = await client.organizations.invite({
        email,
        role,
        organizationId,
      });

      // Reload members after invitation
      await loadMembers();
      return res;
    },
    [client, organizationId, loadMembers]
  );

  const removeMember = useCallback(
    async (userId: string) => {
      if (!organizationId || !client?.organizations) {
        throw new Error('Organization ID or client not available');
      }

      // Note: better-auth's organization plugin may not have a direct remove member endpoint
      // This would typically be done through the data API or a custom endpoint
      // For now, we'll use a placeholder that would need to be implemented
      const route = '/api/v1/auth';
      const res = await client.fetch(`${client.baseUrl}${route}/organization/remove-member`, {
        method: 'POST',
        body: JSON.stringify({ organizationId, userId }),
      });

      if (!res.ok) {
        throw new Error('Failed to remove member');
      }

      // Reload members after removal
      await loadMembers();
      return res.json();
    },
    [client, organizationId, loadMembers]
  );

  const updateMemberRole = useCallback(
    async (userId: string, newRole: string) => {
      if (!organizationId || !client?.organizations) {
        throw new Error('Organization ID or client not available');
      }

      // Note: Role update would need to be implemented via better-auth or custom endpoint
      const route = '/api/v1/auth';
      const res = await client.fetch(`${client.baseUrl}${route}/organization/update-member-role`, {
        method: 'POST',
        body: JSON.stringify({ organizationId, userId, role: newRole }),
      });

      if (!res.ok) {
        throw new Error('Failed to update member role');
      }

      // Reload members after update
      await loadMembers();
      return res.json();
    },
    [client, organizationId, loadMembers]
  );

  return {
    members,
    loading,
    error,
    reload: loadMembers,
    inviteMember,
    removeMember,
    updateMemberRole,
  };
}

/**
 * Hook to manage organization invitations
 */
export function useOrganizationInvitations(organizationId: string | undefined) {
  const client = useClient() as any;
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadInvitations = useCallback(async () => {
    if (!organizationId || !client?.organizations) return;

    setLoading(true);
    setError(null);
    try {
      // Note: better-auth may not have a direct list invitations endpoint
      // This would need to query the sys_invitation object via data API
      const route = '/api/v1/data';
      const res = await client.fetch(
        `${client.baseUrl}${route}/sys_invitation?filter=organization_id eq '${organizationId}'&sort=-created_at`
      );
      
      if (!res.ok) {
        throw new Error('Failed to load invitations');
      }

      const data = await res.json();
      const invitationsList = data?.data?.items ?? data?.items ?? [];
      setInvitations(invitationsList);
    } catch (err) {
      setError(err as Error);
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  }, [client, organizationId]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  const cancelInvitation = useCallback(
    async (invitationId: string) => {
      if (!client) {
        throw new Error('Client not available');
      }

      // Update invitation status to 'canceled'
      const route = '/api/v1/data';
      const res = await client.fetch(`${client.baseUrl}${route}/sys_invitation/${invitationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'canceled' }),
      });

      if (!res.ok) {
        throw new Error('Failed to cancel invitation');
      }

      // Reload invitations after cancellation
      await loadInvitations();
      return res.json();
    },
    [client, loadInvitations]
  );

  const resendInvitation = useCallback(
    async (invitationId: string) => {
      if (!client) {
        throw new Error('Client not available');
      }

      // This would typically create a new invitation with the same email/role
      // and cancel the old one
      const route = '/api/v1/auth';
      const res = await client.fetch(`${client.baseUrl}${route}/organization/resend-invitation`, {
        method: 'POST',
        body: JSON.stringify({ invitationId }),
      });

      if (!res.ok) {
        throw new Error('Failed to resend invitation');
      }

      // Reload invitations after resending
      await loadInvitations();
      return res.json();
    },
    [client, loadInvitations]
  );

  return {
    invitations,
    loading,
    error,
    reload: loadInvitations,
    cancelInvitation,
    resendInvitation,
  };
}
