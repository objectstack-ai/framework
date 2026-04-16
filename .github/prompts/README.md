# ObjectStack AI Prompts Index

This directory contains specialized AI prompts for working with the ObjectStack specification repository. Each prompt defines a specific role, context, and responsibilities to help AI assistants provide focused, high-quality assistance.

## 📂 Prompt Categories

### Protocol Architecture Prompts

These prompts help define the core ObjectStack protocols:

#### 1. [Data Protocol Architect](./data-protocol.prompt.md)
**Location:** `packages/spec/src/data/`  
**Focus:** ObjectQL - Data structure, validation, permissions, workflows  
**Key Responsibilities:**
- Field definitions (23+ types)
- Object schemas
- Validation rules
- Permission systems
- Workflow automation
- Flow builders
- Query AST
- Trigger contexts

**Use When:** Defining data models, business logic, or data access patterns

---

#### 2. [UI Protocol Architect](./ui-protocol.prompt.md)
**Location:** `packages/spec/src/ui/`  
**Focus:** ObjectUI - Server-Driven UI definitions  
**Key Responsibilities:**
- View protocols (List, Form, Calendar, Kanban, Gantt)
- App navigation structures
- Dashboard layouts and widgets
- Report definitions
- Action buttons
- Page layouts
- Theme configurations
- Widget contracts

**Use When:** Defining UI structures, views, or user interactions

---

#### 3. [System Protocol Architect](./system-protocol.prompt.md)
**Location:** `packages/spec/src/system/`  
**Focus:** ObjectOS - Runtime environment and platform capabilities  
**Key Responsibilities:**
- Manifest (packaging)
- Plugin lifecycle
- Driver interface
- Identity & authentication
- Role-based access control
- API contracts
- Webhooks
- Translations (i18n)
- Multi-tenancy

**Use When:** Defining system-level features, plugins, or platform capabilities

---

#### 4. [AI Protocol Architect](./ai-protocol.prompt.md)
**Location:** `packages/spec/src/ai/`  
**Focus:** AI agent integration  
**Key Responsibilities:**
- Agent definitions
- Tool integrations
- Knowledge bases (RAG)
- Conversation management
- Prompt templates
- AI workflows
- Model configurations

**Use When:** Integrating AI capabilities, defining agents, or building RAG systems

---

#### 5. [API Protocol Architect](./api-protocol.prompt.md)
**Location:** `packages/spec/src/api/`  
**Focus:** API contracts and standardization  
**Key Responsibilities:**
- Response envelopes
- Request schemas
- API contracts
- Error codes
- REST endpoints
- GraphQL schemas
- Webhook payloads
- Batch operations

**Use When:** Defining API structures, endpoints, or integration contracts

---

### Specialized Role Prompts

These prompts help with specific development tasks:

#### 6. [Testing Engineer](./testing-engineer.prompt.md)
**Focus:** Comprehensive test coverage for all protocols  
**Key Responsibilities:**
- Schema validation tests
- Type inference tests
- Edge case testing
- Integration tests
- Regression tests
- Performance tests
- Documentation tests

**Use When:** Writing tests, improving coverage, or validating schemas

---

#### 7. [Documentation Writer](./documentation-writer.prompt.md)
**Focus:** Clear, comprehensive documentation  
**Key Responsibilities:**
- TSDoc comments
- Concept documentation
- API reference docs
- Tutorials and guides
- Migration guides
- Example documentation

**Use When:** Writing docs, adding comments, or creating tutorials

---

#### 8. [Example Creator](./example-creator.prompt.md)
**Focus:** Realistic, runnable examples  
**Key Responsibilities:**
- Full application examples (CRM, Todo, etc.)
- Quick start examples
- Feature-specific examples
- Real-world scenarios
- Advanced examples
- Example documentation

**Use When:** Creating examples, demos, or reference implementations

---

## 🎯 How to Use These Prompts

### For AI Coding Assistants

These prompts are compatible with multiple AI coding assistants:

- **Claude Code** (Recommended): Automatically loaded from the repository context
- **GitHub Copilot**: Automatically loaded when working in the repository
- **Cursor**: Can reference these prompts for context-aware assistance

They provide context-aware assistance based on:
- The file you're editing
- The protocol layer you're working on
- The task you're performing

### For Custom AI Assistants

1. **Choose the Right Prompt**: Select the prompt that matches your task
2. **Provide Context**: Share relevant code, requirements, or issues
3. **Be Specific**: Clear instructions get better results

### Quick Command Reference

Each prompt includes interaction commands for common tasks:

**Data Protocol:**
- "Create Field Protocol" → Implement field definitions
- "Create Object Protocol" → Implement object schemas
- "Create Validation Rules" → Implement validation engine

**UI Protocol:**
- "Create View Protocol" → Implement view definitions
- "Create Dashboard Protocol" → Implement dashboard layouts
- "Create Theme System" → Implement theming

**System Protocol:**
- "Create Manifest Protocol" → Implement packaging
- "Create Plugin System" → Implement plugin lifecycle
- "Create Driver Interface" → Implement database drivers

**AI Protocol:**
- "Create Agent Protocol" → Implement AI agents
- "Create Knowledge Base" → Implement RAG system

**Testing:**
- "Write tests for X" → Create comprehensive tests
- "Add edge case tests" → Add boundary tests

**Documentation:**
- "Document X schema" → Write complete docs
- "Add TSDoc comments" → Add inline documentation

**Examples:**
- "Create CRM example" → Build full CRM app
- "Add lookup example" → Show relationship patterns

---

## 📋 Protocol Standards

All prompts enforce these standards:

### Naming Conventions
- **Configuration Keys** (TS properties): `camelCase`
  - Example: `maxLength`, `referenceFilters`, `defaultValue`
- **Machine Names** (data values): `snake_case`
  - Example: `first_name`, `project_task`, `account_id`

### Zod-First Approach
```typescript
// 1. Define Zod schema
export const MySchema = z.object({
  field: z.string().describe('Purpose'),
});

// 2. Infer TypeScript type
export type My = z.infer<typeof MySchema>;
```

### Documentation Requirements
- Every field must have `.describe()` annotation
- Complex schemas need JSDoc comments
- Include examples in tests and docs

### Testing Requirements
- 80%+ code coverage target
- Test valid inputs, invalid inputs, edge cases
- Integration tests for connected schemas

---

## 🔄 Workflow Integration

### Development Workflow

1. **Design Phase**
   - Use Protocol Architect prompts to define schemas
   - Reference existing protocols for consistency

2. **Implementation Phase**
   - Use architect prompts to implement Zod schemas
   - Follow naming conventions strictly

3. **Testing Phase**
   - Use Testing Engineer prompt
   - Achieve 80%+ coverage

4. **Documentation Phase**
   - Use Documentation Writer prompt
   - Add TSDoc and concept docs

5. **Example Phase**
   - Use Example Creator prompt
   - Create runnable examples

### Code Review Checklist

- [ ] Follows naming conventions (camelCase/snake_case)
- [ ] Zod schema with `.describe()` annotations
- [ ] Type inferred from Zod
- [ ] Unit tests with 80%+ coverage
- [ ] TSDoc comments
- [ ] Documentation updated
- [ ] Example created/updated (if major feature)

---

## 🎓 Best Practices

### Design Principles

1. **Zod First**: Always start with Zod schema, derive types
2. **Strict Types**: Never use `any`, use proper unions
3. **No Business Logic**: Only definitions, no implementations
4. **Extensibility**: Design for plugin additions
5. **Backwards Compatibility**: Never break existing APIs

### Benchmarking

When designing protocols, benchmark against:
- **Salesforce**: Object/Field model, Lightning components
- **ServiceNow**: Service catalog, CMDB
- **Kubernetes**: Manifest structure, CRDs
- **OpenAPI**: API contract definitions

### Philosophy

- **Data as Code**: All metadata is versioned
- **Idempotency**: Same input = same output
- **Immutable Infrastructure**: No runtime schema mutations
- **Convention over Configuration**: Sensible defaults

---

## 📚 Related Resources

### Repository Documentation
- [ARCHITECTURE.md](../../ARCHITECTURE.md) - System architecture
- [DEVELOPMENT_ROADMAP.md](../../internal/planning/DEVELOPMENT_ROADMAP.md) - Development plan
- [PRIORITIES.md](../../internal/planning/PRIORITIES.md) - Priority matrix
- [README.md](../../README.md) - Project overview

### Protocol Documentation
- [Data Protocol Docs](../../content/docs/protocols/data/)
- [UI Protocol Docs](../../content/docs/protocols/ui/)
- [System Protocol Docs](../../content/docs/protocols/system/)

### Examples
- [CRM Example](../../examples/crm/) - Complete application
- [Todo Example](../../examples/todo/) - Quick start
- [Feature Examples](../../examples/features/) - Specific features

---

## 🤝 Contributing

When adding new prompts:

1. **Follow Template**: Use existing prompts as template
2. **Define Scope**: Clear role and responsibilities
3. **Include Examples**: Show expected patterns
4. **Add Commands**: List interaction shortcuts
5. **Update Index**: Add to this README

### Prompt Template

```markdown
# 🎯 [Role Name]

**Role:** You are the **[Title]** for ObjectStack.
**Context:** [What you're defining]
**Location:** [Directory or scope]

## Mission

[One-paragraph mission statement]

## Core Responsibilities

### 1. [Responsibility Name]
[Details with code examples]

## Coding Standards
[Standards specific to this role]

## Interaction Commands
[Quick commands for common tasks]

## Best Practices
[Tips and guidelines]

## Reference Examples
[Links to relevant examples]
```

---

## 📞 Support

- **Discord**: [Join our community](https://discord.gg/objectstack)
- **GitHub Issues**: [Report issues](https://github.com/objectstack-ai/spec/issues)
- **Documentation**: [Read the docs](https://docs.objectstack.ai)

---

## 📄 License

These prompts are part of the ObjectStack Protocol specification.  
License: Apache 2.0 © ObjectStack

---

**Last Updated:** 2026-01-21  
**Version:** 1.0.0  
**Maintainer:** ObjectStack Team
