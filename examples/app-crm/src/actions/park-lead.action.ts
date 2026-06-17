// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { UI } from '@objectstack/spec';

/**
 * Row-level action on crm_lead — reassign the lead's owner.
 *
 * Demonstrates the `undoable` action affordance: it's a single-record field
 * update (`assigned_to`), so the runtime captures the prior owner and the
 * success toast offers an "Undo" that restores it (backed by the client
 * UndoManager — Ctrl+Z works too). Prompts for the new owner via one param
 * (pre-filled with "Triage Queue").
 */
export const ParkLeadAction: UI.Action = {
  name: 'crm_park_lead',
  label: 'Reassign Lead',
  description: 'Reassign this lead to a new owner (undoable).',
  icon: 'UserPlus',
  objectName: 'crm_lead',
  // `type: 'api'` with a non-URL target routes to the console runtime's generic
  // `dataSource.update` path (the row id comes from the list_item row record).
  type: 'api',
  target: 'crm_lead',
  // List-row only: the apiHandler needs the row record (to capture prior values
  // for Undo), and the list runtime drives param collection + the Undo toast.
  locations: ['list_item'],
  // Conditional disable (CEL): a converted lead is locked — the row-menu item
  // shows but greys out, rather than disappearing. Demonstrates `disabled`
  // (greys) vs `visible` (hides). Row-menu predicates resolve against the row's
  // fields directly (bare `status`, not `record.status`).
  disabled: 'status == "converted"',
  params: [
    { field: 'assigned_to', label: 'Reassign to', defaultValue: 'Triage Queue', required: true },
  ],
  undoable: true,
  successMessage: 'Lead reassigned.',
};
