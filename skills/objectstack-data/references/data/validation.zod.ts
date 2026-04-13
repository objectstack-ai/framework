// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * # ObjectStack Validation Protocol
 * 
 * This module defines the validation schema protocol for ObjectStack, providing a comprehensive
 * type-safe validation system similar to Salesforce's validation rules but with enhanced capabilities.
 * 
 * ## Overview
 * 
 * Validation rules are applied at the data layer to ensure data integrity and enforce business logic.
 * The system supports multiple validation types:
 * 
 * 1. **Script Validation**: Formula-based validation using expressions
 * 2. **Uniqueness Validation**: Enforce unique constraints across fields
 * 3. **State Machine Validation**: Control allowed state transitions
 * 4. **Format Validation**: Validate field formats (email, URL, regex, etc.)
 * 5. **Cross-Field Validation**: Validate relationships between multiple fields
 * 6. **Async Validation**: Remote validation via API calls
 * 7. **Custom Validation**: User-defined validation functions
 * 8. **Conditional Validation**: Apply validations based on conditions
 * 
 * ## Salesforce Comparison
 * 
 * ObjectStack validation rules are inspired by Salesforce validation rules but enhanced:
 * - Salesforce: Formula-based validation with `Error Condition Formula`
 * - ObjectStack: Multiple validation types with composable rules
 * 
 * Example Salesforce validation rule:
 * ```
 * Rule Name: Discount_Cannot_Exceed_40_Percent
 * Error Condition Formula: Discount_Percent__c > 0.40
 * Error Message: Discount cannot exceed 40%.
 * ```
 * 
 * Equivalent ObjectStack rule:
 * ```typescript
 * {
 *   type: 'script',
 *   name: 'discount_cannot_exceed_40_percent',
 *   condition: 'discount_percent > 0.40',
 *   message: 'Discount cannot exceed 40%',
 *   severity: 'error'
 * }
 * ```
 */

/**
 * Base Validation Rule
 * 
 * All validation rules extend from this base schema with common properties.
 * 
 * ## Industry Standard Enhancements
 * - **Label/Description**: Essential for governance in large systems with thousands of rules.
 * - **Events**: granular control over validation timing (Context-aware validation).
 * - **Tags**: categorization for reporting and management.
 */
const BaseValidationSchema = z.object({
  // Identification
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/).describe('Unique rule name (snake_case)'),
  label: z.string().optional().describe('Human-readable label for the rule listing'),
  description: z.string().optional().describe('Administrative notes explaining the business reason'),
  
  // Execution Control
  active: z.boolean().default(true),
  events: z.array(z.enum(['insert', 'update', 'delete'])).default(['insert', 'update']).describe('Validation contexts'),
  priority: z.number().int().min(0).max(9999).default(100).describe('Execution priority (lower runs first, default: 100)'),
  
  // Classification
  tags: z.array(z.string()).optional().describe('Categorization tags (e.g., "compliance", "billing")'),
  
  // Feedback
  severity: z.enum(['error', 'warning', 'info']).default('error'),
  message: z.string().describe('Error message to display to the user'),
});

/**
 * 1. Script/Expression Validation
 * Generic formula-based validation.
 */
export const ScriptValidationSchema = BaseValidationSchema.extend({
  type: z.literal('script'),
  condition: z.string().describe('Formula expression. If TRUE, validation fails. (e.g. amount < 0)'),
});

/**
 * 2. Uniqueness Validation
 * specialized optimized check for unique constraints.
 */
export const UniquenessValidationSchema = BaseValidationSchema.extend({
  type: z.literal('unique'),
  fields: z.array(z.string()).describe('Fields that must be combined unique'),
  scope: z.string().optional().describe('Formula condition for scope (e.g. active = true)'),
  caseSensitive: z.boolean().default(true),
});

/**
 * 3. State Machine Validation
 * State transition logic.
 */
export const StateMachineValidationSchema = BaseValidationSchema.extend({
  type: z.literal('state_machine'),
  field: z.string().describe('State field (e.g. status)'),
  transitions: z.record(z.string(), z.array(z.string())).describe('Map of { OldState: [AllowedNewStates] }'),
});

/**
 * 4. Value Format Validation
 * Regex or specialized formats.
 */
export const FormatValidationSchema = BaseValidationSchema.extend({
  type: z.literal('format'),
  field: z.string(),
  regex: z.string().optional(),
  format: z.enum(['email', 'url', 'phone', 'json']).optional(),
});

/**
 * 5. Cross-Field Validation
 * Validates relationships between multiple fields.
 * 
 * ## Use Cases
 * - Date range validations (end_date > start_date)
 * - Amount comparisons (discount < total)
 * - Complex business rules involving multiple fields
 * 
 * ## Salesforce Examples
 * 
 * ### Example 1: Close Date Must Be In Current or Future Month
 * **Salesforce Formula:**
 * ```
 * MONTH(CloseDate) < MONTH(TODAY()) ||
 * YEAR(CloseDate) < YEAR(TODAY())
 * ```
 * 
 * **ObjectStack Equivalent:**
 * ```typescript
 * {
 *   type: 'cross_field',
 *   name: 'close_date_future',
 *   condition: 'MONTH(close_date) >= MONTH(TODAY()) AND YEAR(close_date) >= YEAR(TODAY())',
 *   fields: ['close_date'],
 *   message: 'Close Date must be in the current or a future month'
 * }
 * ```
 * 
 * ### Example 2: Discount Validation
 * **Salesforce Formula:**
 * ```
 * Discount__c > (Amount__c * 0.40)
 * ```
 * 
 * **ObjectStack Equivalent:**
 * ```typescript
 * {
 *   type: 'cross_field',
 *   name: 'discount_limit',
 *   condition: 'discount > (amount * 0.40)',
 *   fields: ['discount', 'amount'],
 *   message: 'Discount cannot exceed 40% of the amount'
 * }
 * ```
 * 
 * ### Example 3: Opportunity Must Have Products
 * **Salesforce Formula:**
 * ```
 * ISBLANK(Products__c) && ISPICKVAL(StageName, "Closed Won")
 * ```
 * 
 * **ObjectStack Equivalent:**
 * ```typescript
 * {
 *   type: 'cross_field',
 *   name: 'products_required_for_won',
 *   condition: 'products = null AND stage = "closed_won"',
 *   fields: ['products', 'stage'],
 *   message: 'Opportunity must have products to be marked as Closed Won'
 * }
 * ```
 */
export const CrossFieldValidationSchema = BaseValidationSchema.extend({
  type: z.literal('cross_field'),
  condition: z.string().describe('Formula expression comparing fields (e.g. "end_date > start_date")'),
  fields: z.array(z.string()).describe('Fields involved in the validation'),
});

/**
 * 6. JSON Structure Validation
 * Validates JSON fields against a JSON Schema.
 * 
 * ## Use Cases
 * - Validating configuration objects stored in JSON fields
 * - Enforcing API payload structures
 * - Complex nested data validation
 */
export const JSONValidationSchema = BaseValidationSchema.extend({
  type: z.literal('json_schema'),
  field: z.string().describe('JSON field to validate'),
  schema: z.record(z.string(), z.unknown()).describe('JSON Schema object definition'),
});

/**
 * 7. Async Validation
 * Remote validation via API call or database query.
 * 
 * ## Use Cases
 * 
 * ### 1. Email Uniqueness Check
 * Check if an email address is already registered in the system.
 * ```typescript
 * {
 *   type: 'async',
 *   name: 'unique_email',
 *   field: 'email',
 *   validatorUrl: '/api/users/check-email',
 *   message: 'This email address is already registered',
 *   debounce: 500,  // Wait 500ms after user stops typing
 *   timeout: 3000
 * }
 * ```
 * 
 * ### 2. Username Availability
 * Verify username is available before form submission.
 * ```typescript
 * {
 *   type: 'async',
 *   name: 'username_available',
 *   field: 'username',
 *   validatorUrl: '/api/users/check-username',
 *   message: 'This username is already taken',
 *   debounce: 300,
 *   timeout: 2000
 * }
 * ```
 * 
 * ### 3. Tax ID Validation
 * Validate tax ID with government API (e.g., IRS, HMRC).
 * ```typescript
 * {
 *   type: 'async',
 *   name: 'validate_tax_id',
 *   field: 'tax_id',
 *   validatorFunction: 'validateTaxIdWithIRS',
 *   message: 'Invalid Tax ID number',
 *   timeout: 10000,  // Government APIs may be slow
 *   params: { country: 'US', format: 'EIN' }
 * }
 * ```
 * 
 * ### 4. Credit Card Validation
 * Verify credit card with payment gateway without charging.
 * ```typescript
 * {
 *   type: 'async',
 *   name: 'validate_card',
 *   field: 'card_number',
 *   validatorUrl: 'https://api.stripe.com/v1/tokens/validate',
 *   message: 'Invalid credit card number',
 *   timeout: 5000,
 *   params: { 
 *     mode: 'validate_only',
 *     checkFunds: false 
 *   }
 * }
 * ```
 * 
 * ### 5. Address Validation
 * Validate and standardize addresses using geocoding services.
 * ```typescript
 * {
 *   type: 'async',
 *   name: 'validate_address',
 *   field: 'street_address',
 *   validatorFunction: 'validateAddressWithGoogleMaps',
 *   message: 'Unable to verify address',
 *   timeout: 4000,
 *   params: {
 *     includeFields: ['city', 'state', 'zip'],
 *     strictMode: true,
 *     country: 'US'
 *   }
 * }
 * ```
 * 
 * ### 6. Domain Name Availability
 * Check if domain name is available for registration.
 * ```typescript
 * {
 *   type: 'async',
 *   name: 'domain_available',
 *   field: 'domain_name',
 *   validatorUrl: '/api/domains/check-availability',
 *   message: 'This domain is already taken or reserved',
 *   debounce: 500,
 *   timeout: 2000
 * }
 * ```
 * 
 * ### 7. Coupon Code Validation
 * Verify coupon code is valid and not expired.
 * ```typescript
 * {
 *   type: 'async',
 *   name: 'validate_coupon',
 *   field: 'coupon_code',
 *   validatorUrl: '/api/coupons/validate',
 *   message: 'Invalid or expired coupon code',
 *   timeout: 2000,
 *   params: {
 *     checkExpiration: true,
 *     checkUsageLimit: true,
 *     userId: '{{current_user_id}}'
 *   }
 * }
 * ```
 */
export const AsyncValidationSchema = BaseValidationSchema.extend({
  type: z.literal('async'),
  field: z.string().describe('Field to validate'),
  validatorUrl: z.string().optional().describe('External API endpoint for validation'),
  method: z.enum(['GET', 'POST']).default('GET').describe('HTTP method for external call'),
  headers: z.record(z.string(), z.string()).optional().describe('Custom headers for the request'),
  validatorFunction: z.string().optional().describe('Reference to custom validator function'),
  timeout: z.number().optional().default(5000).describe('Timeout in milliseconds'),
  debounce: z.number().optional().describe('Debounce delay in milliseconds'),
  params: z.record(z.string(), z.unknown()).optional().describe('Additional parameters to pass to validator'),
});

/**
 * 8. Custom Validator Function
 * User-defined validation logic with code reference.
 */
export const CustomValidatorSchema = BaseValidationSchema.extend({
  type: z.literal('custom'),
  handler: z.string().describe('Name of the custom validation function registered in the system'),
  params: z.record(z.string(), z.unknown()).optional().describe('Parameters passed to the custom handler'),
});

/**
 * 9. Master Validation Rule Schema
 */
/** Base type for validation rules - used for z.lazy() recursive type annotation */
export interface BaseValidationRuleShape {
  type: string;
  name: string;
  message: string;
  label?: string;
  description?: string;
  active?: boolean;
  events?: ('insert' | 'update' | 'delete')[];
  priority?: number;
  tags?: string[];
  severity?: 'error' | 'warning' | 'info';
  [key: string]: unknown;
}

export const ValidationRuleSchema: z.ZodType<BaseValidationRuleShape> = z.lazy(() =>
  z.discriminatedUnion('type', [
    ScriptValidationSchema,
    UniquenessValidationSchema,
    StateMachineValidationSchema,
    FormatValidationSchema,
    CrossFieldValidationSchema,
    JSONValidationSchema,
    AsyncValidationSchema,
    CustomValidatorSchema,
    ConditionalValidationSchema,
  ])
);

/**
 * 8. Conditional Validation
 * Validation that only applies when a condition is met.
 * 
 * ## Overview
 * Conditional validations follow the pattern: "Validate X only if Y is true"
 * This allows for context-aware validation rules that adapt to different scenarios.
 * 
 * ## Use Cases
 * 
 * ### 1. Validate Based on Record Type
 * Apply different validation rules based on the type of record.
 * ```typescript
 * {
 *   type: 'conditional',
 *   name: 'enterprise_approval_required',
 *   when: 'account_type = "enterprise"',
 *   message: 'Enterprise validation',
 *   then: {
 *     type: 'script',
 *     name: 'require_approval',
 *     message: 'Enterprise accounts require manager approval',
 *     condition: 'approval_status = null'
 *   }
 * }
 * ```
 * 
 * ### 2. Conditional Field Requirements
 * Require certain fields only when specific conditions are met.
 * ```typescript
 * {
 *   type: 'conditional',
 *   name: 'shipping_address_when_required',
 *   when: 'requires_shipping = true',
 *   message: 'Shipping validation',
 *   then: {
 *     type: 'script',
 *     name: 'shipping_address_required',
 *     message: 'Shipping address is required for physical products',
 *     condition: 'shipping_address = null OR shipping_address = ""'
 *   }
 * }
 * ```
 * 
 * ### 3. Amount-Based Validation
 * Apply different rules based on transaction amount.
 * ```typescript
 * {
 *   type: 'conditional',
 *   name: 'high_value_approval',
 *   when: 'order_total > 10000',
 *   message: 'High value order validation',
 *   then: {
 *     type: 'script',
 *     name: 'manager_approval_required',
 *     message: 'Orders over $10,000 require manager approval',
 *     condition: 'manager_approval_id = null'
 *   },
 *   otherwise: {
 *     type: 'script',
 *     name: 'standard_validation',
 *     message: 'Payment method is required',
 *     condition: 'payment_method = null'
 *   }
 * }
 * ```
 * 
 * ### 4. Regional Compliance
 * Apply region-specific validation rules.
 * ```typescript
 * {
 *   type: 'conditional',
 *   name: 'regional_compliance',
 *   when: 'region = "EU"',
 *   message: 'EU compliance validation',
 *   then: {
 *     type: 'script',
 *     name: 'gdpr_consent',
 *     message: 'GDPR consent is required for EU customers',
 *     condition: 'gdpr_consent_given = false'
 *   },
 *   otherwise: {
 *     type: 'script',
 *     name: 'tos_acceptance',
 *     message: 'Terms of Service acceptance required',
 *     condition: 'tos_accepted = false'
 *   }
 * }
 * ```
 * 
 * ### 5. Nested Conditional Validation
 * Create complex validation logic with nested conditions.
 * ```typescript
 * {
 *   type: 'conditional',
 *   name: 'country_state_validation',
 *   when: 'country = "US"',
 *   message: 'US-specific validation',
 *   then: {
 *     type: 'conditional',
 *     name: 'california_validation',
 *     when: 'state = "CA"',
 *     message: 'California-specific validation',
 *     then: {
 *       type: 'script',
 *       name: 'ca_tax_id_required',
 *       message: 'California requires a valid tax ID',
 *       condition: 'tax_id = null OR NOT(REGEX(tax_id, "^\\d{2}-\\d{7}$"))'
 *     }
 *   }
 * }
 * ```
 * 
 * ### 6. Tax Validation for Taxable Items
 * Only validate tax fields when the item is taxable.
 * ```typescript
 * {
 *   type: 'conditional',
 *   name: 'tax_field_validation',
 *   when: 'is_taxable = true',
 *   message: 'Tax validation',
 *   then: {
 *     type: 'script',
 *     name: 'tax_code_required',
 *     message: 'Tax code is required for taxable items',
 *     condition: 'tax_code = null OR tax_code = ""'
 *   }
 * }
 * ```
 * 
 * ### 7. Role-Based Validation
 * Apply validation based on user role.
 * ```typescript
 * {
 *   type: 'conditional',
 *   name: 'role_based_approval_limit',
 *   when: 'user_role = "manager"',
 *   message: 'Manager approval limits',
 *   then: {
 *     type: 'script',
 *     name: 'manager_limit',
 *     message: 'Managers can approve up to $50,000',
 *     condition: 'approval_amount > 50000'
 *   }
 * }
 * ```
 * 
 * ## Salesforce Pattern Comparison
 * 
 * Salesforce doesn't have explicit "conditional validation" rules but achieves similar
 * behavior using formula logic. ObjectStack makes this pattern explicit and composable.
 * 
 * **Salesforce Approach:**
 * ```
 * IF(
 *   ISPICKVAL(Type, "Enterprise"),
 *   AND(Amount > 100000, ISBLANK(Approval__c)),
 *   FALSE
 * )
 * ```
 * 
 * **ObjectStack Approach:**
 * ```typescript
 * {
 *   type: 'conditional',
 *   name: 'enterprise_high_value',
 *   when: 'type = "enterprise"',
 *   then: {
 *     type: 'cross_field',
 *     name: 'amount_approval',
 *     condition: 'amount > 100000 AND approval = null',
 *     fields: ['amount', 'approval']
 *   }
 * }
 * ```
 */
export const ConditionalValidationSchema = BaseValidationSchema.extend({
  type: z.literal('conditional'),
  when: z.string().describe('Condition formula (e.g. "type = \'enterprise\'")'),
  then: ValidationRuleSchema.describe('Validation rule to apply when condition is true'),
  otherwise: ValidationRuleSchema.optional().describe('Validation rule to apply when condition is false'),
});

export type ValidationRule = z.infer<typeof ValidationRuleSchema>;
export type ScriptValidation = z.infer<typeof ScriptValidationSchema>;
export type UniquenessValidation = z.infer<typeof UniquenessValidationSchema>;
export type StateMachineValidation = z.infer<typeof StateMachineValidationSchema>;
export type FormatValidation = z.infer<typeof FormatValidationSchema>;
export type CrossFieldValidation = z.infer<typeof CrossFieldValidationSchema>;
export type JSONValidation = z.infer<typeof JSONValidationSchema>;
export type AsyncValidation = z.infer<typeof AsyncValidationSchema>;
export type CustomValidation = z.infer<typeof CustomValidatorSchema>;
export type ConditionalValidation = z.infer<typeof ConditionalValidationSchema>;