// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Policy } from '@objectstack/spec/security';

/**
 * Default CRM security policy applied to all users.
 * Enforces password complexity, session limits, and audit logging.
 */
export const CrmDefaultPolicy: Policy = {
  name: 'crm_default_policy',
  password: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: true,
    expirationDays: 90,
    historyCount: 5,
  },
  session: {
    idleTimeout: 30,
    absoluteTimeout: 480,
    forceMfa: false,
  },
  audit: {
    logRetentionDays: 365,
    sensitiveFields: ['annual_revenue', 'discount_percent'],
    captureRead: false,
  },
  isDefault: true,
};

/**
 * Strict policy for Finance Approvers — requires MFA and shorter sessions.
 */
export const CrmFinancePolicy: Policy = {
  name: 'crm_finance_policy',
  password: {
    minLength: 16,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: true,
    expirationDays: 60,
    historyCount: 10,
  },
  session: {
    idleTimeout: 15,
    absoluteTimeout: 240,
    forceMfa: true,
  },
  audit: {
    logRetentionDays: 730,
    sensitiveFields: ['amount', 'discount_percent', 'annual_revenue'],
    captureRead: true,
  },
  isDefault: false,
  assignedProfiles: ['finance_approver'],
};
