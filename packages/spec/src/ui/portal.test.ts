// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, expect, it } from 'vitest';
import { PortalSchema, definePortal } from './portal.zod';

describe('PortalSchema', () => {
  it('accepts a minimal authenticated portal', () => {
    const portal = definePortal({
      kind: 'portal',
      id: 'helpdesk_customer',
      label: 'Help Center',
      routePrefix: '/portal/helpdesk',
      positions: ['helpdesk_customer_portal'],
      navigation: [
        {
          id: 'nav_my_tickets',
          type: 'view',
          label: 'My Tickets',
          viewRef: 'helpdesk_ticket.list.my_tickets',
        },
      ],
    });
    expect(portal.kind).toBe('portal');
    expect(portal.routePrefix).toBe('/portal/helpdesk');
    expect(portal.layout).toBe('minimal');
    expect(portal.authMode).toBe('authenticated');
  });

  it('accepts anonymousEntry with rate-limit and captcha', () => {
    const portal = definePortal({
      kind: 'portal',
      id: 'helpdesk_customer',
      label: 'Help Center',
      routePrefix: '/portal/helpdesk',
      authMode: 'magic-link',
      positions: ['helpdesk_customer_portal'],
      navigation: [
        { id: 'nav_my', type: 'view', label: 'My', viewRef: 'helpdesk_ticket.list.my_tickets' },
      ],
      anonymousEntry: {
        routes: [
          {
            path: '/submit',
            actionRef: 'helpdesk_ticket.create',
            rateLimit: { rule: '5/hour/ip', scope: 'ip' },
            captcha: true,
            bindIdentityFromField: 'customer_email',
          },
          {
            path: '/kb',
            viewRef: 'helpdesk_kb_article.list.published',
          },
        ],
        defaultRateLimit: { rule: '100/hour/ip', scope: 'ip' },
      },
    });
    expect(portal.anonymousEntry?.routes).toHaveLength(2);
    expect(portal.anonymousEntry?.routes[0].captcha).toBe(true);
  });

  it('rejects an invalid routePrefix', () => {
    expect(() =>
      definePortal({
        kind: 'portal',
        id: 'bad',
        label: 'bad',
        routePrefix: 'no-leading-slash',
        positions: ['x'],
        navigation: [{ id: 'a', type: 'view', label: 'A', viewRef: 'x.y' }],
      }),
    ).toThrow();
  });

  it('rejects an empty positions array', () => {
    expect(() =>
      definePortal({
        kind: 'portal',
        id: 'bad',
        label: 'bad',
        routePrefix: '/x',
        positions: [],
        navigation: [{ id: 'a', type: 'view', label: 'A', viewRef: 'x.y' }],
      }),
    ).toThrow();
  });

  it('rejects the removed `profiles` key with the FROM → TO prescription (ADR-0090 D2)', () => {
    expect(() =>
      definePortal({
        kind: 'portal',
        id: 'bad',
        label: 'bad',
        routePrefix: '/x',
        profiles: ['client_portal_user'],
        navigation: [{ id: 'a', type: 'view', label: 'A', viewRef: 'x.y' }],
      } as never),
    ).toThrow(/profiles.*removed.*ADR-0090 D2[\s\S]*positions/);
  });

  it('accepts SSO and custom plugin layouts', () => {
    const portal = definePortal({
      kind: 'portal',
      id: 'enterprise',
      label: 'Enterprise',
      routePrefix: '/portal/enterprise',
      authMode: 'sso:azure-ad',
      layout: 'custom:my-plugin/dashboard',
      positions: ['enterprise_user'],
      navigation: [
        { id: 'home', type: 'dashboard', label: 'Home', dashboardName: 'enterprise_home' },
      ],
    });
    expect(portal.authMode).toBe('sso:azure-ad');
    expect(portal.layout).toBe('custom:my-plugin/dashboard');
  });

  it('rejects malformed SSO mode', () => {
    expect(() =>
      PortalSchema.parse({
        kind: 'portal',
        id: 'x',
        label: 'x',
        routePrefix: '/x',
        authMode: 'sso:',
        positions: ['x'],
        navigation: [{ id: 'a', type: 'view', label: 'A', viewRef: 'x.y' }],
      }),
    ).toThrow();
  });
});
