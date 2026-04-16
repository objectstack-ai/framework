# 🤖 Claude Code Development Guide

> **Complete guide for developing ObjectStack Framework with Claude Code**

This guide explains how to effectively use Claude Code for ObjectStack Framework development, leveraging the project's comprehensive AI instruction system.

---

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [AI Instruction System](#ai-instruction-system)
- [Domain-Specific Prompts](#domain-specific-prompts)
- [Skills System](#skills-system)
- [Development Workflows](#development-workflows)
- [Best Practices](#best-practices)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Understanding the Instruction Hierarchy

Claude Code reads instructions in this priority order:

```
1. CLAUDE.md (Root) ← Highest priority
2. .github/prompts/*.prompt.md ← Domain-specific context
3. skills/*/SKILL.md ← Detailed implementation guides
4. Repository memories ← Learned patterns and conventions
```

### 2. Essential Files

| File | Purpose | When to Read |
|:---|:---|:---|
| `CLAUDE.md` | Main project instructions | Always loaded automatically |
| `.github/copilot-instructions.md` | Parallel to CLAUDE.md, keep in sync | Reference only |
| `.github/prompts/README.md` | Prompt system index | When choosing domain |
| `skills/*/SKILL.md` | Implementation details | When working on specific features |

### 3. First-Time Setup

```bash
# 1. Clone the repository
git clone https://github.com/objectstack-ai/framework.git
cd framework

# 2. Install dependencies
pnpm install

# 3. Build all packages
pnpm build

# 4. Run tests to verify setup
pnpm test
```

---

## Project Structure

### Monorepo Layout

```
objectstack-ai/framework/
│
├── CLAUDE.md                    # 🎯 Main Claude Code instructions
├── .claudeignore                # Files to ignore
├── docs/CLAUDE_CODE_GUIDE.md    # This guide
│
├── .github/
│   ├── copilot-instructions.md  # GitHub Copilot version (keep synced)
│   └── prompts/                 # Domain-specific prompts
│       ├── README.md
│       ├── data-protocol.prompt.md
│       ├── ui-protocol.prompt.md
│       ├── system-protocol.prompt.md
│       ├── ai-protocol.prompt.md
│       ├── api-protocol.prompt.md
│       ├── testing-engineer.prompt.md
│       ├── documentation-writer.prompt.md
│       └── example-creator.prompt.md
│
├── skills/                      # 🎓 Domain-specific skill guides
│   ├── objectstack-quickstart/
│   ├── objectstack-plugin/
│   ├── objectstack-schema/
│   ├── objectstack-query/
│   ├── objectstack-api/
│   ├── objectstack-ui/
│   ├── objectstack-automation/
│   ├── objectstack-ai/
│   ├── objectstack-hooks/
│   └── objectstack-i18n/
│
├── packages/                    # Core framework packages
├── apps/                        # Applications (studio, docs, server)
├── examples/                    # Reference implementations
└── content/docs/                # Documentation content
```

---

## AI Instruction System

### 1. CLAUDE.md (Root Instructions)

**Location:** `/CLAUDE.md`

**Purpose:** Defines your role as "Chief Protocol Architect" and establishes:
- Prime directives (Zod-first, naming conventions)
- Monorepo structure
- Protocol domains
- Kernel architecture
- Context routing rules

**Always Active:** This file is automatically loaded by Claude Code.

### 2. Domain-Specific Prompts

**Location:** `.github/prompts/`

**Purpose:** Provide specialized context for each protocol domain.

| Prompt File | Domain | When to Use |
|:---|:---|:---|
| `data-protocol.prompt.md` | ObjectQL | Defining objects, fields, validations, queries |
| `ui-protocol.prompt.md` | ObjectUI | Creating views, apps, dashboards, reports |
| `system-protocol.prompt.md` | ObjectOS | Plugin system, drivers, manifests, i18n |
| `ai-protocol.prompt.md` | AI Integration | Agents, tools, skills, RAG pipelines |
| `api-protocol.prompt.md` | API Contracts | REST/GraphQL endpoints, request/response |
| `testing-engineer.prompt.md` | Testing | Writing tests, improving coverage |
| `documentation-writer.prompt.md` | Documentation | TSDoc, guides, tutorials |
| `example-creator.prompt.md` | Examples | Creating runnable examples |

**How to Use:**
- Claude Code automatically applies relevant prompts based on file context
- You can explicitly reference: "Use the Data Protocol approach from .github/prompts/data-protocol.prompt.md"

### 3. Skills System

**Location:** `skills/`

**Purpose:** Detailed implementation guides for specific features.

Each skill includes:
- `SKILL.md` - Main implementation guide
- `references/` - Reference documentation
- `rules/` - Pattern rules and constraints
- `evals/` - Evaluation criteria

**Example Skills:**

```
skills/objectstack-schema/
├── SKILL.md                    # Main schema design guide
├── references/
│   └── _index.md
├── rules/
│   ├── field-types.md          # Field type rules
│   ├── relationships.md        # Relationship patterns
│   ├── validation.md           # Validation rules
│   ├── naming.md               # Naming conventions
│   └── indexing.md             # Index strategies
└── evals/
    └── README.md               # Quality criteria
```

**When to Read Skills:**
- Before implementing a new feature in that domain
- When debugging domain-specific issues
- To understand architectural patterns

---

## Domain-Specific Prompts

### Data Protocol (`packages/spec/src/data/`)

**Read:** `.github/prompts/data-protocol.prompt.md`

**Covers:**
- Field definitions (23+ types)
- Object schemas
- Validation rules
- Permission systems
- Query AST
- Workflow automation

**Example Task:**
```
"Define a new field type for encrypted data"
→ Claude will use data-protocol.prompt.md
→ Follow Zod-first approach
→ Add validation
→ Create tests
```

### UI Protocol (`packages/spec/src/ui/`)

**Read:** `.github/prompts/ui-protocol.prompt.md`

**Covers:**
- View protocols (List, Form, Calendar, Kanban, Gantt)
- App navigation
- Dashboard layouts
- Widget contracts
- Theme configuration

**Example Task:**
```
"Create a new view type for timeline visualization"
→ Use ui-protocol.prompt.md patterns
→ Define Zod schema
→ Add view renderer
→ Create example
```

### System Protocol (`packages/spec/src/system/`)

**Read:** `.github/prompts/system-protocol.prompt.md`

**Covers:**
- Plugin lifecycle
- Driver interface
- Manifest structure
- Identity & authentication
- RBAC implementation
- i18n system

**Example Task:**
```
"Add a new plugin hook for data transformation"
→ Follow system-protocol.prompt.md
→ Update PluginContext
→ Add lifecycle hooks
→ Document behavior
```

### AI Protocol (`packages/spec/src/ai/`)

**Read:** `.github/prompts/ai-protocol.prompt.md`

**Covers:**
- Agent definitions
- Tool integrations
- Knowledge bases (RAG)
- Conversation management
- Prompt templates

**Example Task:**
```
"Create a new agent type for code generation"
→ Use ai-protocol.prompt.md
→ Define agent schema
→ Add tool contracts
→ Create conversation flow
```

### API Protocol (`packages/spec/src/api/`)

**Read:** `.github/prompts/api-protocol.prompt.md`

**Covers:**
- Response envelopes
- Request schemas
- API contracts
- Error codes
- REST/GraphQL patterns

**Example Task:**
```
"Add batch operation endpoint"
→ Follow api-protocol.prompt.md
→ Define request/response schemas
→ Add error handling
→ Create tests
```

---

## Development Workflows

### Workflow 1: Adding a New Field Type

```bash
# 1. Read the relevant skill
Read: skills/objectstack-schema/SKILL.md

# 2. Read the protocol prompt
Read: .github/prompts/data-protocol.prompt.md

# 3. Implement following Zod-first approach
File: packages/spec/src/data/field-types.zod.ts

# 4. Add tests
File: packages/spec/src/data/field-types.test.ts

# 5. Run tests
pnpm test

# 6. Update documentation
# Auto-generated via pnpm build
```

### Workflow 2: Creating a New Plugin

```bash
# 1. Read plugin skill
Read: skills/objectstack-plugin/SKILL.md

# 2. Read system protocol
Read: .github/prompts/system-protocol.prompt.md

# 3. Create plugin structure
Directory: packages/plugins/plugin-{name}/

# 4. Implement lifecycle hooks
File: packages/plugins/plugin-{name}/src/index.ts

# 5. Add tests
File: packages/plugins/plugin-{name}/src/index.test.ts

# 6. Run tests
pnpm test
```

### Workflow 3: Adding a New View Type

```bash
# 1. Read UI skill
Read: skills/objectstack-ui/SKILL.md

# 2. Read UI protocol
Read: .github/prompts/ui-protocol.prompt.md

# 3. Define view schema
File: packages/spec/src/ui/view.zod.ts

# 4. Add view renderer
File: apps/studio/src/components/views/{type}.tsx

# 5. Create example
File: examples/app-{name}/views/{example}.ts

# 6. Test and document
pnpm test && pnpm build
```

---

## Best Practices

### 1. Always Follow Prime Directives

From `CLAUDE.md`:

✅ **DO:**
- Start with Zod schema, derive TypeScript types via `z.infer<>`
- Use `camelCase` for configuration keys (TypeScript properties)
- Use `snake_case` for machine names (data values)
- Use singular for metadata type names (`agent`, not `agents`)
- Use namespace imports: `import { Data } from '@objectstack/spec'`
- Benchmark against Salesforce, ServiceNow, Kubernetes

❌ **DON'T:**
- Add business logic to `packages/spec` (only definitions)
- Use relative paths like `../../packages/spec`
- Use temporary workarounds (always sustainable solutions)
- Edit auto-generated docs in `content/docs/references/`

### 2. Zod-First Development Pattern

```typescript
// ✅ CORRECT: Define Zod schema first
export const MySchema = z.object({
  /** Machine name — must be snake_case */
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/),
  /** Human-readable label */
  label: z.string(),
  /** Configuration option */
  maxLength: z.number().optional(),
});

// ✅ CORRECT: Derive TypeScript type
export type My = z.infer<typeof MySchema>;

// ❌ WRONG: Defining TypeScript interface first
interface My {
  name: string;
  label: string;
  maxLength?: number;
}
```

### 3. Naming Conventions

```typescript
// ✅ Configuration Keys (TypeScript properties) - camelCase
{
  maxLength: 100,
  defaultValue: "example",
  referenceFilters: []
}

// ✅ Machine Names (data values) - snake_case
{
  name: 'first_name',
  object: 'project_task',
  field: 'account_id'
}

// ✅ Metadata Type Names - singular
const type = 'agent';  // not 'agents'
const type = 'tool';   // not 'tools'
const type = 'view';   // not 'views'

// ✅ REST API Endpoints - plural
GET /api/v1/ai/agents
GET /api/v1/ai/conversations
```

### 4. Documentation Requirements

```typescript
// ✅ CORRECT: Every field has .describe()
export const FieldSchema = z.object({
  name: z.string()
    .regex(/^[a-z_][a-z0-9_]*$/)
    .describe('Machine name (snake_case)'),

  label: z.string()
    .describe('Human-readable display label'),

  type: FieldTypeSchema
    .describe('Field data type'),
});

// ✅ CORRECT: Complex schemas have TSDoc
/**
 * Encrypted field for storing sensitive data
 * @description Provides end-to-end encryption with configurable algorithms
 */
export const EncryptedFieldSchema = z.object({
  // ...
});
```

### 5. Testing Requirements

```typescript
// ✅ Test valid inputs
test('should accept valid field', () => {
  const result = FieldSchema.parse({
    name: 'first_name',
    label: 'First Name',
    type: 'text',
  });
  expect(result).toBeDefined();
});

// ✅ Test invalid inputs
test('should reject invalid name', () => {
  expect(() => FieldSchema.parse({
    name: 'FirstName', // camelCase not allowed
    label: 'First Name',
    type: 'text',
  })).toThrow();
});

// ✅ Test edge cases
test('should handle empty default value', () => {
  const result = FieldSchema.parse({
    name: 'optional_field',
    label: 'Optional',
    type: 'text',
    defaultValue: '',
  });
  expect(result.defaultValue).toBe('');
});
```

---

## Common Tasks

### Ask Claude Code for Help

When working on tasks, you can ask Claude Code specific questions:

**General Questions:**
```
"What is the structure of the ObjectStack framework?"
"How do I create a new plugin?"
"Explain the microkernel architecture"
```

**Domain-Specific Questions:**
```
"How do I define a new field type?"
→ Will use data-protocol.prompt.md

"How do I create a new view type?"
→ Will use ui-protocol.prompt.md

"How do I add a new agent?"
→ Will use ai-protocol.prompt.md
```

**Implementation Questions:**
```
"Show me the pattern for defining a relationship field"
"What's the correct way to implement a plugin lifecycle hook?"
"How should I structure a new service in packages/services?"
```

### Request Code Generation

**Creating New Schemas:**
```
"Create a Zod schema for a multi-select field type with the following requirements:
- Supports multiple selections
- Has minimum/maximum selection limits
- Allows default values
- Includes validation"
```

**Creating Tests:**
```
"Write comprehensive tests for the EncryptedFieldSchema including:
- Valid encryption algorithms
- Invalid inputs
- Edge cases for key management
- Type inference validation"
```

**Creating Documentation:**
```
"Create TSDoc comments for the FlowSchema that explain:
- Purpose and use cases
- All configuration options
- Examples of different flow types
- Best practices"
```

### Review and Refactor Code

```
"Review the current implementation of RelationshipFieldSchema and suggest improvements for:
- Type safety
- Validation rules
- Documentation completeness
- Test coverage"
```

### Debug Issues

```
"I'm getting a Zod validation error when parsing this object:
{...}
Can you identify what's wrong and fix it?"
```

---

## Troubleshooting

### Issue: Claude Code not using correct context

**Solution:**
1. Explicitly mention the relevant prompt file:
   ```
   "Using the patterns from .github/prompts/data-protocol.prompt.md,
    create a new field type for..."
   ```

2. Reference the specific skill:
   ```
   "Following the guidance in skills/objectstack-schema/SKILL.md,
    implement a relationship field..."
   ```

### Issue: Generated code doesn't follow conventions

**Solution:**
Check and explicitly state the conventions:
```
"Following the Prime Directives in CLAUDE.md:
- Use camelCase for configuration keys
- Use snake_case for machine names
- Start with Zod schema
- Derive TypeScript types via z.infer<>
Please regenerate the code"
```

### Issue: Tests are failing

**Solution:**
1. Run tests first to see current state:
   ```bash
   pnpm test
   ```

2. Ask Claude Code to analyze:
   ```
   "The tests are failing with this error: {...}
    Can you analyze the issue and fix it?"
   ```

### Issue: Documentation not generating correctly

**Solution:**
1. Ensure schemas have `.describe()` on every field
2. Run build to regenerate docs:
   ```bash
   pnpm build
   ```
3. Check that you're not editing files in `content/docs/references/` (auto-generated)

### Issue: Import errors

**Solution:**
Use namespace imports as per CLAUDE.md:
```typescript
// ✅ CORRECT
import { Data, UI, System } from '@objectstack/spec';

// ✅ CORRECT
import * as Data from '@objectstack/spec/data';

// ❌ WRONG
import { Field } from '../../packages/spec/src/data/field.zod';
```

---

## Advanced Usage

### Creating Custom Prompts

If you need specialized guidance for a new feature area:

1. Create a new prompt file:
   ```
   .github/prompts/my-feature.prompt.md
   ```

2. Follow the prompt template from `.github/prompts/README.md`

3. Update the index in `.github/prompts/README.md`

### Extending Skills

To add new skills:

1. Create skill directory:
   ```
   skills/objectstack-{domain}/
   ```

2. Add required files:
   ```
   skills/objectstack-{domain}/
   ├── SKILL.md
   ├── references/
   ├── rules/
   └── evals/
   ```

3. Update CLAUDE.md to reference the new skill

---

## Resources

### Essential Reading

1. **CLAUDE.md** - Main instructions (always active)
2. **ARCHITECTURE.md** - System architecture
3. **CONTRIBUTING.md** - Contribution guidelines
4. **.github/prompts/README.md** - Prompt system guide

### Quick Reference

- **Build Commands:** `pnpm build`, `pnpm test`, `pnpm dev`
- **Package Manager:** pnpm (NOT npm or yarn)
- **Node Version:** >= 18.0.0
- **Test Framework:** Vitest
- **Schema Validation:** Zod
- **Monorepo Tool:** Turborepo

### Community

- **Discord:** https://discord.gg/objectstack
- **GitHub Issues:** https://github.com/objectstack-ai/framework/issues
- **Documentation:** https://docs.objectstack.ai

---

## Conclusion

Claude Code is set up with a comprehensive instruction system for ObjectStack Framework development. By following this guide and leveraging the prompt and skill systems, you can efficiently develop high-quality, consistent code that adheres to the framework's architectural principles.

**Key Takeaways:**
1. CLAUDE.md is always active - it defines your role and core principles
2. Domain-specific prompts provide specialized context automatically
3. Skills offer detailed implementation guides for specific features
4. Always follow Zod-first, naming conventions, and no-business-logic-in-spec rules
5. Test thoroughly and document comprehensively

Happy coding! 🚀

---

**Last Updated:** 2026-04-16
**Version:** 1.0.0
**Maintainer:** ObjectStack Team
