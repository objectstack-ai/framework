// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Guest Portal Profile
 *
 * Permission set applied to anonymous (unauthenticated) visitors who submit
 * the public Web-to-Lead and Web-to-Case forms.
 *
 * IRON-CLAD RULE: guests must NEVER be able to read existing CRM data.
 * The only thing they can do is INSERT a new `lead` or `case` row through
 * the form views whose `sharing.allowAnonymous = true`.
 *
 * Any new object added to the CRM stack is implicitly DENIED for guests —
 * profile permissions are explicit-allow only.
 */
export const GuestPortalProfile = {
  name: 'guest_portal',
  label: 'Guest (Public Forms)',
  isProfile: true,
  description:
    'Anonymous visitors submitting public Web-to-Lead / Web-to-Case forms. ' +
    'INSERT-only on lead and case; no read/edit/delete on any object.',
  objects: {
    lead: {
      allowCreate: true,
      allowRead: false,
      allowEdit: false,
      allowDelete: false,
      viewAllRecords: false,
      modifyAllRecords: false,
    },
    case: {
      allowCreate: true,
      allowRead: false,
      allowEdit: false,
      allowDelete: false,
      viewAllRecords: false,
      modifyAllRecords: false,
    },
  },
};
