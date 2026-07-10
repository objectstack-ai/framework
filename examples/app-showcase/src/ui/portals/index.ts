// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Client Portal — an external-user projection of the showcase. Demonstrates
 * the portal kind discriminator, position-scoped admission (ADR-0090 — the
 * former `profiles` gate was removed with the Profile concept), and
 * view-backed navigation. `client_portal_user` is a real showcase position
 * (src/security/positions.ts) the admin assigns to external client users.
 */
export const ClientPortal = {
  kind: 'portal' as const,
  id: 'showcase_client_portal',
  label: 'Client Portal',
  description: 'External portal for clients to track their projects.',
  routePrefix: '/portal/client',
  layout: 'minimal',
  authMode: 'magic-link',
  locale: 'auto',
  positions: ['client_portal_user'],
  seo: { title: 'Client Portal — Showcase', description: 'Track your projects.', robots: 'noindex' as const },
  navigation: [
    { type: 'view' as const, id: 'my_projects', label: 'My Projects', icon: 'folder-kanban', order: 1, viewRef: 'showcase_project.list' },
    { type: 'view' as const, id: 'my_tasks', label: 'My Tasks', icon: 'check-square', order: 2, viewRef: 'showcase_task.grid' },
  ],
};

export const allPortals = [ClientPortal];
