// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineView } from '@objectstack/spec/ui';

/**
 * Product Views
 *
 *   • grid    — catalog listing with stock indicators
 *   • gallery — visual product catalog (image_url as cover)
 */
export const ProductViews = defineView({
  list: {
    type: 'grid',
    name: 'all_products',
    label: 'All Products',
    data: { provider: 'object', object: 'product' },
    columns: [
      { field: 'product_code', width: 140, link: true, pinned: 'left' },
      { field: 'name', width: 240, sortable: true },
      { field: 'category', width: 140 },
      { field: 'family', width: 140 },
      { field: 'sku', width: 140 },
      { field: 'list_price', width: 130, align: 'right', summary: 'avg' },
      { field: 'cost', width: 130, align: 'right' },
      { field: 'quantity_on_hand', width: 140, align: 'right', summary: 'sum' },
      { field: 'reorder_point', width: 130, align: 'right' },
      { field: 'is_active', width: 100, align: 'center' },
    ],
    sort: [{ field: 'name', order: 'asc' }],
    grouping: { fields: [{ field: 'category', order: 'asc' }] },
    pagination: { pageSize: 50 },
    selection: { type: 'multiple' },
    appearance: {
      allowedVisualizations: ['grid', 'gallery'],
    },
    tabs: [
      { name: 'all', label: 'All', view: 'all_products', isDefault: true, pinned: true },
      { name: 'catalog', label: 'Catalog', icon: 'gallery-thumbnails', view: 'product_catalog' },
      { name: 'low_stock', label: 'Low Stock', icon: 'triangle-alert', view: 'low_stock' },
    ],
  },

  listViews: {
    /** Visual catalog */
    product_catalog: {
      name: 'product_catalog',
      type: 'gallery',
      label: 'Product Catalog',
      data: { provider: 'object', object: 'product' },
      columns: ['name', 'category', 'list_price'],
      gallery: {
        coverField: 'image',
        coverFit: 'cover',
        cardSize: 'medium',
        titleField: 'name',
        visibleFields: ['product_code', 'category', 'family', 'list_price', 'quantity_on_hand'],
      },
    },

    /** Low-stock review */
    low_stock: {
      name: 'low_stock',
      type: 'grid',
      label: 'Low Stock',
      data: { provider: 'object', object: 'product' },
      columns: ['product_code', 'name', 'quantity_on_hand', 'reorder_point', 'product_manager'],
      filter: [{ field: 'quantity_on_hand', operator: 'less_than_or_equal', value: 10 }],
      sort: [{ field: 'quantity_on_hand', order: 'asc' }],
      rowColor: { field: 'is_active', colors: { true: '#dc2626' } },
    },
  },

  form: {
    type: 'simple',
    data: { provider: 'object', object: 'product' },
    sections: [
      {
        label: 'Product Info',
        columns: 2,
        fields: [
          'product_code',
          { field: 'name', required: true, colSpan: 2 },
          'category',
          'family',
          'sku',
          'product_manager',
          'is_active',
          'is_taxable',
        ],
      },
      {
        label: 'Pricing & Inventory',
        columns: 2,
        fields: ['list_price', 'cost', 'quantity_on_hand', 'reorder_point'],
      },
      {
        label: 'Media',
        columns: 1,
        fields: ['image', 'datasheet', 'description'],
      },
    ],
  },
});
