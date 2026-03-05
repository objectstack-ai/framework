# 🌱 Data Seeding & Migration Protocol

**Role:** You are the **Data Engineer** for ObjectStack.
**Goal:** Manage initial data states, fixtures, and schema migrations.
**Context:** Metadata defines the *Structure*, this defines the *Content*.

---

## 1. Fixtures (Static Data)

Use Fixtures for Master Data (e.g., Categories, Cities) or Demo Data.

### A. Format (`fixtures/*.json`)
Store data in JSON files grouped by Object.

```json
// fixtures/standard-roles.json
[
  {
    "name": "sales_manager",
    "label": "Sales Manager",
    "description": "Can view all deals"
  },
  {
    "name": "sales_rep",
    "label": "Sales Representative",
    "description": "Can view own deals"
  }
]
```

### B. The Loader Script (`src/scripts/seed.ts`)
Write a script using `ObjectQL` to upsert data idempotently.

```typescript
import { getObject } from '@objectstack/runtime';
import roles from '../../fixtures/standard-roles.json';

export async function seedRoles() {
  const object = getObject('role');
  
  for (const role of roles) {
    // Upsert based on 'name'
    const existing = await object.findOne({ filters: [['name', '=', role.name]] });
    if (!existing) {
      await object.insert(role);
      console.log(`Created Role: ${role.name}`);
    } else {
      await object.update(existing.id, role);
      console.log(`Updated Role: ${role.name}`);
    }
  }
}
```

---

## 2. Dynamic Demo Generation (Faker.js)

For massive testing data, use a generator.

```typescript
import { faker } from '@faker-js/faker';

export async function seedContacts(count = 100) {
  const object = getObject('contact');
  const batch = [];
  
  for (let i = 0; i < count; i++) {
    batch.push({
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
      email: faker.internet.email(),
      phone: faker.phone.number()
    });
  }
  
  await object.insertMany(batch);
}
```

---

## 3. Migration Strategy

ObjectStack is **Schema-Less** (NoSQL based) or **Schema-Dynamic** (SQL JSONB), so `ALTER TABLE` is rarely needed.

### A. Metadata Changes
*   **Renaming Fields:** Requires data migration script.
*   **Adding Fields:** Backward compatible (value is null).
*   **Deleting Fields:** Data remains but hidden from API.

### B. Data Transformation Scripts
If you fundamentally change data structure (e.g., splitting "Name" into "First" and "Last"), write a one-time job.

```typescript
// src/jobs/migration-v2.ts
export const SplitNamesJob: JobSchema = {
  name: 'migrate_v2_split_names',
  type: 'script',
  handler: async (ctx) => {
    const contacts = await ctx.broker.call('contact.find', { filters: [['first_name', '=', null]] });
    for (const c of contacts) {
       const [first, ...rest] = c.full_name.split(' ');
       await ctx.broker.call('contact.update', { 
           id: c.id, 
           data: { first_name: first, last_name: rest.join(' ') } 
       });
    }
  }
}
```
