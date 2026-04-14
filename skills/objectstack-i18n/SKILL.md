---
name: objectstack-i18n
description: >
  Design internationalization (i18n) strategies for ObjectStack applications.
  Use when creating multi-locale translation bundles, managing translation coverage,
  configuring locale settings, or designing object-first translation structures.
license: Apache-2.0
compatibility: Requires @objectstack/spec Zod schemas (v4+)
metadata:
  author: objectstack-ai
  version: "1.0"
  domain: system
  tags: i18n, translation, locale, internationalization, l10n
---

# Internationalization — ObjectStack I18n Protocol

Expert instructions for designing internationalization (i18n) and localization (l10n)
strategies using the ObjectStack specification. This skill covers translation bundle
structures, locale configuration, object-first translation patterns, coverage detection,
and integration with the I18nService.

---

## When to Use This Skill

- You are **configuring i18n** for a new ObjectStack project.
- You need to **create translation bundles** for multiple locales.
- You are designing **object-first translation structures** (per-object translation files).
- You need to **detect missing or stale translations** (coverage analysis).
- You are integrating **AI-powered translation suggestions**.
- You are implementing **locale-specific formatting** (dates, numbers, currency).
- You need to understand **translation file organization strategies** (bundled, per_locale, per_namespace).

---

## Core Concepts

### Translation Architecture Overview

ObjectStack follows an **object-first translation model** inspired by Salesforce and Dynamics 365:

1. **Object-First Aggregation**: All translatable content for an object (labels, fields, options, views, actions) is grouped under a single namespace: `o.{object_name}`.

2. **Global Groups**: Non-object-bound translations (apps, navigation, messages) live at the top level.

3. **Locale Files**: Each locale has its own complete translation bundle (e.g., `en.json`, `zh-CN.json`).

4. **Coverage Detection**: The system can compare translation bundles against source metadata to identify missing, redundant, or stale entries.

---

## Translation Configuration

### Stack-Level I18n Config

Configure i18n settings in your `objectstack.config.ts`:

```typescript
import { defineStack } from '@objectstack/spec';

export default defineStack({
  i18n: {
    defaultLocale: 'en',
    supportedLocales: ['en', 'zh-CN', 'ja-JP', 'es-ES'],
    fallbackLocale: 'en',
    fileOrganization: 'per_locale',
    messageFormat: 'simple',      // or 'icu' for complex plurals
    lazyLoad: false,
    cache: true,
  },
});
```

| Property | Type | Default | Description |
|:---------|:-----|:--------|:------------|
| `defaultLocale` | `string` | `'en'` | Default BCP-47 locale code |
| `supportedLocales` | `string[]` | `['en']` | All supported locales |
| `fallbackLocale` | `string` | same as `defaultLocale` | Fallback when translation missing |
| `fileOrganization` | `'bundled'` \| `'per_locale'` \| `'per_namespace'` | `'per_locale'` | How translation files are organized |
| `messageFormat` | `'simple'` \| `'icu'` | `'simple'` | Interpolation format (ICU for plurals/gender) |
| `lazyLoad` | `boolean` | `false` | Load translations on demand |
| `cache` | `boolean` | `true` | Cache loaded translations in memory |

> **BCP-47 Locale Codes**: Use standard locale tags (e.g., `en-US`, `zh-CN`, `pt-BR`, `en-GB`).

---

## File Organization Strategies

### 1. Bundled (Single File)

All locales in one file. Best for small projects with few objects.

```
src/translations/
  crm.translation.ts        # { en: {...}, "zh-CN": {...} }
```

**When to use:** Fewer than 5 objects, 2-3 locales, < 200 translation keys total.

### 2. Per-Locale (Recommended)

One file per locale containing all namespaces. Recommended when a single locale file stays under ~500 lines.

```
src/translations/
  en.ts                     # TranslationData for English
  zh-CN.ts                  # TranslationData for Chinese
  ja-JP.ts                  # TranslationData for Japanese
```

**When to use:** Medium projects (5-20 objects), 3-5 locales, organized by language.

### 3. Per-Namespace (Enterprise)

One file per namespace (object) per locale. Recommended for large projects with many objects/languages. Aligns with Salesforce DX and ServiceNow conventions.

```
i18n/
  en/
    account.json            # ObjectTranslationData
    contact.json
    project_task.json
    common.json             # messages + app labels
  zh-CN/
    account.json
    contact.json
    project_task.json
    common.json
```

**When to use:** Large projects (20+ objects), 5+ locales, team collaboration, CI/CD pipelines.

---

## Object-First Translation Bundle

### AppTranslationBundle Structure

The `AppTranslationBundle` is the canonical format for a single locale:

```typescript
const zh: AppTranslationBundle = {
  _meta: {
    locale: 'zh-CN',
    direction: 'ltr',
  },

  // Object-first translations
  o: {
    account: {
      label: '客户',
      pluralLabel: '客户',
      description: '客户管理对象',
      fields: {
        name: { label: '客户名称', help: '公司或组织的法定名称' },
        industry: {
          label: '行业',
          options: { tech: '科技', finance: '金融', retail: '零售' }
        },
        website: { label: '网站', placeholder: '输入网站地址' },
      },
      _options: {
        status: { active: '活跃', inactive: '停用' },
      },
      _views: {
        all_accounts: { label: '全部客户' },
        my_accounts: { label: '我的客户' },
      },
      _sections: {
        basic_info: { label: '基本信息' },
        contact_info: { label: '联系方式' },
      },
      _actions: {
        convert_lead: { label: '转换线索', confirmMessage: '确认转换为客户？' },
        merge: { label: '合并客户', confirmMessage: '此操作无法撤销，确认合并？' },
      },
    },
  },

  // Global picklist options (not object-specific)
  _globalOptions: {
    currency: { usd: '美元', eur: '欧元', cny: '人民币' },
  },

  // App-level translations
  app: {
    crm: { label: '客户关系管理', description: '管理销售流程' },
    helpdesk: { label: '服务台', description: '客户支持系统' },
  },

  // Navigation menu
  nav: {
    home: '首页',
    settings: '设置',
    reports: '报表',
    admin: '管理',
  },

  // Dashboard translations
  dashboard: {
    sales_overview: { label: '销售概览', description: '销售漏斗与目标' },
  },

  // Report translations
  reports: {
    pipeline_report: { label: '管道报表' },
  },

  // Page translations
  pages: {
    landing: { title: '欢迎', description: '开始使用 ObjectStack' },
  },

  // UI messages (supports ICU MessageFormat if enabled)
  messages: {
    'common.save': '保存',
    'common.cancel': '取消',
    'common.delete': '删除',
    'common.confirm': '确认',
    'validation.required': '此字段为必填项',
    'pagination.showing': '显示 {start} 到 {end}，共 {total} 条',
  },

  // Validation error messages
  validationMessages: {
    discount_limit: '折扣不能超过40%',
    end_date_after_start: '结束日期必须晚于开始日期',
  },

  // Global notifications
  notifications: {
    record_created: { title: '创建成功', body: '记录已创建' },
  },

  // Global error messages
  errors: {
    'ERR_NETWORK': '网络连接失败',
    'ERR_PERMISSION': '权限不足',
  },
};
```

---

## Object-Level Translation Structure

### ObjectTranslationNode

All translatable content for a single object is aggregated under `o.{object_name}`:

```typescript
interface ObjectTranslationNode {
  /** Singular label */
  label: string;
  /** Plural label */
  pluralLabel?: string;
  /** Description */
  description?: string;
  /** Help text */
  helpText?: string;

  /** Field translations */
  fields?: Record<string, FieldTranslation>;

  /** Object-scoped picklist options */
  _options?: Record<string, Record<string, string>>;

  /** View translations */
  _views?: Record<string, { label?: string; description?: string }>;

  /** Section translations (form tabs/sections) */
  _sections?: Record<string, { label?: string }>;

  /** Action translations */
  _actions?: Record<string, { label?: string; confirmMessage?: string }>;

  /** Notification translations */
  _notifications?: Record<string, { title?: string; body?: string }>;

  /** Error message translations */
  _errors?: Record<string, string>;
}
```

### FieldTranslation

```typescript
interface FieldTranslation {
  /** Translated field label */
  label?: string;
  /** Help text */
  help?: string;
  /** Placeholder text for form inputs */
  placeholder?: string;
  /** Option value → translated label map */
  options?: Record<string, string>;
}
```

---

## Naming Conventions

| Context | Convention | Example |
|:--------|:-----------|:--------|
| Locale codes | BCP-47 | `en`, `en-US`, `zh-CN`, `pt-BR` |
| Object keys in `o.*` | `snake_case` | `o.project_task`, `o.support_case` |
| Field keys | `snake_case` | `fields.first_name`, `fields.due_date` |
| Option values | lowercase | `options.status.in_progress` |
| Message keys | dot-separated | `common.save`, `validation.required` |

> **Critical:** Object names and field keys in translation bundles **must** match the `snake_case` names defined in your Object and Field schemas.

---

## Translation Coverage & Diff Detection

### Coverage Analysis

The `II18nService.getCoverage()` method compares a translation bundle against source metadata to detect:

1. **Missing** — Keys that exist in metadata but not in the translation bundle
2. **Redundant** — Keys in the bundle that have no matching metadata
3. **Stale** — Keys where the source metadata has changed since translation

```typescript
const coverage = i18nService.getCoverage('zh-CN', 'account');

console.log(coverage);
// {
//   locale: 'zh-CN',
//   objectName: 'account',
//   totalKeys: 120,
//   translatedKeys: 105,
//   missingKeys: 12,
//   redundantKeys: 3,
//   staleKeys: 0,
//   coveragePercent: 87.5,
//   items: [
//     { key: 'o.account.fields.website.label', status: 'missing', locale: 'zh-CN' },
//     ...
//   ],
//   breakdown: [
//     { group: 'fields', totalKeys: 45, translatedKeys: 40, coveragePercent: 88.9 },
//     { group: 'views', totalKeys: 8, translatedKeys: 8, coveragePercent: 100 },
//   ],
// }
```

### TranslationDiffItem

```typescript
interface TranslationDiffItem {
  /** Dot-path translation key */
  key: string;
  /** Diff status: 'missing' | 'redundant' | 'stale' */
  status: 'missing' | 'redundant' | 'stale';
  /** Object name (if applicable) */
  objectName?: string;
  /** Locale code */
  locale: string;
  /** Hash of source metadata for stale detection */
  sourceHash?: string;
  /** AI-suggested translation */
  aiSuggested?: string;
  /** AI confidence score (0-1) */
  aiConfidence?: number;
}
```

---

## AI-Powered Translation Suggestions

### Using suggestTranslations()

The `II18nService.suggestTranslations()` method enriches diff items with AI-generated translations:

```typescript
const missingItems = coverage.items.filter(item => item.status === 'missing');

const suggestions = await i18nService.suggestTranslations('zh-CN', missingItems);

suggestions.forEach(item => {
  console.log(`${item.key}: ${item.aiSuggested} (confidence: ${item.aiConfidence})`);
  // o.account.fields.website.label: 网站 (confidence: 0.95)
});
```

> **Best Practice:** AI suggestions work best when:
> - You provide source locale context (e.g., English labels)
> - You include domain-specific glossaries
> - You review and approve suggestions before committing

---

## Message Interpolation

### Simple Format (Default)

Use `{variable}` placeholders:

```json
{
  "messages": {
    "welcome": "Welcome, {userName}!",
    "pagination": "Showing {start} to {end} of {total} items"
  }
}
```

Usage:
```typescript
i18n.t('messages.welcome', 'en', { userName: 'Alice' });
// "Welcome, Alice!"
```

### ICU MessageFormat

For complex pluralization, gender, and select:

```typescript
// Enable in stack config
i18n: { messageFormat: 'icu' }
```

```json
{
  "messages": {
    "inbox": "{count, plural, =0 {No messages} one {1 message} other {# messages}}",
    "gender": "{gender, select, male {He} female {She} other {They}} replied"
  }
}
```

> **When to use ICU:**
> - Languages with complex plural rules (Arabic, Slavic languages)
> - Gender-aware translations
> - Ordinal numbers (1st, 2nd, 3rd)
> - Date/time/number formatting

---

## Integration with II18nService

### Service Contract

```typescript
interface II18nService {
  /** Translate a key */
  t(key: string, locale: string, params?: Record<string, unknown>): string;

  /** Get all translations for a locale */
  getTranslations(locale: string): Record<string, unknown>;

  /** Load translations */
  loadTranslations(locale: string, translations: Record<string, unknown>): void;

  /** List available locales */
  getLocales(): string[];

  /** Get default locale */
  getDefaultLocale?(): string;

  /** Set default locale */
  setDefaultLocale?(locale: string): void;

  /** Get object-first bundle */
  getAppBundle?(locale: string): AppTranslationBundle | undefined;

  /** Load object-first bundle */
  loadAppBundle?(locale: string, bundle: AppTranslationBundle): void;

  /** Get coverage analysis */
  getCoverage?(locale: string, objectName?: string): TranslationCoverageResult;

  /** AI-powered suggestions */
  suggestTranslations?(
    locale: string,
    items: TranslationDiffItem[]
  ): Promise<TranslationDiffItem[]>;
}
```

### Plugin Setup

```typescript
import { ObjectKernel } from '@objectstack/core';
import { I18nServicePlugin } from '@objectstack/service-i18n';

const kernel = new ObjectKernel();
kernel.use(new I18nServicePlugin({
  defaultLocale: 'en',
  localesDir: './i18n',
  fallbackLocale: 'en',
  registerRoutes: true,  // Auto-register REST endpoints
  basePath: '/api/v1/i18n',
}));

await kernel.bootstrap();

const i18n = kernel.getService<II18nService>('i18n');
```

---

## Translation Workflow Best Practices

### 1. Extract Keys from Metadata

Use the CLI or API to extract all translatable keys from your metadata:

```bash
objectstack i18n extract --locale zh-CN --output i18n/zh-CN.json
```

This generates a skeleton bundle with all required keys.

### 2. Translate

Fill in the translations manually, or use AI suggestions:

```bash
objectstack i18n suggest --locale zh-CN --input i18n/zh-CN.json
```

### 3. Validate Coverage

Run coverage analysis to detect missing or stale translations:

```bash
objectstack i18n coverage --locale zh-CN
```

### 4. Commit & Deploy

Commit translation files to version control. ObjectStack automatically loads them at runtime.

---

## Advanced Patterns

### Namespace Isolation (Multi-Plugin)

When multiple plugins contribute translations, use namespaces to avoid collisions:

```typescript
const crmBundle: AppTranslationBundle = {
  namespace: 'crm',
  o: {
    account: { label: '客户' },
  },
};

const helpdeskBundle: AppTranslationBundle = {
  namespace: 'helpdesk',
  o: {
    ticket: { label: '工单' },
  },
};
```

Keys are prefixed: `crm.o.account.label`, `helpdesk.o.ticket.label`.

### Right-to-Left (RTL) Support

```typescript
const ar: AppTranslationBundle = {
  _meta: {
    locale: 'ar',
    direction: 'rtl',
  },
  o: {
    account: { label: 'حساب' },
  },
};
```

UI frameworks can use `_meta.direction` to apply RTL CSS.

### Translation Memory Integration

Implement custom `II18nService.suggestTranslations()` to integrate with:
- Translation Management Systems (TMS) like Phrase, Crowdin, Lokalise
- Machine translation APIs (Google Translate, DeepL)
- Internal translation memory databases

---

## Common Pitfalls

### ❌ Mismatched Object Names

Translation keys must match metadata exactly:

```typescript
// Metadata
{ name: 'project_task' }

// Translation (WRONG)
{ o: { projectTask: { label: '项目任务' } } }

// Translation (CORRECT)
{ o: { project_task: { label: '项目任务' } } }
```

### ❌ Hardcoded Option Values

Always use lowercase machine values for options:

```typescript
// Metadata
options: [
  { value: 'in_progress', label: 'In Progress' },
]

// Translation (WRONG)
options: { 'In Progress': '进行中' }

// Translation (CORRECT)
options: { in_progress: '进行中' }
```

### ❌ Ignoring Coverage Reports

Stale translations can cause confusion. Always run coverage analysis before releases.

---

## Quick-Start Template

```typescript
// i18n/zh-CN.ts
import type { AppTranslationBundle } from '@objectstack/spec';

export default {
  _meta: {
    locale: 'zh-CN',
    direction: 'ltr',
  },

  o: {
    account: {
      label: '客户',
      pluralLabel: '客户',
      fields: {
        name: { label: '客户名称' },
        email: { label: '邮箱', placeholder: '输入邮箱地址' },
        status: {
          label: '状态',
          options: {
            active: '活跃',
            inactive: '停用',
          },
        },
      },
      _views: {
        all_accounts: { label: '全部客户' },
      },
    },
  },

  app: {
    crm: { label: '客户关系管理' },
  },

  nav: {
    home: '首页',
    settings: '设置',
  },

  messages: {
    'common.save': '保存',
    'common.cancel': '取消',
  },
} satisfies AppTranslationBundle;
```

---

## References

- [translation.zod.ts](./references/system/translation.zod.ts) — Translation schemas (AppTranslationBundle, ObjectTranslationNode, Coverage, Diff)
- [i18n-service.ts](./references/contracts/i18n-service.ts) — II18nService interface contract
- [i18n.zod.ts](./references/ui/i18n.zod.ts) — UI-level i18n object schema
- [Schema index](./references/_index.md) — All bundled schemas

---

## See Also

- **objectstack-schema** — For understanding object and field metadata structure
- **objectstack-ui** — For view, app, and action translations
- **objectstack-automation** — For workflow and flow message translations
