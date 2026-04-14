# Agent Design Patterns

Guide for designing AI agents in ObjectStack.

## Agent Types

- **Data Chat** — Natural language query interface for data
- **Metadata Assistant** — Schema design and modification helper
- **Custom Agents** — Domain-specific AI assistants

## Agent Configuration

```typescript
{
  name: 'customer_support_agent',
  model: 'gpt-4',
  systemPrompt: 'You are a helpful customer support agent...',
  tools: ['query_records', 'create_record', 'send_email'],
  context: {
    objects: ['account', 'contact', 'case'],
  },
}
```

## Tool Definition

```typescript
{
  name: 'query_records',
  description: 'Query records from an object',
  parameters: {
    object: { type: 'string', required: true },
    filter: { type: 'object' },
    limit: { type: 'number', default: 10 },
  },
}
```

## Incorrect vs Correct

### ❌ Incorrect — Vague Tool Description

```typescript
{
  name: 'get_data',  // ❌ Vague name
  description: 'Gets data',  // ❌ Vague description
}
```

### ✅ Correct — Clear Tool Definition

```typescript
{
  name: 'query_account_records',  // ✅ Specific name
  description: 'Query account records with optional filters and pagination',  // ✅ Clear description
}
```

## Best Practices

1. **Use clear, descriptive tool names** — Agent must understand purpose
2. **Provide detailed tool descriptions** — Include examples
3. **Limit tool count** — 5-10 tools per agent max
4. **Define parameter schemas** — Validate input
5. **Handle errors gracefully** — Return user-friendly messages

---

See parent skill for complete documentation: [../SKILL.md](../SKILL.md)
