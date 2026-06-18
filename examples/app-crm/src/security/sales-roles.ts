// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type * as Identity from '@objectstack/spec/identity';
import type * as Security from '@objectstack/spec/security';

/**
 * Example roles — a small sales hierarchy.
 */
export const SalesRepRole: Identity.RoleInput = {
  name: 'sales_rep',
  label: 'Sales Representative',
  description: 'Front-line sales representative.',
};

export const SalesManagerRole: Identity.RoleInput = {
  name: 'sales_manager',
  label: 'Sales Manager',
  description: 'Manages a team of sales reps.',
  parent: 'sales_rep',
};

/** Referenced by the Discount Approval second step. */
export const FinanceApproverRole: Identity.RoleInput = {
  name: 'finance_approver',
  label: 'Finance Approver',
  description: 'Finance team member authorised to approve discounts above 30%.',
};

/**
 * Example permission set — base permissions on CRM objects for sales users.
 *
 * Note: `objects` is a Record keyed by object name, not an array.
 */
export const SalesUserPermissionSet: Security.PermissionSetInput = {
  name: 'crm_sales_user',
  label: 'CRM Sales User',
  isProfile: false,
  objects: {
    crm_account:     { allowRead: true, allowCreate: true,  allowEdit: true,  allowDelete: false },
    crm_contact:     { allowRead: true, allowCreate: true,  allowEdit: true,  allowDelete: false },
    crm_opportunity: { allowRead: true, allowCreate: true,  allowEdit: true,  allowDelete: false },
    crm_lead:        { allowRead: true, allowCreate: true,  allowEdit: true,  allowDelete: false },
    crm_activity:    { allowRead: true, allowCreate: true,  allowEdit: true,  allowDelete: false },
  },
};

/**
 * Guest profile for the public Web-to-Lead form (lead.view.ts `web_to_lead`).
 *
 * Applied to anonymous (unauthenticated) visitors who POST the public form. The
 * anonymous permission path checks the FULL object name, so this MUST key
 * `crm_lead` (not a short `lead`). INSERT-only — guests can never read, edit, or
 * delete any record.
 */
export const GuestPortalProfile: Security.PermissionSetInput = {
  name: 'guest_portal',
  label: 'Guest (Public Forms)',
  isProfile: true,
  objects: {
    crm_lead: { allowRead: false, allowCreate: true, allowEdit: false, allowDelete: false },
  },
};
