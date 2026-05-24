# Validation Rules

Comprehensive guide for implementing validation rules in ObjectStack.

## Available Rule Types

| Type | Purpose | When Validation Fails |
|:-----|:--------|:---------------------|
| `script` | Formula expression | When expression evaluates to `true` |
| `unique` | Composite uniqueness | When duplicate found |
| `state_machine` | Legal state transitions | When transition not allowed |
| `format` | Regex or built-in format | When format doesn't match |
| `cross_field` | Compare values across fields | When comparison fails |
| `json_schema` | Validate JSON field | When JSON doesn't match schema |
| `async` | External API validation | When API returns error |
| `custom` | Registered validator function | When function returns false |
| `conditional` | Apply rule conditionally | When nested rule fails |

## Script Validation

**⚠️ CRITICAL:** Script condition is **inverted** — validation **fails** when expression is `true`.

```typescript
validations: [
  {
    name: 'prevent_past_dates',
    type: 'script',
    condition: 'due_date < TODAY()',  // ❌ Fails when this is TRUE
    message: 'Due date cannot be in the past',
    severity: 'error',
    events: ['insert', 'update'],
  },
]
```

### Common Script Patterns

```typescript
// Prevent negative values
condition: 'amount < 0'

// Require field when another field has value
condition: 'status = "approved" AND approver_id IS NULL'

// Date range validation
condition: 'end_date < start_date'

// Conditional required field
condition: 'type = "enterprise" AND account_manager IS NULL'
```

## Unique Validation

```typescript
validations: [
  {
    name: 'unique_email',
    type: 'unique',
    fields: ['email'],
    caseSensitive: false,
    message: 'Email address already exists',
  },
  {
    name: 'unique_tenant_email',
    type: 'unique',
    fields: ['tenant_id', 'email'],  // Composite uniqueness
    caseSensitive: false,
    message: 'Email already exists in this tenant',
  },
]
```

## State Machine Validation

```typescript
validations: [
  {
    name: 'status_flow',
    type: 'state_machine',
    field: 'status',
    transitions: {
      draft: ['submitted', 'cancelled'],
      submitted: ['in_review', 'cancelled'],
      in_review: ['approved', 'rejected'],
      approved: ['published'],
      rejected: ['draft'],
      published: [],  // Terminal state
      cancelled: [],  // Terminal state
    },
    message: 'Invalid status transition',
    severity: 'error',
  },
]
```

## Format Validation

```typescript
validations: [
  // Built-in formats
  {
    name: 'email_format',
    type: 'format',
    field: 'email',
    format: 'email',  // Built-in: email, url, phone, json, uuid
    message: 'Invalid email format',
  },

  // Custom regex
  {
    name: 'sku_format',
    type: 'format',
    field: 'sku',
    pattern: '^[A-Z]{3}-\\d{4}$',  // e.g., ABC-1234
    message: 'SKU must be format: XXX-0000',
  },
]
```

## Cross-Field Validation

```typescript
validations: [
  {
    name: 'date_range',
    type: 'cross_field',
    condition: 'end_date > start_date',
    message: 'End date must be after start date',
    fields: ['start_date', 'end_date'],
  },
  {
    name: 'discount_limit',
    type: 'cross_field',
    condition: 'discount_amount <= subtotal * 0.5',
    message: 'Discount cannot exceed 50% of subtotal',
    fields: ['discount_amount', 'subtotal'],
  },
]
```

## JSON Schema Validation

```typescript
validations: [
  {
    name: 'config_schema',
    type: 'json_schema',
    field: 'config',
    schema: {
      type: 'object',
      properties: {
        timeout: { type: 'number', minimum: 0 },
        retries: { type: 'integer', minimum: 1, maximum: 5 },
        enabled: { type: 'boolean' },
      },
      required: ['timeout', 'enabled'],
      additionalProperties: false,
    },
    message: 'Invalid configuration format',
  },
]
```

## Async Validation

```typescript
validations: [
  {
    name: 'external_api_check',
    type: 'async',
    field: 'tax_id',
    endpoint: 'https://api.example.com/validate/tax-id',
    method: 'POST',
    timeout: 5000,
    debounce: 500,  // Delay validation by 500ms
    message: 'Invalid tax ID',
  },
]
```

## Conditional Validation

```typescript
validations: [
  {
    name: 'enterprise_requires_manager',
    type: 'conditional',
    condition: "type = 'enterprise'",
    validations: [
      {
        name: 'manager_required',
        type: 'script',
        condition: 'account_manager IS NULL',
        message: 'Enterprise accounts must have an account manager',
      },
    ],
  },
]
```

## Validation Properties

### Severity Levels

```typescript
severity: 'error'    // Blocks save (default)
severity: 'warning'  // Allows save, shows warning
severity: 'info'     // Informational only
```

### Events

```typescript
events: ['insert']              // Only on create
events: ['update']              // Only on update
events: ['insert', 'update']    // On create and update (default)
events: ['delete']              // Only on delete
```

### Priority

```typescript
priority: 0      // System validations (run first)
priority: 100    // Application validations (default)
priority: 1000   // User validations (run last)
```

Lower numbers execute **first**.

## Incorrect vs Correct

### ❌ Incorrect — Script Logic Inverted

```typescript
{
  type: 'script',
  condition: 'amount > 0',  // ❌ Fails when amount > 0 (inverted!)
  message: 'Amount must be positive',
}
```

### ✅ Correct — Script Logic

```typescript
{
  type: 'script',
  condition: 'amount <= 0',  // ✅ Fails when amount <= 0
  message: 'Amount must be positive',
}
```

### ❌ Incorrect — Missing Severity

```typescript
{
  type: 'script',
  condition: 'end_date < start_date',
  message: 'End date must be after start date',
  // ❌ No severity — defaults to 'error' which may be too strict
}
```

### ✅ Correct — Explicit Severity

```typescript
{
  type: 'script',
  condition: 'end_date < start_date',
  message: 'End date must be after start date',
  severity: 'warning',  // ✅ Allow save but warn user
}
```

### ❌ Incorrect — Validation Fires Too Often

```typescript
{
  type: 'script',
  condition: 'status = "draft"',
  message: 'Record is still in draft',
  // ❌ No events — runs on all operations
}
```

### ✅ Correct — Validation Scoped to Events

```typescript
{
  type: 'script',
  condition: 'status = "draft"',
  message: 'Cannot publish draft records',
  events: ['update'],  // ✅ Only validate on update
}
```

## Common Patterns

### Prevent Backdating

```typescript
{
  name: 'no_backdate',
  type: 'script',
  condition: 'created_at < TODAY()',
  message: 'Cannot create records with past dates',
  events: ['insert'],
}
```

### Require Approval for High Values

```typescript
{
  name: 'high_value_approval',
  type: 'conditional',
  condition: 'amount > 10000',
  validations: [
    {
      type: 'script',
      condition: 'approved_by IS NULL',
      message: 'High-value transactions require approval',
    },
  ],
}
```

### Email Domain Whitelist

```typescript
{
  name: 'email_domain',
  type: 'format',
  field: 'email',
  pattern: '^[a-zA-Z0-9._%+-]+@(company\\.com|partner\\.com)$',
  message: 'Email must be from company.com or partner.com',
}
```

### Phone Number Format

```typescript
{
  name: 'phone_format',
  type: 'format',
  field: 'phone',
  pattern: '^\\+?[1-9]\\d{1,14}$',  // E.164 format
  message: 'Phone must be in international format (+1234567890)',
}
```

### Composite Unique (Tenant + Email)

```typescript
{
  name: 'tenant_email_unique',
  type: 'unique',
  fields: ['tenant_id', 'email'],
  caseSensitive: false,
  message: 'Email already exists in this tenant',
}
```

## Best Practices

1. **Use declarative validation first** — Only use script validation when declarative rules don't fit
2. **Severity matters** — Use `warning` for soft rules, `error` for hard rules
3. **Events scope** — Only validate on relevant operations to avoid overhead
4. **Priority order** — System validations first (0-99), app validations second (100-999), user validations last (1000+)
5. **Clear error messages** — Tell users exactly what's wrong and how to fix it
6. **Async validation debounce** — Use debounce to reduce API calls on fast typing
7. **State machine for workflows** — Use state_machine instead of complex script logic
8. **Unique constraints** — Always use unique validation, not script-based checks
9. **Cross-field for comparisons** — More efficient than script validation
10. **Test thoroughly** — Validate edge cases, nulls, empty strings

## Performance Considerations

- **Script validations are expensive** — Use sparingly, prefer declarative rules
- **Async validations add latency** — Use debounce and appropriate timeouts
- **Priority affects order** — Lower priority = runs first
- **Unique checks hit database** — Index the unique fields for performance
- **State machine is optimized** — Better than complex conditional logic
