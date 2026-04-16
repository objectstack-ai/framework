# ObjectStack Studio — Development Roadmap

> **Last Updated:** 2026-04-16
> **Version:** 4.0.4
> **Goal:** Build a practical, AI-enhanced metadata IDE focused on developer productivity.

---

## 🏗️ Architectural Principle

**Studio is a plugin platform, not a monolithic IDE.**

- **This project:** Core infrastructure (plugin system, kernel, navigation, testing, routing) + **one basic plugin example**
- **Designer plugins:** Official plugins developed in [objectstack-ai/studio](https://github.com/objectstack-ai/studio) (non-open-source)
- **Community plugins:** Third-party designers can be built and distributed independently

This approach ensures:
- **Modularity:** Each designer is independently developed, tested, and versioned
- **Maintainability:** Core framework stays lean and focused
- **Extensibility:** Community can build custom designers without forking Studio
- **Scalability:** Designers can be loaded on-demand, reducing bundle size
- **Commercial viability:** Official advanced designers can be proprietary while core remains open-source

**Built-in Example:** This repo includes a basic Object Inspector plugin to demonstrate the plugin API.

**Official Plugins:** Advanced designers (Object Designer, View Designer, Flow Designer, etc.) are developed separately in the [studio repository](https://github.com/objectstack-ai/studio).

**Reference Implementation:** See `apps/studio/src/plugins/built-in/` for the example plugin patterns.

---

## 📊 Current State (v4.0.4)

### What's Working

| Category | Feature | Status |
|----------|---------|--------|
| **Core Architecture** | MSW in-browser kernel + server mode | ✅ Stable |
| **Core Architecture** | Plugin system (VS Code-style) | ✅ Stable |
| **Core Architecture** | Package manager | ✅ Stable |
| **Core Architecture** | Theme toggle (light/dark/system) | ✅ Stable |
| **Data Browsing** | Object schema inspector | ✅ Stable |
| **Data Browsing** | Paginated data table with CRUD | ✅ Stable |
| **Data Browsing** | Record create/edit forms | ✅ Stable |
| **Developer Tools** | REST API console | ✅ Stable |
| **Developer Tools** | Generic JSON metadata inspector | ✅ Stable |
| **AI Integration** | AI Chat Panel (basic) | ✅ Stable |
| **Navigation** | Protocol-grouped sidebar | ✅ Stable |
| **Navigation** | Multi-package workspace | ✅ Stable |

### Key Technical Debt

| Issue | Impact | Priority |
|-------|--------|----------|
| No URL router — all navigation via `useState` | No deep links, no browser back/forward | 🔴 P0 |
| No component tests | Regression risk | 🟡 P1 |
| Data refresh via `setTimeout` hack | Race conditions | 🟡 P1 |
| Sidebar groups hardcoded | Plugin contributions ignored | 🟡 P1 |
| Dead code (`types.ts`, empty `app/dashboard/`) | Code clutter | 🟢 P2 |

---

## 🗺️ Roadmap (2026 Q2-Q4)

### Phase 1: Plugin Infrastructure (Q2 2026) — 6 weeks

**Goal:** Build robust plugin infrastructure to support external designer plugins.

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 1.1 | **Add URL Router** | 🔴 P0 | 1 week |
| | Integrate TanStack Router. Map views to URL paths: `/:package/objects/:name`, `/:package/metadata/:type/:name`. Enable browser back/forward. Plugin-contributed routes. | | |
| 1.2 | **Component Testing Setup** | 🔴 P0 | 1 week |
| | Setup React Testing Library. Write tests for `ObjectDataTable`, `ObjectDataForm`, `AppSidebar`, Plugin system. Target: 30% coverage. | | |
| 1.3 | **Plugin Sidebar Groups** | 🔴 P0 | 3 days |
| | Replace hardcoded `PROTOCOL_GROUPS` with plugin-contributed `useSidebarGroups()`. Enable plugins to register sidebar items. | | |
| 1.4 | **Plugin Hot Reload** | 🟡 P1 | 3 days |
| | Support plugin hot reload during development. Enable/disable plugins without page refresh. | | |
| 1.5 | **Data Refresh Fix** | 🟡 P1 | 2 days |
| | Replace `setTimeout` hack with proper state invalidation / React Query refetch. | | |
| 1.6 | **Code Cleanup** | 🟢 P2 | 2 days |
| | Remove stale `types.ts`, empty `app/dashboard/` directory. | | |
| 1.7 | **Plugin API Documentation** | 🟡 P1 | 3 days |
| | Document StudioPlugin API, metadataViewers registration, hooks, and best practices. Create plugin starter template. | | |

**Deliverable:** Production-ready plugin infrastructure for external designers.

**Note:** This phase includes one built-in example plugin (Basic Object Inspector). Advanced designer implementations will be developed in the [official studio repository](https://github.com/objectstack-ai/studio).

---

### Phase 2: AI Integration & Developer Tools (Q3 2026) — 6 weeks

**Goal:** AI-enhanced developer experience for metadata editing.

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 2.1 | **AI Copilot Enhancement** | 🔴 P0 | 2 weeks |
| | Context-aware AI assistance. Plugin-aware code generation. Metadata explanation. Smart suggestions. Integration with designer plugins via API. | | |
| 2.2 | **Command Palette (Ctrl+K)** | 🔴 P0 | 1 week |
| | Global command search. Quick navigation. Plugin-contributed commands. AI-powered command suggestions. | | |
| 2.3 | **Monaco Editor Integration** | 🔴 P0 | 2 weeks |
| | Raw YAML/JSON/TypeScript editing. Schema-aware autocomplete. Inline Zod validation. Toggle between visual/code modes. Plugin-contributed language support. | | |
| 2.4 | **Plugin Marketplace UI (Basic)** | 🟡 P1 | 1 week |
| | Browse available designer plugins. Install/uninstall UI. Plugin metadata display. Version management. | | |

**Deliverable:** AI-powered IDE with plugin extensibility.

**Note:** Official advanced designers (Object Designer, View Designer, Form Designer) are developed in [objectstack-ai/studio](https://github.com/objectstack-ai/studio) as proprietary plugins.

---

### Phase 3: Advanced IDE Features (Q4 2026) — 4 weeks

**Goal:** Professional IDE capabilities.

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 3.1 | **Multi-Tab Interface** | 🔴 P0 | 1 week |
| | Open multiple metadata items. Tab management (close/drag/split). Unsaved indicators. Plugin tabs support. | | |
| 3.2 | **Plugin DevTools** | 🔴 P0 | 1 week |
| | Plugin inspector. Performance profiling. Error logging. Hot reload status. Debug panel. | | |
| 3.3 | **Version Control Integration** | 🟡 P1 | 1 week |
| | Git diff viewer for metadata changes. Commit from Studio. Basic conflict resolution. | | |
| 3.4 | **Plugin Starter Kit** | 🟡 P1 | 1 week |
| | CLI scaffolding tool for creating new Studio plugins. Templates for common designer patterns (field editor, canvas, form builder). | | |

**Deliverable:** Complete plugin development environment.

**Note:** The [official studio repository](https://github.com/objectstack-ai/studio) uses this infrastructure to build full-featured proprietary designers.

---

## 📅 Simplified Timeline

```
2026 Q2  ── Phase 1: Plugin Infrastructure       [6 weeks]
            ├─ URL Router + Testing
            ├─ Plugin Sidebar Groups
            ├─ Plugin Hot Reload
            ├─ Plugin API Docs
            └─ Basic Object Inspector Plugin (built-in example)

2026 Q3  ── Phase 2: AI Integration & Tools      [6 weeks]
            ├─ AI Copilot Enhancement
            ├─ Command Palette (Ctrl+K)
            ├─ Monaco Editor Integration
            └─ Plugin Marketplace UI

2026 Q4  ── Phase 3: Advanced IDE Features       [4 weeks]
            ├─ Multi-Tab Interface
            ├─ Plugin DevTools
            ├─ Version Control Integration
            └─ Plugin Starter Kit

External ── Official Designer Plugins (objectstack-ai/studio - Proprietary)
            ├─ Object Designer Plugin
            ├─ View Designer Plugin
            ├─ Form Designer Plugin
            ├─ Flow Designer Plugin
            ├─ Dashboard Designer Plugin
            └─ Agent Designer Plugin

Community── Community Plugins (Open Ecosystem)
            └─ Custom designers by third-party developers
```

---

## 📐 Architecture Guidelines for New Plugins

Every new Studio plugin MUST follow these patterns:

### 1. File Structure
```
src/plugins/built-in/
  {name}-plugin.ts       # Plugin manifest + activate()
  {name}/
    {Name}Designer.tsx   # Main viewer component (design mode)
    {Name}Preview.tsx    # Preview mode component
    {Name}Code.tsx       # Raw code/YAML mode
    index.ts             # Barrel export
```

### 2. Plugin Registration
```typescript
export const myPlugin: StudioPlugin = {
  id: 'objectstack.{name}-designer',
  name: '{Name} Designer',
  version: '1.0.0',
  metadataViewers: [{
    id: 'objectstack.{name}-designer.viewer',
    metadataTypes: ['{type}'],
    modes: ['preview', 'design', 'code'],
    priority: 100,
  }],
  activate(api: StudioPluginAPI) {
    api.registerViewer('objectstack.{name}-designer.viewer', {Name}Designer);
  },
};
```

### 3. Data Access
- Use `useClient()` hook from `@objectstack/client-react`
- All API calls through the client — never bypass to fetch directly
- Handle loading/error/empty states consistently

### 4. Testing
- Component tests with React Testing Library
- Integration tests via `simulateBrowser()` harness
- Plugin registration/activation tests

---

## 🎯 Success Metrics (Realistic)

| Metric | Current (v4.0.4) | Q2 2026 | Q3 2026 | Q4 2026 |
|--------|------------------|---------|---------|---------|
| Component test coverage | 0% | 30% | 50% | 60% |
| Deep-linkable views | ❌ | ✅ | ✅ | ✅ |
| Plugin API stability (1-5) | 3 (evolving) | 4 (stable) | 5 (production) | 5 (documented) |
| External plugins supported | 0 | 2-3 | 5-8 | 10+ |
| AI assistance quality (1-5) | 2 (basic chat) | 3 (context-aware) | 4 (plugin-aware) | 4+ (code generation) |
| Plugin development time | N/A | 2 weeks | 1 week | 3 days |
| Developer satisfaction (1-5) | 3 | 3.5 | 4 | 4.5 |

---

## 🚫 What We're NOT Building in Core Studio

**Core Studio = Plugin Infrastructure + One Example**

The following are **external plugin responsibilities** (developed in [objectstack-ai/studio](https://github.com/objectstack-ai/studio)):

- ❌ Object Designer UI (official proprietary plugin)
- ❌ View Designer UI (official proprietary plugin)
- ❌ Form Designer UI (official proprietary plugin)
- ❌ Flow Designer UI (official proprietary plugin)
- ❌ Dashboard Designer UI (official proprietary plugin)
- ❌ Agent Designer UI (official proprietary plugin)
- ❌ Security/permission UI (official proprietary plugin)
- ❌ Full Airtable Interface parity (official proprietary plugins)
- ❌ Advanced automation designers (official proprietary plugins)
- ❌ Enterprise-specific UI (official proprietary plugins)

**Built-in in Core Studio:**
- ✅ Basic Object Inspector plugin (example/reference implementation)
- ✅ Generic JSON metadata viewer (fallback)

**Also Deferred:**
- ❌ Mobile/responsive mode (desktop-first)
- ❌ Real-time collaborative editing (complex, future)
- ❌ Public plugin marketplace (Phase 3+)

---

## 📦 Plugin Ecosystem

### Built-in (This Repository - Open Source)

**Basic Object Inspector Plugin** — Minimal reference implementation
- Read-only object schema viewer
- Field list with type badges
- Simple data browser
- Demonstrates plugin API patterns

**Purpose:** Educational example for plugin developers

---

### Official Plugins (objectstack-ai/studio - Proprietary)

Advanced designer plugins developed and maintained by ObjectStack:

1. **Object Designer** — Visual object & field editor with drag-and-drop
2. **View Designer** — Grid/Kanban/Calendar/Gantt view configurator
3. **Form Designer** — Layout editor with conditional visibility
4. **Flow Designer** — Automation flow canvas with BPMN support
5. **Dashboard Designer** — Interactive dashboard layout editor
6. **Agent Designer** — AI agent configuration with RAG pipeline builder

**Distribution:** Available via npm registry or private plugin marketplace

**License:** Proprietary (requires license key)

---

### Community Plugins (Third-Party - Variable Licensing)

Community developers can build custom designers:
- Industry-specific metadata editors
- Custom workflow designers
- Integration-specific tools
- Specialized data visualizers

**Plugin Development:** Follow the plugin API documented in Phase 1.7
