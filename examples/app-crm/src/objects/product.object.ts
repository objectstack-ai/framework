// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * Product Object
 * Represents products/services offered by the company
 */
export const Product = ObjectSchema.create({
  name: 'product',
  label: 'Product',
  pluralLabel: 'Products',
  icon: 'box',
  description: 'Products and services offered by the company',
  titleFormat: '{product_code} - {name}',
  compactLayout: ['product_code', 'name', 'category', 'is_active'],
  
  fields: {
    // AutoNumber field - Unique product identifier
    product_code: Field.autonumber({
      label: 'Product Code',
      format: 'PRD-{0000}',
    }),
    
    // Basic Information
    name: Field.text({ 
      label: 'Product Name', 
      required: true, 
      searchable: true,
      maxLength: 255,
    }),
    
    description: Field.markdown({
      label: 'Description',
    }),
    
    // Categorization
    category: Field.select({
      label: 'Category',
      options: [
        { label: 'Software', value: 'software', default: true },
        { label: 'Hardware', value: 'hardware' },
        { label: 'Service', value: 'service' },
        { label: 'Subscription', value: 'subscription' },
        { label: 'Support', value: 'support' },
      ]
    }),
    
    family: Field.select({
      label: 'Product Family',
      options: [
        { label: 'Enterprise Solutions', value: 'enterprise' },
        { label: 'SMB Solutions', value: 'smb' },
        { label: 'Professional Services', value: 'services' },
        { label: 'Cloud Services', value: 'cloud' },
      ]
    }),
    
    // Pricing
    list_price: Field.currency({ 
      label: 'List Price',
      scale: 2,
      min: 0,
      required: true,
    }),
    
    cost: Field.currency({ 
      label: 'Cost',
      scale: 2,
      min: 0,
    }),
    
    // SKU and Inventory
    sku: Field.text({
      label: 'SKU',
      maxLength: 50,
      unique: true,
    }),
    
    quantity_on_hand: Field.number({
      label: 'Quantity on Hand',
      min: 0,
      defaultValue: 0,
    }),
    
    reorder_point: Field.number({
      label: 'Reorder Point',
      min: 0,
    }),
    
    // Status
    is_active: Field.boolean({
      label: 'Active',
      defaultValue: true,
    }),
    
    is_taxable: Field.boolean({
      label: 'Taxable',
      defaultValue: true,
    }),
    
    // Relationships
    product_manager: Field.lookup('user', {
      label: 'Product Manager',
    }),
    
    // Images and Assets
    image_url: Field.url({
      label: 'Product Image',
    }),
    
    datasheet_url: Field.url({
      label: 'Datasheet URL',
    }),
  },
  
  // Database indexes
  indexes: [
    { fields: ['name'], type: 'btree' },
    { fields: ['sku'], type: 'btree', unique: true },
    { fields: ['category'], type: 'btree' },
    { fields: ['is_active'], type: 'btree' },
  ],
  
  // Enable advanced features
  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update', 'delete', 'search'],
    files: true,
    feeds: true,
    trash: true,
    mru: true,
  },
  
  // Validation Rules
  validations: [
    {
      name: 'price_positive',
      type: 'script',
      severity: 'error',
      message: 'List Price must be positive',
      condition: 'list_price < 0',
    },
    {
      name: 'cost_less_than_price',
      type: 'script',
      severity: 'warning',
      message: 'Cost should be less than List Price',
      condition: 'cost >= list_price',
    },
  ],
});
