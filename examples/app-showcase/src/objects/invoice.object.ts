// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * Product — a small price-book / catalog. The invoice line's `product` lookup
 * points here; selecting a product auto-fills the line's `description` and
 * `unit_price` (the line-item grid copies matching field names from the chosen
 * record — the catalog typeahead every invoicing tool has: QuickBooks
 * "Product/Service", Stripe price catalog, NetSuite item column).
 */
export const Product = ObjectSchema.create({
  name: 'showcase_product',
  label: 'Product',
  pluralLabel: 'Products',
  icon: 'package',
  description: 'A sellable product with a catalog price.',

  fields: {
    name: Field.text({ label: 'Name', required: true, searchable: true, maxLength: 120 }),
    sku: Field.text({ label: 'SKU', searchable: true, maxLength: 40 }),
    description: Field.text({ label: 'Description', maxLength: 200 }),
    unit_price: Field.currency({ label: 'Unit Price', scale: 2, min: 0 }),
    active: Field.boolean({ label: 'Active', defaultValue: true }),
  },
});

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
    // Header tax rate (percent). The line-item entry form reads it live to show
    // a Subtotal / Tax / Total stack under the grid as lines are entered.
    tax_rate: Field.number({ label: 'Tax Rate (%)', min: 0, max: 100, defaultValue: 0 }),
    // Roll-up: recomputed server-side as line items are inserted/updated/deleted
    // (child FK auto-detected: showcase_invoice_line.invoice). This is the line
    // subtotal; the tax-inclusive grand total is shown live during entry.
    total: Field.summary({
      label: 'Subtotal',
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
    // Catalog lookup. Picking a product auto-fills `description` + `unit_price`
    // (the grid copies same-named fields from the selected product record).
    product: Field.lookup('showcase_product', { label: 'Product', required: true }),
    description: Field.text({ label: 'Description', maxLength: 200 }),
    quantity: Field.number({ label: 'Qty', required: true, min: 0, defaultValue: 1 }),
    unit_price: Field.currency({ label: 'Unit Price', scale: 2, min: 0 }),
    // Amount = Qty × Unit Price. Kept as a *stored* currency column (so the
    // parent Invoice.total summary can roll it up — summary aggregation reads
    // stored columns, not on-read formula fields), but the `expression` makes
    // the line-item grid render it READ-ONLY and recompute it live client-side
    // as quantity/unit_price change, then persist the computed value. The
    // server does not treat a non-`formula` field's expression as computed, so
    // the client-sent value is stored as-is.
    amount: Field.currency({
      label: 'Amount',
      scale: 2,
      min: 0,
      expression: 'record.quantity * record.unit_price',
    }),
  },
});
