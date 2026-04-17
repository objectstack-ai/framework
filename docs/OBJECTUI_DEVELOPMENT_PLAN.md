## 概述

本 Issue 汇总基于 ObjectUI 开发完整 ObjectStack 前端界面的最终开发方案。ObjectUI 是 ObjectStack 的 **Server-Driven UI (SDUI) 渲染引擎**，基于 `@objectstack/spec` 的 UI 协议（ViewSchema、PageSchema、AppSchema、ActionSchema、ThemeSchema）将 JSON 元数据渲染为 Shadcn/Tailwind 品质的 React 组件。

### 定位

```
@objectstack/spec (协议层)        → 定义 UI 的 JSON Schema（what）
@objectstack/client + client-react → 数据/元数据获取 hooks（how to get data）  
ObjectUI (渲染层)                  → 将 JSON 元数据渲染为 React 组件（how to render）
apps/studio (开发工具)             → 元数据编辑 IDE（设计器）
```

**ObjectUI ≠ Studio**：
- **Studio** = 面向开发者的元数据编辑器（当前仓库 `apps/studio/`）
- **ObjectUI** = 面向终端用户的业务应用渲染引擎（新建 `packages/objectui/`）

---

## 现有基础设施

### ✅ 已完成 — 协议层（`@objectstack/spec`）

| Schema | 文件 | 描述 |
|:---|:---|:---|
| `AppSchema` | `spec/src/ui/app.zod.ts` | App 导航壳：navigation tree、areas、branding |
| `ViewSchema` (ListView + FormView) | `spec/src/ui/view.zod.ts` | 7 种视图类型 (grid/kanban/gallery/calendar/timeline/gantt/map) + 表单 |
| `PageSchema` | `spec/src/ui/page.zod.ts` | 16 种页面类型，Region 布局、FlexiPage + Airtable Interface 混合 |
| `DashboardSchema` | `spec/src/ui/dashboard.zod.ts` | Widget 组合面板：KPI、Chart、Pivot、Matrix |
| `ActionSchema` | `spec/src/ui/action.zod.ts` | 交互抽象：script / url / modal / flow / api |
| `ThemeSchema` | `spec/src/ui/theme.zod.ts` | 设计令牌：颜色、排版、间距、圆角、模式 |
| `PageComponentSchema` | `spec/src/ui/component.zod.ts` | 组件 Props 定义（RecordDetails、RelatedList、Activity 等） |
| `WidgetSchema` | `spec/src/ui/widget.zod.ts` | 自定义 Widget 生命周期（onMount/onUpdate/onUnmount） |
| I18n、Responsive、Keyboard、Touch、DnD、Offline、Animation、Notification | `spec/src/ui/*.zod.ts` | 完整的 PWA 级 UI 协议 |

### ✅ 已完成 — 客户端 SDK

| Hook | 包 | 描述 |
|:---|:---|:---|
| `useQuery` / `useMutation` | `client-react` | 数据 CRUD |
| `usePagination` / `useInfiniteQuery` | `client-react` | 分页/无限滚动 |
| `useObject` / `useView` / `useFields` / `useMetadata` | `client-react` | 元数据获取 |
| `useDataSubscription` / `useMetadataSubscription` | `client-react` | 实时订阅 |
| `ObjectStackProvider` / `useClient` | `client-react` | 上下文提供 |

### ✅ 已完成 — REST API

| API | 描述 |
|:---|:---|
| `GET /api/v1/meta/objects/:name` | Object Schema (字段、关系、验证) |
| `GET /api/v1/meta/views/:name` | View 定义 (列、排序、筛选) |
| `GET /api/v1/meta/apps` | App 列表 (导航、图标、权限) |
| `GET /api/v1/data/:object` | 数据查询 (OData-style filter/sort/select) |
| `POST /PUT /DELETE /api/v1/data/:object` | 数据 CRUD |

---

## 开发方案：分 5 个阶段

### Phase 1: 核心渲染引擎 (`packages/objectui/`)

> **目标**：能将 ViewSchema JSON 渲染为 Shadcn 品质的 React 组件

#### 1.1 ViewRenderer — 视图渲染工厂

```
ViewSchema.type → React Component
  'grid'     → <DataGrid />       (TanStack Table + virtual scroll)
  'kanban'   → <KanbanBoard />    (dnd-kit)
  'gallery'  → <GalleryGrid />    (CSS Grid / Masonry)
  'calendar' → <CalendarView />   (FullCalendar or custom)
  'timeline' → <TimelineView />   (custom)
  'gantt'    → <GanttChart />     (custom or gantt-task-react)
  'map'      → <MapView />        (Mapbox/Leaflet)
```

**核心 API 设计**：

```typescript
// packages/objectui/src/index.tsx

// 1. View Renderer — 根据 ViewSchema 类型分发
export function ViewRenderer({ view, object }: { view: ListView; object: string }) {
  // useQuery + useObject 获取数据和字段定义
  // 根据 view.type 选择对应组件
}

// 2. Form Renderer — 根据 FormViewSchema 渲染表单
export function FormRenderer({ form, object, recordId? }: Props) {
  // useObject 获取字段定义
  // 根据 form.sections 渲染分组字段
}

// 3. Field Renderer — 根据 FieldType 渲染单个字段
export function FieldRenderer({ field, value, mode }: Props) {
  // mode: 'display' | 'edit' | 'filter'
  // field.type: 'text' | 'number' | 'date' | 'select' | 'reference' | ...
}
```

**关键实现细节**：

| 组件 | Spec 对应 | 依赖库 | 优先级 |
|:---|:---|:---|:---:|
| `<DataGrid />` | `ListViewSchema` (type: grid) | TanStack Table v8 + TanStack Virtual | 🔴 P0 |
| `<FormRenderer />` | `FormViewSchema` + `FormSectionSchema` | React Hook Form + Zod resolver | 🔴 P0 |
| `<FieldRenderer />` | `FieldSchema.type` (30+ 字段类型) | Shadcn UI primitives | 🔴 P0 |
| `<KanbanBoard />` | `KanbanConfigSchema` | dnd-kit | 🟡 P1 |
| `<CalendarView />` | `CalendarConfigSchema` | date-fns + custom | 🟡 P1 |
| `<GalleryGrid />` | `GalleryConfigSchema` | CSS Grid | 🟡 P1 |

#### 1.2 FieldType → Widget 映射

```
text           → <Input />
textarea       → <Textarea />
number         → <NumberInput />
currency       → <CurrencyInput />
percent        → <PercentInput />
date           → <DatePicker />
datetime       → <DateTimePicker />
time           → <TimePicker />
boolean        → <Switch /> or <Checkbox />
select         → <Select /> (single)
multiselect    → <MultiSelect /> (tags)
reference      → <RecordPicker /> (lookup)
multi_reference→ <MultiRecordPicker />
email          → <Input type="email" />
url            → <Input type="url" /> with preview
phone          → <PhoneInput />
rating         → <StarRating />
image          → <ImageUpload />
file           → <FileUpload />
rich_text      → <RichTextEditor /> (Tiptap)
json           → <CodeEditor /> (Monaco)
formula        → <FormulaDisplay /> (read-only)
autonumber     → <Badge /> (read-only)
```

---

### Phase 2: App Shell — 应用导航框架

> **目标**：将 `AppSchema` 渲染为完整的应用壳

#### 2.1 AppShell 组件

```typescript
// packages/objectui/src/app/AppShell.tsx

export function AppShell({ app }: { app: App }) {
  return (
    <SidebarProvider>
      <AppSidebar app={app} />       {/* 左侧导航 */}
      <main>
        <SiteHeader app={app} />      {/* 顶部栏 */}
        <Outlet />                     {/* 页面内容 */}
      </main>
    </SidebarProvider>
  );
}
```

#### 2.2 导航渲染

| AppSchema 字段 | 渲染为 |
|:---|:---|
| `app.navigation[]` | 递归侧边栏菜单 (GroupNavItem → 折叠组, ObjectNavItem → 链接) |
| `app.areas[]` | 顶部 Area 切换器 (类似 Salesforce App Launcher) |
| `app.branding` | Logo + 主题色 |
| `app.mobileNavigation` | 移动端底部 Tab / 抽屉菜单 |

#### 2.3 路由系统

```
/app/:appName                          → App Shell
/app/:appName/object/:objectName       → 默认 ListView
/app/:appName/object/:objectName/view/:viewName → 指定 ListView
/app/:appName/object/:objectName/:id   → 记录详情 (FormView)
/app/:appName/dashboard/:dashboardName → Dashboard
/app/:appName/page/:pageName           → Custom Page
```

---

### Phase 3: Page Renderer — 页面组合引擎

> **目标**：将 `PageSchema` 渲染为组件组合页面

#### 3.1 PageRenderer

```typescript
export function PageRenderer({ page }: { page: Page }) {
  // 1. 根据 page.type 选择布局模板
  // 2. 遍历 page.regions，每个 region 渲染其 components
  // 3. 每个 component 根据 type 分发到 ComponentRegistry
}
```

#### 3.2 ComponentRegistry（核心扩展点）

```typescript
const COMPONENT_REGISTRY: Record<string, React.ComponentType<any>> = {
  // Structure
  'page:header': PageHeader,
  'page:tabs': PageTabs,
  'page:card': PageCard,
  
  // Record Context
  'record:details': RecordDetails,    // → 字段详情面板
  'record:highlights': RecordHighlights, // → KPI 高亮卡
  'record:related_list': RecordRelatedList, // → 关联记录列表
  'record:activity': RecordActivity,  // → 活动/评论流
  
  // AI
  'ai:chat_window': AIChatWindow,
  'ai:suggestion': AISuggestion,
  
  // Elements (Airtable Interface parity)
  'element:text': TextElement,
  'element:number': NumberElement,
  'element:button': ButtonElement,
  'element:filter': FilterElement,
  'element:form': FormElement,
  'element:record_picker': RecordPicker,
};
```

---

### Phase 4: Dashboard & Reports

> **目标**：将 `DashboardSchema` 渲染为 KPI/图表面板

| Widget 类型 | 渲染组件 | 图表库 |
|:---|:---|:---|
| `chart` | `<ChartWidget />` | Recharts 或 ECharts |
| `kpi` | `<KPICard />` | Shadcn Card + 数字动画 |
| `table` | `<TableWidget />` | 复用 DataGrid |
| `pivot` | `<PivotTable />` | TanStack Table + grouping |
| `list` | `<ListWidget />` | 复用 DataGrid (简化版) |

---

### Phase 5: Interface Builder (Design → Publish)

> **目标**：可视化拖拽构建界面，参考 Issue #823 分析

此阶段实现 Airtable-style Interface Designer：
- **设计模式**：拖拽组件到画布，右侧属性面板
- **预览模式**：以终端用户视角预览
- **发布流程**：Draft → Staged → Published 三阶段生命周期
- **版本管理**：版本快照、回滚、差异对比

详见 Issue #823 的架构设计。

---

## 技术栈决策

| 领域 | 选择 | 理由 |
|:---|:---|:---|
| **UI 框架** | React 19 | 与 client-react、Studio 统一 |
| **组件库** | Shadcn UI + Radix | 可定制、无锁定、对标 ThemeSchema |
| **样式** | Tailwind CSS 4 | 设计令牌驱动、响应式 |
| **表格** | TanStack Table v8 + TanStack Virtual | 虚拟滚动、列排序/筛选/分组/固定 |
| **表单** | React Hook Form + Zod | Zod-first 验证、与 Spec FieldValidation 对齐 |
| **拖拽** | dnd-kit | Kanban + Interface Builder + DnD 排序 |
| **图表** | Recharts (轻量) 或 ECharts (全功能) | Dashboard Widget 渲染 |
| **富文本** | Tiptap v2 | rich_text 字段类型 |
| **路由** | TanStack Router | 类型安全、与 Studio 统一 |
| **状态** | Zustand + React Query (TanStack Query) | 服务器状态 + 本地 UI 状态 |
| **日期** | date-fns | Calendar/Timeline/Gantt 视图 |
| **国际化** | 运行时渲染 `I18nLabelSchema` | 协议内置 i18n |

---

## 包结构

```
packages/objectui/
├── src/
│   ├── index.tsx              # 公开 API 入口
│   ├── provider.tsx           # <ObjectUIProvider> (配置 + 客户端注入)
│   │
│   ├── app/                   # App Shell 层
│   │   ├── AppShell.tsx       # 主布局 (sidebar + header + outlet)
│   │   ├── AppSidebar.tsx     # 导航渲染 (NavigationItemSchema → 递归菜单)
│   │   ├── AppLauncher.tsx    # App 切换器
│   │   └── AppRouter.tsx      # 路由配置
│   │
│   ├── views/                 # View Renderers
│   │   ├── ViewRenderer.tsx   # 视图分发工厂
│   │   ├── DataGrid.tsx       # grid 视图
│   │   ├── KanbanBoard.tsx    # kanban 视图
│   │   ├── GalleryGrid.tsx    # gallery 视图
│   │   ├── CalendarView.tsx   # calendar 视图
│   │   ├── TimelineView.tsx   # timeline 视图
│   │   ├── GanttChart.tsx     # gantt 视图
│   │   └── MapView.tsx        # map 视图
│   │
│   ├── forms/                 # Form Renderers
│   │   ├── FormRenderer.tsx   # 表单布局工厂
│   │   ├── FormSection.tsx    # 分组渲染
│   │   └── FormWizard.tsx     # 向导模式
│   │
│   ├── fields/                # Field Renderers (30+ 字段类型)
│   │   ├── FieldRenderer.tsx  # 字段分发工厂
│   │   ├── TextField.tsx
│   │   ├── NumberField.tsx
│   │   ├── DateField.tsx
│   │   ├── SelectField.tsx
│   │   ├── ReferenceField.tsx # Lookup / Record Picker
│   │   └── ...
│   │
│   ├── pages/                 # Page Renderers
│   │   ├── PageRenderer.tsx   # 页面分发工厂
│   │   ├── RecordPage.tsx     # 记录详情页
│   │   ├── HomePage.tsx       # 首页
│   │   └── BlankPage.tsx      # 自由画布
│   │
│   ├── dashboard/             # Dashboard Renderers
│   │   ├── DashboardRenderer.tsx
│   │   ├── ChartWidget.tsx
│   │   ├── KPICard.tsx
│   │   └── PivotTable.tsx
│   │
│   ├── actions/               # Action Execution Engine
│   │   ├── ActionRunner.tsx
│   │   └── ActionButton.tsx
│   │
│   └── theme/                 # ThemeSchema → CSS Variables
│       ├── ThemeProvider.tsx
│       └── tokens.ts
│
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 依赖关系

```
@objectstack/spec          ← 协议定义 (Zod schemas)
@objectstack/client        ← HTTP 客户端 (data + metadata API)
@objectstack/client-react  ← React hooks (useQuery, useObject, useView, ...)
         │
         ▼
@objectstack/objectui      ← UI 渲染引擎 (本 Issue 开发目标)
         │
         ▼
apps/studio                ← 开发者 IDE (导入 objectui 组件)
apps/portal                ← 终端用户业务应用 (未来)
```

---

## 实施优先级

| 阶段 | 内容 | 预估工期 | 依赖 |
|:---:|:---|:---:|:---|
| **P0** | Phase 1: DataGrid + FormRenderer + FieldRenderer (核心三件套) | 4-6 周 | spec + client-react |
| **P0** | Phase 2: AppShell + Navigation + Router | 2-3 周 | Phase 1 |
| **P1** | Phase 1 续: Kanban + Calendar + Gallery 视图 | 3-4 周 | Phase 1 |
| **P1** | Phase 3: PageRenderer + ComponentRegistry | 3-4 周 | Phase 2 |
| **P1** | Phase 4: Dashboard + Chart Widgets | 2-3 周 | Phase 1 |
| **P2** | Phase 5: Interface Builder (参见 #823) | 12-16 周 | Phase 1-4 |
| **P2** | 移动端适配 (mobileNavigation + Touch) | 3-4 周 | Phase 2 |
| **P2** | 离线模式 (OfflineConfigSchema) | 2-3 周 | Phase 1 |

**总预估**: 核心可用 (P0) = 6-9 周, 完整功能 (P0+P1) = 15-20 周

---

## 与现有 Issue 的关系

| Issue | 关系 |
|:---|:---|
| #823 Assessment: Airtable Interface Designer | Phase 5 的架构基础，Interface Builder 设计方案 |
| #1159 Studio 优化 | Studio 是设计器，ObjectUI 是渲染器，两者互补 |
| #989 统一前后端 API 查询语法 | ObjectUI 的 DataGrid 依赖 API 查询语法正确性 |
| #866 Filter operators broken | ObjectUI 的 filter/sort 功能依赖此 fix |
| #724 基础设施核心服务 | ObjectUI 的 realtime/search/notification 功能依赖 |

---

## 验收标准

- [ ] 能基于 `defineStack()` 中的 objects + views + apps 定义，**零代码**渲染出完整 CRUD 应用
- [ ] DataGrid 支持排序、筛选、分页、虚拟滚动、行选择、内联编辑
- [ ] FormRenderer 支持 simple / tabbed / wizard 布局，含字段级验证
- [ ] AppShell 支持递归侧边栏导航、Area 切换、移动端适配
- [ ] 所有 30+ 字段类型在 display / edit / filter 三种模式下均有渲染实现
- [ ] Dashboard 支持 KPI 卡片 + 图表 + 表格 Widget 组合
- [ ] 主题令牌 (ThemeSchema) 驱动所有颜色/排版/间距，支持亮/暗模式
- [ ] 完整的 TypeScript 类型推导，无 `any` 泄漏
- [ ] 组件测试覆盖率 > 60%
