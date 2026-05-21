// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * user_app_state — Per-user UI app state (set by @object-ui).
 *
 * Backs the `@object-ui/app-shell` "persistent user state" hook that
 * stores per-user, per-kind blobs of UI state (e.g. column widths,
 * sidebar collapsed/expanded, last-opened tab) so the Console / any
 * @object-ui surface can remember where the user left off.
 *
 * Contract (consumed by `@object-ui/app-shell` and friends):
 *   - load(): `find('user_app_state', { filter: { user_id, kind }, limit: 1 })`
 *   - save(): `create({ user_id, kind, payload, updated_at })` or
 *             `update(id, { payload, updated_at })`
 *
 * The object name is intentionally unprefixed (`user_app_state`, not
 * `sys_user_app_state`) because `@object-ui` hard-codes the resource
 * name as a default; renaming would require every consumer to pass an
 * explicit `resource` override.
 *
 * This is a *system* object — registered automatically with every
 * environment by `@objectstack/platform-objects` so the Console works
 * out of the box on a fresh env without the user having to install
 * anything. Per-user RLS is enforced by the standard owner-row policy
 * (`user_id` must equal the calling session's user id) — added in a
 * follow-up commit once the policy is finalised.
 */
export const UserAppState = ObjectSchema.create({
  name: 'user_app_state',
  label: 'User App State',
  pluralLabel: 'User App State',
  icon: 'settings',
  isSystem: true,
  managedBy: 'system',
  description: 'Per-user UI app state blobs (set by @object-ui app-shell).',
  titleFormat: '{kind}',
  compactLayout: ['user_id', 'kind'],

  fields: {
    id: Field.text({
      label: 'State ID',
      required: true,
      readonly: true,
    }),

    created_at: Field.datetime({
      label: 'Created At',
      defaultValue: 'NOW()',
      readonly: true,
    }),

    updated_at: Field.datetime({
      label: 'Updated At',
      defaultValue: 'NOW()',
      readonly: true,
    }),

    user_id: Field.lookup('sys_user', {
      label: 'User',
      required: true,
      description: 'Owner user of this app-state blob.',
    }),

    kind: Field.text({
      label: 'Kind',
      required: true,
      maxLength: 255,
      description: 'State discriminator (e.g. grid-state:account, sidebar).',
    }),

    payload: Field.json({
      label: 'Payload',
      description: 'Arbitrary JSON payload — the saved UI state blob.',
    }),
  },

  indexes: [
    { fields: ['user_id', 'kind'], unique: true },
    { fields: ['user_id'], unique: false },
  ],

  enable: {
    trackHistory: false,
    searchable: false,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update', 'delete'],
    trash: false,
    mru: false,
  },
});
