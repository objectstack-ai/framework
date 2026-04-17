## 概述

本 Issue 汇总基于 ObjectUI (`objectstack-ai/objectui`) 开发完整 ObjectStack 前端界面的集成方案。

**关键认知：ObjectUI 已经是一个成熟的 30+ 包的 monorepo 项目**，核心组件（Grid、Form、Kanban、Calendar、Gantt、Dashboard、Designer 等）已全部开发完成。本项目（`objectstack-ai/framework`）的任务是 **集成和消费** ObjectUI 的包，而非从零重建。

### 两个仓库的关系

```
objectstack-ai/objectui   (MIT, 独立仓库)
  └── 30+ @object-ui/* packages  → 渲染引擎、字段、视图插件、App Shell
  └── @object-ui/data-objectstack → 已内置 @objectstack/client 数据适配器
  └── apps/console               → 完整的业务控制台应用

objectstack-ai/framework  (本仓库)
  └── @objectstack/spec          → 协议定义 (Zod schemas)
  └── @objectstack/client        → HTTP 客户端
  └── @objectstack/client-react  → React hooks
  └── apps/studio                → 开发者 IDE (元数据设计器)
  └── apps/server                → 生产服务器
```

### 核心原则

> **不重复造轮子**：ObjectUI 的 `@object-ui/*` 包已经实现了所有 UI 组件。
> 本项目的任务是做好 **集成层**（桥接 `@objectstack/spec` 协议 ↔ `@object-ui/*` 渲染）。

---

## ObjectUI 已完成的包清单

### ✅ 核心包（已稳定）

| 包名 | 版本 | 职责 |
|:---|:---:|:---|
| `@object-ui/types` | 3.3.0 | TypeScript 类型定义 & 协议规范 |
| `@object-ui/core` | 3.3.0 | 核心逻辑、验证、注册中心、表达式引擎（零 React 依赖） |
| `@object-ui/react` | 3.3.0 | React 绑定 & `<SchemaRenderer>` |
| `@object-ui/components` | 3.3.0 | 标准 UI 组件库（Tailwind + Shadcn） |
| `@object-ui/fields` | 3.3.0 | 字段渲染器 & 注册中心（30+ 字段类型） |
| `@object-ui/layout` | 3.3.0 | 布局组件 + React Router 集成 |
| `@object-ui/app-shell` | 3.3.0 | App Shell 框架（侧边栏 + 头部 + 内容区） |
| `@object-ui/providers` | 3.3.0 | Theme / DataSource / Auth 上下文 Provider |
| `@object-ui/i18n` | 3.3.0 | 国际化 |
| `@object-ui/auth` | 3.3.0 | 认证 UI |
| `@object-ui/permissions` | 3.3.0 | 权限控制 UI |
| `@object-ui/tenant` | 3.3.0 | 多租户 UI |
| `@object-ui/mobile` | 3.3.0 | 移动端优化组件 |
| `@object-ui/collaboration` | 3.3.0 | 协作功能 |

### ✅ 数据适配器

| 包名 | 职责 |
|:---|:---|
| `@object-ui/data-objectstack` | **ObjectStack 数据适配器**（内置 `@objectstack/client`，连接框架 REST API） |

### ✅ 视图插件（全部已实现）

| 包名 | 对应 Spec ViewSchema.type | 状态 |
|:---|:---|:---:|
| `@object-ui/plugin-grid` | `grid` (TanStack Table) | ✅ |
| `@object-ui/plugin-aggrid` | `grid` (AG Grid 高级版) | ✅ |
| `@object-ui/plugin-kanban` | `kanban` (dnd-kit) | ✅ |
| `@object-ui/plugin-calendar` | `calendar` | ✅ |
| `@object-ui/plugin-gantt` | `gantt` | ✅ |
| `@object-ui/plugin-timeline` | `timeline` | ✅ |
| `@object-ui/plugin-map` | `map` | ✅ |
| `@object-ui/plugin-list` | `list` | ✅ |
| `@object-ui/plugin-form` | `form` (高级表单) | ✅ |
| `@object-ui/plugin-detail` | 记录详情页 | ✅ |
| `@object-ui/plugin-view` | ObjectQL 集成视图 | ✅ |

### ✅ 功能插件

| 包名 | 职责 | 状态 |
|:---|:---|:---:|
| `@object-ui/plugin-charts` | 图表 (Recharts) | ✅ |
| `@object-ui/plugin-dashboard` | Dashboard 布局 & Widgets | ✅ |
| `@object-ui/plugin-designer` | 可视化设计器 (beta) | ✅ |
| `@object-ui/plugin-chatbot` | AI 聊天机器人界面 | ✅ |
| `@object-ui/plugin-editor` | 富文本编辑器 (Monaco) | ✅ |
| `@object-ui/plugin-markdown` | Markdown 渲染 | ✅ |
| `@object-ui/plugin-report` | 报表生成器 | ✅ |
| `@object-ui/plugin-workflow` | 工作流设计器 | ✅ |

### ✅ 工具 & CLI

| 包名 | 职责 |
|:---|:---|
| `@object-ui/cli` | CLI 工具（init、serve、generate） |
| `@object-ui/runner` | 通用应用运行器 |
| `@object-ui/create-plugin` | 插件脚手架 |
| `@object-ui/vscode-extension` | VS Code 扩展（IntelliSense + 实时预览） |

---

## 本项目（framework）需要做什么

既然 ObjectUI 已完成所有 UI 组件，本项目的工作重心是 **集成层** 和 **部署层**：

### Phase 1: 依赖集成 — 将 ObjectUI 引入 framework 生态 🔴 P0

> **目标**：让 `apps/studio` 和 `apps/server` 能正确消费 `@object-ui/*` 包

| # | 任务 | 描述 |
|:---:|:---|:---|
| 1.1 | **添加 `@object-ui/*` 依赖到 framework** | 在 `apps/studio/package.json` 和 `apps/server/package.json` 中添加 `@object-ui/app-shell`、`@object-ui/data-objectstack`、`@object-ui/providers` 等依赖 |
| 1.2 | **配置 `@object-ui/data-objectstack` 适配器** | 确保它正确使用 `@objectstack/client` 连接框架 REST API（`/api/v1/data/*`、`/api/v1/meta/*`） |
| 1.3 | **Spec 协议对齐验证** | 验证 `@object-ui/types` 与 `@objectstack/spec` 的 schema 定义一致性（ViewSchema、AppSchema、PageSchema 等） |
| 1.4 | **Vite 别名 & 构建配置** | 确保 `@object-ui/*` 包在 Vite 构建中正确解析（参考 studio 现有 alias 配置） |

### Phase 2: Studio 集成 — 用 ObjectUI 增强开发者体验 🔴 P0

> **目标**：在 Studio 中嵌入 ObjectUI 的设计器和预览功能

| # | 任务 | 描述 |
|:---:|:---|:---|
| 2.1 | **Studio 预览面板** | 嵌入 `<SchemaRenderer>` 实现"设计时即预览"——编辑 ViewSchema JSON 时实时渲染 ObjectUI 组件 |
| 2.2 | **View Designer 集成** | 嵌入 `@object-ui/plugin-designer` 实现可视化 View 编辑器 |
| 2.3 | **Dashboard Designer** | 嵌入 `@object-ui/plugin-dashboard` 实现 Dashboard 可视化编辑 |
| 2.4 | **Flow Designer** | 嵌入 `@object-ui/plugin-workflow` 实现工作流可视化设计 |

### Phase 3: 终端用户应用 — 基于 ObjectUI Console 构建 apps/portal 🟡 P1

> **目标**：创建面向终端用户的业务应用入口

| # | 任务 | 描述 |
|:---:|:---|:---|
| 3.1 | **创建 `apps/portal`** | 基于 `@object-ui/app-shell` + `@object-ui/providers` + `@object-ui/data-objectstack` 组合搭建终端用户应用 |
| 3.2 | **AppShell 路由配置** | 使用 `@object-ui/layout` 实现路由：`/app/:appName/object/:objectName`、`/app/:appName/dashboard/:name` 等 |
| 3.3 | **插件按需加载** | 仅注册需要的视图插件（Grid、Kanban、Calendar 等），利用 ObjectUI 的 lazy-load 机制减小包体积 |
| 3.4 | **Authentication 集成** | 使用 `@object-ui/auth` + `@objectstack/plugin-auth` 实现登录/注册/会话管理 |
| 3.5 | **多租户支持** | 使用 `@object-ui/tenant` 实现租户切换 UI |

### Phase 4: 部署 & 打包 🟡 P1

> **目标**：确保 ObjectUI 应用能在所有 ObjectStack 部署模式下运行

| # | 任务 | 描述 |
|:---:|:---|:---|
| 4.1 | **CLI 嵌入模式** | 类似 `apps/studio` 的 `/_studio/` 挂载方式，将 Portal 构建产物挂载到 `/_portal/` 或 `/app/` |
| 4.2 | **Vercel 部署** | 更新 `apps/server/vercel.json` 和 build 脚本，支持同时部署 Studio + Portal |
| 4.3 | **MSW 开发模式** | 利用 `@objectstack/plugin-msw` 支持纯前端开发模式（无需后端服务器） |
| 4.4 | **Server 静态托管** | 从 `apps/server` 同时托管 Studio（`/_studio/`）和 Portal（`/app/`）静态文件 |

### Phase 5: 协议完善 — 确保 Spec ↔ ObjectUI 100% 对齐 🟢 P2

> **目标**：持续对齐两个仓库的协议定义

| # | 任务 | 描述 |
|:---:|:---|:---|
| 5.1 | **Spec 版本对齐** | 确保 `@objectstack/spec` 的 UI schemas 与 `@object-ui/types` 100% 兼容 |
| 5.2 | **新字段类型同步** | 当 Spec 新增字段类型时，确认 `@object-ui/fields` 已有对应渲染器 |
| 5.3 | **Action 协议对齐** | 确认 `@object-ui/core` 的 Action 引擎支持 `@objectstack/spec` ActionSchema 的所有 type |
| 5.4 | **Theme 协议对齐** | 确认 `@object-ui/providers` ThemeProvider 支持 `@objectstack/spec` ThemeSchema 的所有令牌 |

---

## 使用方式参考

### 最简集成（~100 行代码）

ObjectUI 的 `examples/minimal-console` 展示了最小集成方案：

```typescript
import { AppShell, ObjectRenderer } from '@object-ui/app-shell';
import { ThemeProvider, DataSourceProvider } from '@object-ui/providers';
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

// 创建 ObjectStack 数据适配器（连接 framework 的 REST API）
const dataSource = createObjectStackAdapter({
  baseUrl: 'http://localhost:3000',  // ObjectStack server 地址
  token: 'your-auth-token'
});

function MyApp() {
  return (
    <ThemeProvider>
      <DataSourceProvider dataSource={dataSource}>
        <AppShell sidebar={<MySidebar />}>
          <ObjectRenderer objectName="contact" />
        </AppShell>
      </DataSourceProvider>
    </ThemeProvider>
  );
}
```

### 完整业务应用

```typescript
import { AppShell } from '@object-ui/app-shell';
import { ThemeProvider, DataSourceProvider } from '@object-ui/providers';
import { registerField } from '@object-ui/fields';
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

// 1. 创建数据适配器
const dataSource = createObjectStackAdapter({ baseUrl: '/api/v1' });

// 2. 按需注册字段类型（Lazy Field Registration，减小 30-50% 包体积）
registerField('text');
registerField('number');
registerField('date');
registerField('select');
registerField('reference');

// 3. 按需注册视图插件
import '@object-ui/plugin-grid';
import '@object-ui/plugin-kanban';
import '@object-ui/plugin-form';
import '@object-ui/plugin-dashboard';
import '@object-ui/plugin-charts';

// 4. 组装应用
function App() {
  return (
    <ThemeProvider>
      <DataSourceProvider dataSource={dataSource}>
        <AppShell>
          {/* ObjectUI 自动根据 metadata 渲染界面 */}
        </AppShell>
      </DataSourceProvider>
    </ThemeProvider>
  );
}
```

---

## 依赖关系图（更正版）

```
objectstack-ai/objectui 仓库 (MIT)
  @object-ui/core          ← 渲染引擎核心（表达式、验证、注册中心）
  @object-ui/react         ← SchemaRenderer
  @object-ui/components    ← Shadcn UI 组件库
  @object-ui/fields        ← 30+ 字段渲染器
  @object-ui/app-shell     ← App Shell 框架
  @object-ui/providers     ← Theme / DataSource Provider
  @object-ui/plugin-*      ← 视图插件（grid/kanban/calendar/gantt/dashboard/...）
  @object-ui/data-objectstack ← 数据适配器（使用 @objectstack/client）
         │
         │ npm install（已发布到 npm / 或 workspace link）
         ▼
objectstack-ai/framework 仓库 (本项目)
  @objectstack/spec        ← 协议定义（被 @object-ui/core 依赖）
  @objectstack/client      ← HTTP 客户端（被 @object-ui/data-objectstack 依赖）
  @objectstack/client-react← React hooks（可与 @object-ui/react 互补使用）
  apps/studio              ← 开发者 IDE（嵌入 @object-ui/plugin-designer 作为预览）
  apps/server              ← 生产服务器（托管 Portal 静态文件）
  apps/portal (新建)       ← 终端用户应用（基于 @object-ui/app-shell 搭建）
```

---

## 实施优先级（更正版）

| 阶段 | 内容 | 预估工期 | 说明 |
|:---:|:---|:---:|:---|
| **P0** | Phase 1: 依赖集成 + 协议对齐验证 | 1-2 周 | 纯配置工作，确保包能正确引入 |
| **P0** | Phase 2: Studio 预览面板 | 2-3 周 | 嵌入 SchemaRenderer 到 Studio |
| **P1** | Phase 3: 创建 apps/portal | 3-4 周 | 搭建终端用户应用框架 |
| **P1** | Phase 4: 部署 & 打包 | 1-2 周 | CLI 嵌入 + Vercel 部署 |
| **P2** | Phase 5: 持续协议对齐 | 持续 | 随 Spec 版本迭代同步 |

**总预估**: 核心可用 (P0) = **3-5 周**, 完整功能 (P0+P1) = **7-11 周**

> ⚡ 对比旧方案（从零构建）的 15-20 周，集成方案节省 **50-65%** 的开发时间。

---

## 与现有 Issue 的关系

| Issue | 关系 |
|:---|:---|
| #823 Assessment: Airtable Interface Designer | ObjectUI `plugin-designer` 已实现 beta 版，可直接集成 |
| #1159 Studio 优化 | Studio 嵌入 ObjectUI 组件是优化的关键路径 |
| #989 统一前后端 API 查询语法 | `@object-ui/data-objectstack` 适配器依赖查询语法正确性 |
| #866 Filter operators broken | 影响 ObjectUI plugin-grid 的筛选功能 |
| #724 基础设施核心服务 | ObjectUI 的 realtime/collaboration 功能依赖 |

---

## 验收标准

- [ ] `@object-ui/data-objectstack` 能正确连接 `@objectstack/client` REST API，完成 CRUD 操作
- [ ] `apps/studio` 能嵌入 `<SchemaRenderer>` 实时预览 View 定义
- [ ] `apps/portal` 能基于 `defineStack()` 中的 objects + views + apps 定义，渲染完整业务应用
- [ ] ObjectUI 的所有视图插件（Grid、Kanban、Calendar、Gantt、Dashboard 等）在 Portal 中正常工作
- [ ] `@objectstack/spec` ViewSchema ↔ `@object-ui/types` 100% 类型兼容
- [ ] Portal 可通过 CLI `--portal` 参数嵌入服务，或通过 Vercel 独立部署
- [ ] 包体积 < 100KB（利用 ObjectUI 的 lazy-load 按需加载机制）
