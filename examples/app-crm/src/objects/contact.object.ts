// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';
import { cel } from '@objectstack/spec';

export const Contact = ObjectSchema.create({
  name: 'crm_contact',
  // [ADR-0090 D1] Explicit grandfather stamp: record isolation for this demo
  // object is intentionally org-shared; without this the new secure default
  // (unset OWD => private) would owner-filter it, and the D7 publish linter
  // (security-owd-unset) fails the build on an undeclared baseline.
  sharingModel: 'public_read_write',
  label: 'Contact',
  pluralLabel: 'Contacts',
  icon: 'user',
  description: 'A person associated with an account.',

  fields: {
    first_name: Field.text({
      label: 'First Name',
      maxLength: 80,
    }),
    last_name: Field.text({
      label: 'Last Name',
      required: true,
      searchable: true,
      maxLength: 80,
    }),
    full_name: Field.formula({
      label: 'Full Name',
      expression: cel`(record.first_name == null ? '' : record.first_name + ' ') + record.last_name`,
    }),
    email: Field.email({
      label: 'Email',
      searchable: true,
    }),
    account: Field.lookup('crm_account', {
      label: 'Account',
    }),
  },
});
