# ObjectStack Examples Catalog

> **Comprehensive examples demonstrating all ObjectStack protocols and features**

Welcome to the ObjectStack examples catalog! This directory contains carefully crafted examples organized by complexity and use case to help you get started quickly and learn the platform effectively.

## 📚 Quick Navigation

### By Learning Path

| Level | Examples | Description |
|-------|----------|-------------|
| 🟢 **Beginner** | [App Todo](#app-todo), [Plugin BI](#plugin-bi) | Start here - simple, focused examples |
| 🟡 **Intermediate** | [App CRM](#app-crm) | Real-world enterprise application |
| 🔴 **Advanced** | [Server](../apps/server/) | Server hosting & plugin orchestration |

### By Protocol Category

| Protocol | Examples | Status |
|----------|----------|--------|
| **Data (ObjectQL)** | [App CRM](./app-crm/), [App Todo](./app-todo/) | ✅ Complete |
| **UI (ObjectUI)** | [App CRM](./app-crm/), [App Todo](./app-todo/) | ✅ Complete |
| **System (ObjectOS)** | [Server](../apps/server/), [App CRM](./app-crm/) | ✅ Complete |
| **Automation** | [App CRM](./app-crm/), [App Todo](./app-todo/) | ✅ Complete |
| **API** | [Server](../apps/server/) | ✅ Complete |
| **BI / Analytics** | [Plugin BI](./plugin-bi/) | 🔴 Stub |
| **Hub & Marketplace** | _Coming soon_ | 🔴 Planned |

## 🎯 Example Descriptions

### App Todo
**Path:** [`examples/app-todo/`](./app-todo/)  
**Level:** 🟢 Beginner  
**Protocols:** Data, UI, Automation  

A complete task management application demonstrating all core ObjectStack protocols using the by-type directory convention.

**What you'll learn:**
- Object definitions with validations and workflows
- Actions (complete, defer, clone, bulk operations)
- Dashboards with 10 widgets (metrics, charts, tables)
- Reports (6 types: tabular, summary, matrix)
- Automation flows (reminders, escalation, recurring tasks)
- App navigation and branding configuration
- **I18n translations** (English, Chinese, Japanese)
- Package structure with `objectstack.config.ts`

**Directory Structure:**
```
app-todo/
├── objectstack.config.ts      # Main manifest (defineStack)
├── src/
│   ├── objects/                # Object & hook definitions
│   │   ├── task.object.ts
│   │   └── task.hook.ts
│   ├── actions/                # Action definitions
│   │   └── task.actions.ts
│   ├── apps/                   # App navigation
│   │   └── todo.app.ts
│   ├── dashboards/             # Dashboard widgets
│   │   └── task.dashboard.ts
│   ├── reports/                # Report definitions
│   │   └── task.report.ts
│   ├── flows/                  # Automation flows
│   │   └── task.flow.ts
│   └── translations/           # I18n translations (en, zh-CN, ja-JP)
│       └── todo.translation.ts
└── test/
    └── seed.test.ts
```

**Quick Start:**
```bash
cd examples/app-todo
pnpm install
pnpm typecheck
```

---

### App CRM
**Path:** [`examples/app-crm/`](./app-crm/)  
**Level:** 🟡 Intermediate  
**Protocols:** Data, UI, Automation, AI  

**Full-featured CRM** demonstrating enterprise-grade patterns and all major field types.

**What's included:**
- 12 interconnected objects (Account, Contact, Opportunity, Lead, Case, Task, Campaign, Contract, Product, Quote)
- All 28 field types demonstrated
- Multiple view types (Grid, Kanban, Calendar, Gantt)
- Validation rules and workflows
- 3 dashboards (Executive, Sales, Service)
- 6 reports (by account, contact, lead, opportunity, case, task)
- 5 automation flows (lead conversion, case escalation, opportunity approval, etc.)
- AI agents and RAG pipelines
- **I18n translations** (English, Chinese, Japanese, Spanish)

**Directory Structure:**
```
app-crm/
├── objectstack.config.ts
├── src/
│   ├── objects/                # 12 object + hook definitions
│   │   ├── account.object.ts
│   │   ├── account.hook.ts
│   │   ├── contact.object.ts
│   │   ├── lead.object.ts
│   │   ├── lead.hook.ts
│   │   ├── lead.state.ts
│   │   ├── opportunity.object.ts
│   │   └── ...
│   ├── actions/                # Context-aware actions
│   │   ├── lead.actions.ts
│   │   ├── opportunity.actions.ts
│   │   └── ...
│   ├── apps/                   # App navigation
│   │   └── crm.app.ts
│   ├── dashboards/             # Analytics dashboards
│   │   ├── executive.dashboard.ts
│   │   ├── sales.dashboard.ts
│   │   └── service.dashboard.ts
│   ├── reports/                # Business reports
│   │   ├── account.report.ts
│   │   ├── opportunity.report.ts
│   │   └── ...
│   ├── flows/                  # Automation flows
│   │   ├── lead-conversion.flow.ts
│   │   ├── case-escalation.flow.ts
│   │   └── ...
│   ├── translations/           # I18n translations (en, zh-CN, ja-JP, es-ES)
│   │   └── crm.translation.ts
│   ├── agents/                 # AI agents
│   ├── rag/                    # RAG pipelines
│   ├── apis/                   # Custom APIs
│   ├── profiles/               # Permission profiles
│   └── sharing/                # Sharing rules
└── test/
```

**Quick Start:**
```bash
cd examples/app-crm
pnpm install
pnpm build
```

---

**Note:** The production server example has been moved to [`apps/server/`](../apps/server/) — see the [Server documentation](../apps/server/README.md) for details on server hosting, plugin orchestration, and deployment.

---

### Plugin BI
**Path:** [`examples/plugin-bi/`](./plugin-bi/)  
**Level:** 🟢 Beginner  
**Protocols:** Data, UI (Dashboards)  

**BI Plugin stub** demonstrating how to create an ObjectStack plugin that provides analytics objects and dashboards. Currently a placeholder for adding business intelligence capabilities.

**What you'll learn:**
- Plugin manifest structure (`type: 'plugin'`)
- Extending an app with analytics objects
- Dashboard widget definitions

**Directory Structure:**
```
plugin-bi/
├── objectstack.config.ts  # Plugin manifest (defineStack)
└── package.json
```

**Quick Start:**
```bash
cd examples/plugin-bi
pnpm install
pnpm typecheck
```

---

## 🗺️ Protocol Coverage Map

### Data Protocol (ObjectQL)
| Protocol | Example | Location |
|----------|---------|----------|
| Object Definition | ✅ Complete | [CRM Objects](./app-crm/src/objects/), [Todo Objects](./app-todo/src/objects/) |
| Field Types (28 types) | ✅ Complete | [CRM Account](./app-crm/src/objects/account.object.ts) |
| Validation Rules | ✅ Complete | [CRM](./app-crm/), [Todo](./app-todo/src/objects/task.object.ts) |
| Relationships | ✅ Complete | [CRM Contact](./app-crm/src/objects/contact.object.ts) |
| Formulas | ✅ Complete | [CRM Account](./app-crm/src/objects/account.object.ts) |
| Hooks | ✅ Complete | [CRM Hooks](./app-crm/src/objects/account.hook.ts), [Todo Hooks](./app-todo/src/objects/task.hook.ts) |
| State Machines | ✅ Complete | [CRM Lead State](./app-crm/src/objects/lead.state.ts) |
| Query & Filters | ✅ Complete | [CRM](./app-crm/), [Todo](./app-todo/) |
| Document Storage | 🔴 Missing | _Planned_ |

### UI Protocol (ObjectUI)
| Protocol | Example | Location |
|----------|---------|----------|
| List Views | ✅ Complete | [CRM](./app-crm/) - Grid, Kanban, Calendar, Gantt |
| Form Views | ✅ Complete | [CRM](./app-crm/) - Simple, Tabbed, Wizard |
| Actions | ✅ Complete | [CRM Actions](./app-crm/src/actions/), [Todo Actions](./app-todo/src/actions/) |
| Dashboards | ✅ Complete | [CRM Dashboards](./app-crm/src/dashboards/), [Todo Dashboard](./app-todo/src/dashboards/) |
| Reports | ✅ Complete | [CRM Reports](./app-crm/src/reports/), [Todo Reports](./app-todo/src/reports/) |
| Apps | ✅ Complete | [CRM App](./app-crm/src/apps/crm.app.ts), [Todo App](./app-todo/src/apps/todo.app.ts) |
| Charts | ✅ Complete | [CRM Dashboards](./app-crm/src/dashboards/) |
| Widgets | ✅ Complete | [Todo Dashboard](./app-todo/src/dashboards/task.dashboard.ts) |
| Components | 🔴 Missing | _Planned_ |

### System Protocol (ObjectOS)
| Protocol | Example | Location |
|----------|---------|----------|
| Manifest | ✅ Complete | All examples with `objectstack.config.ts` |
| Plugin System | ✅ Complete | [Server](../apps/server/) |
| Preview Mode | ✅ Complete | [Server](../apps/server/) — `OS_MODE=preview` |
| Datasources | 🟡 Partial | [Server](../apps/server/) |
| I18n / Translations | ✅ Complete | [Todo Translations](./app-todo/src/translations/), [CRM Translations](./app-crm/src/translations/) |
| Job Scheduling | 🔴 Missing | _Planned_ |
| Metrics | 🔴 Missing | _Planned_ |

### AI Protocol
| Protocol | Example | Location |
|----------|---------|----------|
| Agent | ✅ Complete | [CRM Agents](./app-crm/src/agents/) |
| RAG Pipeline | ✅ Complete | [CRM RAG](./app-crm/src/rag/) |
| Model Registry | ✅ Complete | _Spec Only_ |

### Automation Protocol
| Protocol | Example | Location |
|----------|---------|----------|
| Workflow Rules | ✅ Complete | [CRM](./app-crm/), [Todo](./app-todo/src/objects/task.object.ts) |
| Flow (Visual) | ✅ Complete | [CRM Flows](./app-crm/src/flows/), [Todo Flows](./app-todo/src/flows/) |
| Approval Processes | ✅ Complete | [CRM Opportunity Approval](./app-crm/src/flows/opportunity-approval.flow.ts) |
| Triggers | ✅ Complete | [CRM](./app-crm/), [Todo](./app-todo/) |

### Auth & Permissions
| Protocol | Example | Location |
|----------|---------|----------|
| Profiles | ✅ Complete | [CRM Profiles](./app-crm/src/profiles/) |
| Sharing Rules | ✅ Complete | [CRM Sharing](./app-crm/src/sharing/) |
| RBAC | 🟡 Partial | [CRM](./app-crm/) |

### API Protocol
| Protocol | Example | Location |
|----------|---------|----------|
| REST Server | ✅ Complete | [Server](../apps/server/) |
| Custom APIs | ✅ Complete | [CRM APIs](./app-crm/src/apis/) |
| GraphQL | 🔴 Missing | _Planned_ |
| WebSocket/Realtime | 🔴 Missing | _Planned_ |

---

## 🚀 Getting Started

### Prerequisites
```bash
# Ensure you have Node.js 18+ and pnpm installed
node --version  # >= 18.0.0
pnpm --version  # >= 8.0.0
```

### Quick Start
```bash
# 1. Clone and install
git clone https://github.com/objectstack-ai/spec.git
cd spec
pnpm install

# 2. Build the spec package
pnpm --filter @objectstack/spec build

# 3. Explore examples
cd examples/app-todo
pnpm typecheck

# 4. Or explore the CRM
cd examples/app-crm
pnpm build
```

### Learning Path

#### Path 1: Quick Start (1-2 hours)
1. Read [Todo Example](./app-todo/) - Understand basic structure and conventions
2. Explore [Todo objectstack.config.ts](./app-todo/objectstack.config.ts) - See manifest patterns
3. Browse [CRM Example](./app-crm/) - Learn advanced features

#### Path 2: Deep Dive (1-2 days)
1. Complete Path 1
2. Study all [CRM Objects](./app-crm/src/objects/) - Master field types and relationships
3. Review [CRM Flows](./app-crm/src/flows/) - Understand automation patterns
4. Explore [Server](../apps/server/) - Server and plugin orchestration

---

## 📝 Example Standards

All examples in this directory follow these standards:

### Code Quality
- ✅ **Type-safe**: All examples use TypeScript and pass `typecheck`
- ✅ **Zod-first**: Schemas defined with Zod, types inferred
- ✅ **Naming conventions**: `camelCase` for config, `snake_case` for data
- ✅ **Documented**: Comprehensive inline comments
- ✅ **Best practices**: Follow ObjectStack conventions

### File Structure (By-Type Convention)
```
example-name/
├── README.md              # Comprehensive documentation
├── package.json           # Package definition
├── tsconfig.json          # TypeScript config
├── objectstack.config.ts  # Main manifest (defineStack)
├── src/
│   ├── objects/           # *.object.ts, *.hook.ts, *.state.ts
│   ├── actions/           # *.actions.ts
│   ├── apps/              # *.app.ts
│   ├── dashboards/        # *.dashboard.ts
│   ├── reports/           # *.report.ts
│   ├── flows/             # *.flow.ts
│   └── translations/      # *.translation.ts (i18n bundles)
└── test/
    └── seed.test.ts
```

### Documentation Requirements
Each example MUST have:
- Clear purpose statement
- Prerequisites and dependencies
- Quick start instructions
- Protocol coverage explanation
- Key concepts highlighted
- Related examples linked

---

## 🤝 Contributing Examples

Want to add an example? Great! Please ensure:

1. **Follow the standards** above
2. **Fill a gap** in protocol coverage
3. **Add documentation** (README.md)
4. **Test thoroughly** (must compile and run)
5. **Submit PR** with clear description

See [CONTRIBUTING.md](../CONTRIBUTING.md) for details.

---

## 📚 Additional Resources

- **[Main Documentation](../content/docs/)** - Complete protocol reference
- **[Architecture Guide](../ARCHITECTURE.md)** - System architecture
- **[Quick Reference](../QUICK-REFERENCE.md)** - Fast lookup
- **[Package Dependencies](../PACKAGE-DEPENDENCIES.md)** - Build order

---

## 📄 License

All examples are licensed under Apache 2.0. See [LICENSE](../LICENSE) for details.

---

**Last Updated:** 2026-02-12
**Protocol Version:** 3.0.0
**Total Examples:** 3 (app-todo, app-crm, plugin-bi)
**Directory Convention:** By-Type (Salesforce DX style)
