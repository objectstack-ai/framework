// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Semantic-role zoo — runtime regression fixtures for the ADR-0085 object
 * semantic roles (`highlightFields` / `stageField` / `fieldGroups.collapse`),
 * in the spirit of `showcase_field_zoo` (#2005): the roles are only
 * *static*-checked by the spec suite; these two objects prove the SERVED
 * pipeline (defineStack → artifact → register → REST serialization) neither
 * strips nor mangles them. Guarded by
 * `packages/dogfood/test/semantic-roles.dogfood.test.ts`.
 *
 * Two objects, two role postures:
 *  - `SemanticZoo` authors the full canonical role set (highlightFields,
 *    stageField: 'status', collapse enum).
 *  - `SemanticZooLegacy` carries `stageField: false` — `false` must survive
 *    serialization strictly (it is the only "stop guessing" signal; a
 *    falsy-check regression turns the stepper back on). It exercised the
 *    deprecated `compactLayout` alias during the ADR-0085 window; the alias
 *    was retired by framework#2536.
 */
import { ObjectSchema, Field } from '@objectstack/spec/data';

export const SemanticZoo = ObjectSchema.create({
  name: 'showcase_semantic_zoo',
  label: 'Semantic Zoo',
  pluralLabel: 'Semantic Zoos',
  icon: 'flask-conical',
  description: 'ADR-0085 semantic-role runtime fixture (canonical spellings)',

  fields: {
    name: Field.text({ label: 'Name', required: true }),
    status: Field.select({
      label: 'Status',
      options: [
        { label: 'Draft', value: 'draft', default: true },
        { label: 'Active', value: 'active' },
        { label: 'Done', value: 'done' },
      ],
      group: 'basics',
    }),
    amount: Field.number({ label: 'Amount', group: 'money' }),
    notes: Field.textarea({ label: 'Notes' }),
  },

  highlightFields: ['name', 'status', 'amount'],
  stageField: 'status',
  fieldGroups: [
    { key: 'basics', label: 'Basics' },
    { key: 'money', label: 'Money', collapse: 'collapsed' },
  ],
});

export const SemanticZooLegacy = ObjectSchema.create({
  name: 'showcase_semantic_zoo_legacy',
  label: 'Semantic Zoo (Legacy)',
  pluralLabel: 'Semantic Zoo Legacies',
  icon: 'flask-round',
  description: 'ADR-0085 semantic-role runtime fixture (stageField:false suppression)',

  fields: {
    name: Field.text({ label: 'Name', required: true }),
    // Named `status` ON PURPOSE: the stepper heuristic would pick it up —
    // `stageField: false` below is what keeps it suppressed.
    status: Field.select({
      label: 'Status',
      options: [
        { label: 'Red', value: 'red', default: true },
        { label: 'Green', value: 'green' },
      ],
    }),
    amount: Field.number({ label: 'Amount' }),
  },

  // (This fixture authored the deprecated `compactLayout` spelling during the
  // ADR-0085 alias window; retired by framework#2536.)
  highlightFields: ['name', 'amount'],
  // This status is a color, not a lifecycle.
  stageField: false,
});
