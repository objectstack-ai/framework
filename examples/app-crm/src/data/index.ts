// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * CRM Seed Data
 *
 * Demo records for all core CRM objects.
 * Uses defineDataset() for type-safe field name checking at compile time.
 */
import { defineDataset } from '@objectstack/spec/data';
import { Account } from '../objects/account.object';
import { Contact } from '../objects/contact.object';
import { Lead } from '../objects/lead.object';
import { Opportunity } from '../objects/opportunity.object';
import { Product } from '../objects/product.object';
import { Task } from '../objects/task.object';
import { Case } from '../objects/case.object';

// ─── Accounts ─────────────────────────────────────────────────────────
const accounts = defineDataset(Account, {
  mode: 'upsert',
  externalId: 'name',
  records: [
    {
      name: 'Acme Corporation',
      type: 'customer',
      industry: 'technology',
      annual_revenue: 5000000,
      number_of_employees: 250,
      phone: '+1-415-555-0100',
      website: 'https://acme.example.com',
    },
    {
      name: 'Globex Industries',
      type: 'prospect',
      industry: 'manufacturing',
      annual_revenue: 12000000,
      number_of_employees: 800,
      phone: '+1-312-555-0200',
      website: 'https://globex.example.com',
    },
    {
      name: 'Initech Solutions',
      type: 'customer',
      industry: 'finance',
      annual_revenue: 3500000,
      number_of_employees: 150,
      phone: '+1-212-555-0300',
      website: 'https://initech.example.com',
    },
    {
      name: 'Stark Medical',
      type: 'partner',
      industry: 'healthcare',
      annual_revenue: 8000000,
      number_of_employees: 400,
      phone: '+1-617-555-0400',
      website: 'https://starkmed.example.com',
    },
    {
      name: 'Wayne Enterprises',
      type: 'customer',
      industry: 'technology',
      annual_revenue: 25000000,
      number_of_employees: 2000,
      phone: '+1-650-555-0500',
      website: 'https://wayne.example.com',
    },
  ]
});

// ─── Contacts ─────────────────────────────────────────────────────────
const contacts = defineDataset(Contact, {
  mode: 'upsert',
  externalId: 'email',
  records: [
    {
      salutation: 'mr',
      first_name: 'John',
      last_name: 'Smith',
      email: 'john.smith@acme.example.com',
      phone: '+1-415-555-0101',
      title: 'VP of Engineering',
      department: 'Engineering',
      account: 'Acme Corporation',
    },
    {
      salutation: 'ms',
      first_name: 'Sarah',
      last_name: 'Johnson',
      email: 'sarah.j@globex.example.com',
      phone: '+1-312-555-0201',
      title: 'Chief Procurement Officer',
      department: 'Executive',
      account: 'Globex Industries',
    },
    {
      salutation: 'dr',
      first_name: 'Michael',
      last_name: 'Chen',
      email: 'mchen@initech.example.com',
      phone: '+1-212-555-0301',
      title: 'Director of Operations',
      department: 'Operations',
      account: 'Initech Solutions',
    },
    {
      salutation: 'ms',
      first_name: 'Emily',
      last_name: 'Davis',
      email: 'emily.d@starkmed.example.com',
      phone: '+1-617-555-0401',
      title: 'Head of Partnerships',
      department: 'Sales',
      account: 'Stark Medical',
    },
    {
      salutation: 'mr',
      first_name: 'Robert',
      last_name: 'Wilson',
      email: 'rwilson@wayne.example.com',
      phone: '+1-650-555-0501',
      title: 'CTO',
      department: 'Engineering',
      account: 'Wayne Enterprises',
    },
  ]
});

// ─── Leads ────────────────────────────────────────────────────────────
const leads = defineDataset(Lead, {
  mode: 'upsert',
  externalId: 'email',
  records: [
    {
      first_name: 'Alice',
      last_name: 'Martinez',
      company: 'NextGen Retail',
      email: 'alice@nextgenretail.example.com',
      phone: '+1-503-555-0600',
      status: 'new',
      lead_source: 'web',
      industry: 'retail',
    },
    {
      first_name: 'David',
      last_name: 'Kim',
      company: 'EduTech Labs',
      email: 'dkim@edutechlabs.example.com',
      phone: '+1-408-555-0700',
      status: 'contacted',
      lead_source: 'referral',
      industry: 'education',
    },
    {
      first_name: 'Lisa',
      last_name: 'Thompson',
      company: 'CloudFirst Inc',
      email: 'lisa.t@cloudfirst.example.com',
      phone: '+1-206-555-0800',
      status: 'qualified',
      lead_source: 'event',
      industry: 'technology',
    },
  ]
});

// ─── Opportunities ────────────────────────────────────────────────────
const opportunities = defineDataset(Opportunity, {
  mode: 'upsert',
  externalId: 'name',
  records: [
    {
      name: 'Acme Platform Upgrade',
      account: 'Acme Corporation',
      amount: 150000,
      stage: 'proposal',
      probability: 60,
      close_date: new Date(Date.now() + 86400000 * 30),
      type: 'existing_business',
      forecast_category: 'pipeline',
    },
    {
      name: 'Globex Manufacturing Suite',
      account: 'Globex Industries',
      amount: 500000,
      stage: 'qualification',
      probability: 30,
      close_date: new Date(Date.now() + 86400000 * 60),
      type: 'new_business',
      forecast_category: 'pipeline',
    },
    {
      name: 'Wayne Enterprise License',
      account: 'Wayne Enterprises',
      amount: 1200000,
      stage: 'negotiation',
      probability: 75,
      close_date: new Date(Date.now() + 86400000 * 14),
      type: 'new_business',
      forecast_category: 'commit',
    },
    {
      name: 'Initech Cloud Migration',
      account: 'Initech Solutions',
      amount: 80000,
      stage: 'needs_analysis',
      probability: 25,
      close_date: new Date(Date.now() + 86400000 * 45),
      type: 'existing_business',
      forecast_category: 'best_case',
    },
  ]
});

// ─── Products ─────────────────────────────────────────────────────────
const products = defineDataset(Product, {
  mode: 'upsert',
  externalId: 'name',
  records: [
    {
      name: 'ObjectStack Platform',
      category: 'software',
      family: 'enterprise',
      list_price: 50000,
      is_active: true,
    },
    {
      name: 'Cloud Hosting (Annual)',
      category: 'subscription',
      family: 'cloud',
      list_price: 12000,
      is_active: true,
    },
    {
      name: 'Premium Support',
      category: 'support',
      family: 'services',
      list_price: 25000,
      is_active: true,
    },
    {
      name: 'Implementation Services',
      category: 'service',
      family: 'services',
      list_price: 75000,
      is_active: true,
    },
  ]
});

// ─── Tasks ────────────────────────────────────────────────────────────
const tasks = defineDataset(Task, {
  mode: 'upsert',
  externalId: 'subject',
  records: [
    {
      subject: 'Follow up with Acme on proposal',
      status: 'not_started',
      priority: 'high',
      due_date: new Date(Date.now() + 86400000 * 2),
    },
    {
      subject: 'Schedule demo for Globex team',
      status: 'in_progress',
      priority: 'normal',
      due_date: new Date(Date.now() + 86400000 * 5),
    },
    {
      subject: 'Prepare contract for Wayne Enterprises',
      status: 'not_started',
      priority: 'urgent',
      due_date: new Date(Date.now() + 86400000),
    },
    {
      subject: 'Send welcome package to Stark Medical',
      status: 'completed',
      priority: 'low',
    },
    {
      subject: 'Update CRM pipeline report',
      status: 'not_started',
      priority: 'normal',
      due_date: new Date(Date.now() + 86400000 * 7),
    },
  ]
});

// ─── Cases ────────────────────────────────────────────────────────────
const cases = defineDataset(Case, {
  mode: 'upsert',
  externalId: 'subject',
  records: [
    {
      subject: 'Login issues after platform upgrade',
      description: 'Users unable to log in after the v4.2 upgrade.',
      account: 'Acme Corporation',
      contact: 'john.smith@acme.example.com',
      status: 'in_progress',
      priority: 'high',
      type: 'problem',
      origin: 'email',
      is_closed: false,
      is_sla_violated: false,
      is_escalated: false,
      created_date: new Date(Date.now() - 86400000 * 2),
    },
    {
      subject: 'Data export timing out for large datasets',
      description: 'CSV export fails for datasets over 10k rows.',
      account: 'Globex Industries',
      contact: 'sarah.j@globex.example.com',
      status: 'escalated',
      priority: 'critical',
      type: 'bug',
      origin: 'phone',
      is_closed: false,
      is_sla_violated: true,
      is_escalated: true,
      escalation_reason: 'Customer threatening churn',
      created_date: new Date(Date.now() - 86400000 * 5),
    },
    {
      subject: 'How to configure SSO with Okta?',
      description: 'Customer needs guidance on SSO setup with Okta.',
      account: 'Initech Solutions',
      contact: 'mchen@initech.example.com',
      status: 'resolved',
      priority: 'medium',
      type: 'question',
      origin: 'web',
      is_closed: false,
      is_sla_violated: false,
      is_escalated: false,
      resolution_time_hours: 4.5,
      created_date: new Date(Date.now() - 86400000 * 3),
    },
    {
      subject: 'API rate limit exceeded on production',
      description: 'Production environment hitting rate limits during peak hours.',
      account: 'Wayne Enterprises',
      contact: 'rwilson@wayne.example.com',
      status: 'closed',
      priority: 'high',
      type: 'problem',
      origin: 'chat',
      is_closed: true,
      is_sla_violated: false,
      is_escalated: false,
      resolution_time_hours: 2.0,
      created_date: new Date(Date.now() - 86400000 * 7),
      closed_date: new Date(Date.now() - 86400000 * 6),
    },
    {
      subject: 'PDF reports not rendering charts correctly',
      description: 'Charts appear blank when exporting dashboard to PDF.',
      account: 'Stark Medical',
      contact: 'emily.d@starkmed.example.com',
      status: 'new',
      priority: 'medium',
      type: 'bug',
      origin: 'email',
      is_closed: false,
      is_sla_violated: false,
      is_escalated: false,
      created_date: new Date(Date.now() - 86400000),
    },
    {
      subject: 'Billing discrepancy on last invoice',
      description: 'Customer billed for 15 seats but only uses 12.',
      account: 'Acme Corporation',
      contact: 'john.smith@acme.example.com',
      status: 'waiting_customer',
      priority: 'low',
      type: 'problem',
      origin: 'email',
      is_closed: false,
      is_sla_violated: false,
      is_escalated: false,
      created_date: new Date(Date.now() - 86400000 * 4),
    },
    {
      subject: 'Mobile app crashes on iOS 17',
      description: 'App crashes on launch for users running iOS 17.2+.',
      account: 'Globex Industries',
      contact: 'sarah.j@globex.example.com',
      status: 'in_progress',
      priority: 'critical',
      type: 'bug',
      origin: 'web',
      is_closed: false,
      is_sla_violated: true,
      is_escalated: true,
      escalation_reason: 'Affects 30% of mobile users',
      created_date: new Date(Date.now() - 86400000 * 3),
    },
    {
      subject: 'Request: bulk import via CSV',
      description: 'Customer requesting ability to import records via CSV upload.',
      account: 'Wayne Enterprises',
      contact: 'rwilson@wayne.example.com',
      status: 'closed',
      priority: 'low',
      type: 'feature_request',
      origin: 'web',
      is_closed: true,
      is_sla_violated: false,
      is_escalated: false,
      resolution_time_hours: 8.0,
      created_date: new Date(Date.now() - 86400000 * 10),
      closed_date: new Date(Date.now() - 86400000 * 8),
    },
  ],
});

/** All CRM seed datasets */
export const CrmSeedData = [
  accounts,
  contacts,
  leads,
  opportunities,
  products,
  tasks,
  cases,
];
