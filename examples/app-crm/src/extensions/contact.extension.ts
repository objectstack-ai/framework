// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineObjectExtension } from '@objectstack/spec/data';

/**
 * Extends the built-in crm_contact object with social-media fields.
 * Demonstrates ObjectExtension — additive fields without re-declaring the
 * whole object schema.
 */
export const ContactExtension = defineObjectExtension({
  extend: 'crm_contact',
  label: 'Contact (CRM Extended)',
  fields: {
    linkedin_url: {
      name: 'linkedin_url',
      label: 'LinkedIn URL',
      type: 'url',
    },
    twitter_handle: {
      name: 'twitter_handle',
      label: 'Twitter / X Handle',
      type: 'text',
      maxLength: 64,
    },
    preferred_channel: {
      name: 'preferred_channel',
      label: 'Preferred Contact Channel',
      type: 'select',
      options: [
        { value: 'email', label: 'Email' },
        { value: 'phone', label: 'Phone' },
        { value: 'linkedin', label: 'LinkedIn' },
        { value: 'whatsapp', label: 'WhatsApp' },
      ],
    },
  },
  priority: 210,
});
