// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * Invoice + Invoice Line — the canonical master-detail "header + line items"
 * shape. Unlike project↔task (a task is added to a project over time), an
 * invoice is meaningless without its lines: you enter the header AND its lines
 * together, in one atomic transaction. So `invoice_line.invoice` declares
 * `inlineEdit: 'grid'` — every standard New/Edit Invoice form renders an
 * editable line-item grid, and the invoice `total` rolls the line amounts up
 * server-side. This is where inline master-detail entry belongs.
 */
export const Invoice = ObjectSchema.create({
  name: 'showcase_invoice',
  label: 'Invoice',
  pluralLabel: 'Invoices',
  icon: 'receipt',
  description: 'A customer invoice entered together with its line items.',

  fields: {
    name: Field.text({ label: 'Invoice Number', required: true, searchable: true, maxLength: 60 }),
    account: Field.lookup('showcase_account', { label: 'Account', required: true }),
    status: Field.select({
      label: 'Status',
      required: true,
      options: [
        { label: 'Draft', value: 'draft', default: true, color: '#94A3B8' },
        { label: 'Sent', value: 'sent', color: '#3B82F6' },
        { label: 'Paid', value: 'paid', color: '#10B981' },
        { label: 'Void', value: 'void', color: '#EF4444' },
      ],
    }),
    issued_on: Field.date({ label: 'Issued On' }),
    // Roll-up: recomputed server-side as line items are inserted/updated/deleted
    // (child FK auto-detected: showcase_invoice_line.invoice).
    total: Field.summary({
      label: 'Total',
      summaryOperations: { object: 'showcase_invoice_line', field: 'amount', function: 'sum' },
    }),
  },
});

/** Invoice line item — owned by its invoice, entered inline in the grid. */
export const InvoiceLine = ObjectSchema.create({
  name: 'showcase_invoice_line',
  label: 'Invoice Line',
  pluralLabel: 'Invoice Lines',
  icon: 'list',
  description: 'A single billable line on an invoice.',

  fields: {
    invoice: Field.masterDetail('showcase_invoice', {
      label: 'Invoice',
      required: true,
      deleteBehavior: 'cascade',
      // Thin, high-volume line items → the editable grid form factor.
      inlineEdit: 'grid',
      inlineTitle: 'Line Items',
    }),
    product: Field.text({ label: 'Product', required: true, maxLength: 200 }),
    quantity: Field.number({ label: 'Qty', required: true, min: 0, defaultValue: 1 }),
    unit_price: Field.currency({ label: 'Unit Price', scale: 2, min: 0 }),
    amount: Field.currency({ label: 'Amount', scale: 2, min: 0 }),
  },
});
