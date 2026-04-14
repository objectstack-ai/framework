# Flow Types and Patterns

Guide for designing automation flows in ObjectStack.

## Flow Types

ObjectStack supports three flow types:

- **Autolaunched** — Triggered by data events (insert/update/delete)
- **Screen** — User-initiated flows with UI components
- **Schedule** — Time-based/cron-triggered flows

## Autolaunched Flow Pattern

```typescript
{
  name: 'new_account_welcome',
  type: 'autolaunched',
  trigger: {
    object: 'account',
    event: 'afterInsert',
  },
  actions: [
    {
      type: 'send_email',
      template: 'welcome_email',
      to: '{!account.owner.email}',
    },
  ],
}
```

## Schedule Flow Pattern

```typescript
{
  name: 'daily_summary',
  type: 'schedule',
  schedule: '0 9 * * *',  // Daily at 9 AM
  actions: [
    {
      type: 'query_records',
      object: 'task',
      filter: { due_date: 'TODAY()' },
    },
    {
      type: 'send_email',
      template: 'daily_tasks',
    },
  ],
}
```

## Incorrect vs Correct

### ❌ Incorrect — Autolaunched Flow Without Trigger

```typescript
{
  type: 'autolaunched',  // ❌ No trigger specified
  actions: [/* ... */],
}
```

### ✅ Correct — Complete Trigger Configuration

```typescript
{
  type: 'autolaunched',
  trigger: {
    object: 'account',
    event: 'afterInsert',  // ✅ Trigger specified
  },
  actions: [/* ... */],
}
```

## Best Practices

1. **Use after* events for autolaunched flows** — Avoid blocking transactions
2. **Limit flow complexity** — Break complex flows into multiple smaller flows
3. **Handle errors gracefully** — Use try/catch, retry policies
4. **Test flows thoroughly** — Validate all paths and edge cases
5. **Monitor flow execution** — Track success/failure rates

---

See parent skill for complete documentation: [../SKILL.md](../SKILL.md)
