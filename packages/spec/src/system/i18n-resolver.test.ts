// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { ObjectTranslationDataSchema, TranslationDataSchema, type TranslationBundle } from './translation.zod';
import {
  resolveViewLabel,
  resolveViewDescription,
  resolveActionLabel,
  resolveActionConfirm,
  resolveActionSuccess,
  translateMetadataDocument,
} from './i18n-resolver';

describe('ObjectTranslationDataSchema (_views/_actions extensions)', () => {
  it('accepts _views entries', () => {
    const data = ObjectTranslationDataSchema.parse({
      label: '客户',
      _views: {
        all_accounts: { label: '全部客户', description: '所有客户列表' },
        my_accounts: { label: '我的客户' },
      },
    });
    expect(data._views?.all_accounts.label).toBe('全部客户');
    expect(data._views?.all_accounts.description).toBe('所有客户列表');
    expect(data._views?.my_accounts.label).toBe('我的客户');
  });

  it('accepts _actions entries with confirm + success', () => {
    const data = ObjectTranslationDataSchema.parse({
      label: '线索',
      _actions: {
        convert_lead: {
          label: '转化线索',
          confirmText: '确定要转化此线索吗？',
          successMessage: '线索转化成功！',
        },
      },
    });
    expect(data._actions?.convert_lead.label).toBe('转化线索');
    expect(data._actions?.convert_lead.confirmText).toBe('确定要转化此线索吗？');
    expect(data._actions?.convert_lead.successMessage).toBe('线索转化成功！');
  });
});

describe('TranslationDataSchema globalActions', () => {
  it('accepts globalActions', () => {
    const data = TranslationDataSchema.parse({
      globalActions: {
        log_call: { label: '记录通话', successMessage: '通话已记录！' },
        export_csv: { label: '导出 CSV' },
      },
    });
    expect(data.globalActions?.log_call.label).toBe('记录通话');
    expect(data.globalActions?.export_csv.label).toBe('导出 CSV');
  });
});

const bundle: TranslationBundle = {
  en: {
    objects: {
      account: {
        label: 'Account',
        _views: {
          all_accounts: { label: 'All Accounts', description: 'Every account' },
        },
        _actions: {
          merge_accounts: {
            label: 'Merge Accounts',
            confirmText: 'Merge selected accounts?',
            successMessage: 'Accounts merged.',
          },
        },
      },
    },
    globalActions: {
      export_csv: { label: 'Export CSV', successMessage: 'Export ready.' },
    },
  },
  'zh-CN': {
    objects: {
      account: {
        label: '客户',
        _views: { all_accounts: { label: '全部客户', description: '所有客户' } },
        _actions: {
          merge_accounts: {
            label: '合并客户',
            confirmText: '确认合并选中的客户？',
            successMessage: '客户已合并。',
          },
        },
      },
    },
    globalActions: {
      export_csv: { label: '导出 CSV', successMessage: '导出完成。' },
    },
  },
};

describe('resolveViewLabel', () => {
  it('returns translated label for the active locale', () => {
    expect(
      resolveViewLabel(
        bundle,
        { name: 'all_accounts', label: 'All Accounts', objectName: 'account' },
        { locale: 'zh-CN' },
      ),
    ).toBe('全部客户');
  });

  it('falls back through fallbackChain to en', () => {
    expect(
      resolveViewLabel(
        bundle,
        { name: 'all_accounts', label: 'All Accounts', objectName: 'account' },
        { locale: 'fr-FR', fallbackChain: ['en'] },
      ),
    ).toBe('All Accounts');
  });

  it('falls back to literal label when no bundle entry exists', () => {
    expect(
      resolveViewLabel(
        bundle,
        { name: 'unknown_view', label: 'Unknown View', objectName: 'account' },
        { locale: 'zh-CN' },
      ),
    ).toBe('Unknown View');
  });

  it('uses data.object when objectName is missing', () => {
    expect(
      resolveViewLabel(
        bundle,
        { name: 'all_accounts', label: 'All Accounts', data: { object: 'account' } },
        { locale: 'zh-CN' },
      ),
    ).toBe('全部客户');
  });

  it('returns label when bundle is undefined', () => {
    expect(
      resolveViewLabel(undefined, {
        name: 'all_accounts',
        label: 'All Accounts',
        objectName: 'account',
      }),
    ).toBe('All Accounts');
  });
});

describe('resolveViewDescription', () => {
  it('returns translated description', () => {
    expect(
      resolveViewDescription(
        bundle,
        { name: 'all_accounts', objectName: 'account' },
        { locale: 'zh-CN' },
      ),
    ).toBe('所有客户');
  });

  it('falls back to literal description', () => {
    expect(
      resolveViewDescription(
        bundle,
        { name: 'unknown', objectName: 'account', description: 'literal' },
        { locale: 'zh-CN' },
      ),
    ).toBe('literal');
  });
});

describe('resolveActionLabel + confirm + success', () => {
  it('translates an object-bound action', () => {
    const action = {
      name: 'merge_accounts',
      label: 'Merge Accounts',
      objectName: 'account',
      confirmText: 'Merge selected accounts?',
      successMessage: 'Accounts merged.',
    };
    expect(resolveActionLabel(bundle, action, { locale: 'zh-CN' })).toBe('合并客户');
    expect(resolveActionConfirm(bundle, action, { locale: 'zh-CN' })).toBe(
      '确认合并选中的客户？',
    );
    expect(resolveActionSuccess(bundle, action, { locale: 'zh-CN' })).toBe('客户已合并。');
  });

  it('falls back to globalActions for object-less actions', () => {
    const action = {
      name: 'export_csv',
      label: 'Export to CSV',
      successMessage: 'Export completed!',
    };
    expect(resolveActionLabel(bundle, action, { locale: 'zh-CN' })).toBe('导出 CSV');
    expect(resolveActionSuccess(bundle, action, { locale: 'zh-CN' })).toBe('导出完成。');
    expect(resolveActionConfirm(bundle, action, { locale: 'zh-CN' })).toBeUndefined();
  });

  it('returns the literal label when no bundle entry matches', () => {
    expect(
      resolveActionLabel(
        bundle,
        { name: 'unknown_action', label: 'Mystery', objectName: 'account' },
        { locale: 'zh-CN' },
      ),
    ).toBe('Mystery');
  });

  it('returns the action name when neither bundle nor literal label exists', () => {
    expect(
      resolveActionLabel(undefined, { name: 'nameless_action' }),
    ).toBe('nameless_action');
  });
});

describe('translateMetadataDocument', () => {
  it('translates a view document', () => {
    const view = {
      name: 'all_accounts',
      label: 'All Accounts',
      description: 'Every account',
      objectName: 'account',
      kind: 'list',
    };
    const out = translateMetadataDocument('view', view, bundle, { locale: 'zh-CN' });
    expect(out.label).toBe('全部客户');
    expect(out.description).toBe('所有客户');
    expect(out.kind).toBe('list');
    expect(view.label).toBe('All Accounts'); // not mutated
  });

  it('translates an action document with confirm + success', () => {
    const action = {
      name: 'merge_accounts',
      label: 'Merge Accounts',
      objectName: 'account',
      confirmText: 'Merge selected accounts?',
      successMessage: 'Accounts merged.',
    };
    const out = translateMetadataDocument('action', action, bundle, { locale: 'zh-CN' });
    expect(out.label).toBe('合并客户');
    expect(out.confirmText).toBe('确认合并选中的客户？');
    expect(out.successMessage).toBe('客户已合并。');
  });

  it('returns unknown types unchanged', () => {
    const doc = { name: 'foo', label: 'Bar' };
    const out = translateMetadataDocument('mystery', doc, bundle, { locale: 'zh-CN' });
    expect(out).toBe(doc);
  });

  it('returns literal labels when bundle is undefined', () => {
    const view = { name: 'all_accounts', label: 'All Accounts', objectName: 'account' };
    const out = translateMetadataDocument('view', view, undefined, { locale: 'zh-CN' });
    expect(out.label).toBe('All Accounts');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// metadataForms namespace + resolver
// ────────────────────────────────────────────────────────────────────────────

import {
  resolveMetadataTypeLabel,
  resolveMetadataTypeDescription,
  resolveMetadataFormLabels,
} from './i18n-resolver';

describe('TranslationDataSchema metadataForms', () => {
  it('accepts a fully-populated metadataForms entry', () => {
    const data = TranslationDataSchema.parse({
      metadataForms: {
        object: {
          label: '对象',
          description: '业务对象定义',
          sections: {
            basics: { label: '基础信息', description: '标识与标签' },
            capabilities: { label: '功能开关' },
          },
          fields: {
            name: { label: '名称', helpText: 'snake_case 唯一标识符', placeholder: 'e.g. account' },
            'capabilities.trackHistory': { label: '历史追踪' },
          },
        },
      },
    });
    expect(data.metadataForms?.object?.label).toBe('对象');
    expect(data.metadataForms?.object?.sections?.basics?.label).toBe('基础信息');
    expect(data.metadataForms?.object?.fields?.['capabilities.trackHistory']?.label).toBe('历史追踪');
  });

  it('all metadataForms fields are optional', () => {
    expect(() => TranslationDataSchema.parse({ metadataForms: {} })).not.toThrow();
    expect(() => TranslationDataSchema.parse({ metadataForms: { object: {} } })).not.toThrow();
  });
});

describe('resolveMetadataTypeLabel', () => {
  const bundle: TranslationBundle = {
    'zh-CN': {
      metadataForms: { object: { label: '对象', description: '业务对象定义' } },
    },
    'en-US': {
      metadataForms: { object: { label: 'Object (en-US)' } },
    },
  };

  it('returns translated label when present', () => {
    expect(resolveMetadataTypeLabel(bundle, 'object', 'Object', { locale: 'zh-CN' })).toBe('对象');
  });

  it('falls back to the literal when no bundle entry', () => {
    expect(resolveMetadataTypeLabel(bundle, 'unknown', 'Unknown', { locale: 'zh-CN' })).toBe('Unknown');
  });

  it('walks the locale fallback chain', () => {
    expect(
      resolveMetadataTypeLabel(bundle, 'object', 'Object', {
        locale: 'fr-FR',
        fallbackChain: ['en-US'],
      }),
    ).toBe('Object (en-US)');
  });

  it('returns fallback when bundle is undefined', () => {
    expect(resolveMetadataTypeLabel(undefined, 'object', 'Object', { locale: 'zh-CN' })).toBe('Object');
  });
});

describe('resolveMetadataTypeDescription', () => {
  const bundle: TranslationBundle = {
    'zh-CN': { metadataForms: { object: { description: '业务对象定义' } } },
  };
  it('returns translated description', () => {
    expect(resolveMetadataTypeDescription(bundle, 'object', 'Business object definition', { locale: 'zh-CN' })).toBe(
      '业务对象定义',
    );
  });
  it('returns literal fallback when no translation', () => {
    expect(resolveMetadataTypeDescription(bundle, 'field', 'Field def', { locale: 'zh-CN' })).toBe('Field def');
  });
  it('passes through undefined fallback', () => {
    expect(resolveMetadataTypeDescription(bundle, 'field', undefined, { locale: 'zh-CN' })).toBeUndefined();
  });
});

describe('resolveMetadataFormLabels', () => {
  const bundle: TranslationBundle = {
    'zh-CN': {
      metadataForms: {
        object: {
          sections: {
            basics: { label: '基础信息', description: '标识与标签' },
            capabilities: { label: '功能开关' },
          },
          fields: {
            name: { label: '名称', helpText: 'snake_case 唯一标识符' },
            label: { label: '显示名' },
            'capabilities.trackHistory': { label: '历史追踪' },
            'fields.items.label': { label: '字段标签' },
          },
        },
      },
    },
  };

  const form = {
    schemaId: 'object',
    type: 'simple',
    sections: [
      {
        name: 'basics',
        label: 'Basics',
        description: 'Identity and labels.',
        fields: [
          { field: 'name', type: 'text', helpText: 'snake_case unique identifier' },
          { field: 'label', type: 'text' },
          { field: 'description', type: 'textarea' }, // No translation → unchanged
        ],
      },
      {
        name: 'capabilities',
        label: 'Capabilities',
        fields: [
          {
            field: 'capabilities',
            type: 'composite',
            fields: [
              { field: 'trackHistory', type: 'boolean' },
              { field: 'searchable', type: 'boolean' },
            ],
          },
        ],
      },
      {
        // No `name` → only field-level translations apply
        label: 'Untranslated section',
        fields: [{ field: 'something', type: 'text' }],
      },
      {
        name: 'fields',
        label: 'Fields',
        fields: [
          {
            field: 'fields',
            type: 'repeater',
            fields: [
              { field: 'items', type: 'composite', fields: [{ field: 'label', type: 'text' }] },
            ],
          },
        ],
      },
    ],
  };

  it('translates section labels keyed by section.name', () => {
    const out = resolveMetadataFormLabels(form, 'object', bundle, { locale: 'zh-CN' });
    expect(out.sections[0].label).toBe('基础信息');
    expect(out.sections[0].description).toBe('标识与标签');
    expect(out.sections[1].label).toBe('功能开关');
  });

  it('leaves sections without name unchanged at section level', () => {
    const out = resolveMetadataFormLabels(form, 'object', bundle, { locale: 'zh-CN' });
    expect(out.sections[2].label).toBe('Untranslated section');
  });

  it('translates top-level field label + helpText', () => {
    const out = resolveMetadataFormLabels(form, 'object', bundle, { locale: 'zh-CN' });
    const nameField = out.sections[0].fields[0];
    expect(nameField.label).toBe('名称');
    expect(nameField.helpText).toBe('snake_case 唯一标识符');
  });

  it('leaves untranslated fields untouched', () => {
    const out = resolveMetadataFormLabels(form, 'object', bundle, { locale: 'zh-CN' });
    expect(out.sections[0].fields[2].field).toBe('description');
    expect(out.sections[0].fields[2].label).toBeUndefined();
  });

  it('translates nested composite field via dot-notation path', () => {
    const out = resolveMetadataFormLabels(form, 'object', bundle, { locale: 'zh-CN' });
    const trackHistory = out.sections[1].fields[0].fields[0];
    expect(trackHistory.label).toBe('历史追踪');
    // sibling without translation stays untranslated
    expect(out.sections[1].fields[0].fields[1].label).toBeUndefined();
  });

  it('translates deeply-nested repeater sub-field via dot-notation path', () => {
    const out = resolveMetadataFormLabels(form, 'object', bundle, { locale: 'zh-CN' });
    const labelField = out.sections[3].fields[0].fields[0].fields[0];
    expect(labelField.label).toBe('字段标签');
  });

  it('returns the input unchanged when no bundle entry for type', () => {
    const out = resolveMetadataFormLabels(form, 'unknown_type', bundle, { locale: 'zh-CN' });
    expect(out).toBe(form);
  });

  it('returns the input unchanged when bundle is undefined', () => {
    expect(resolveMetadataFormLabels(form, 'object', undefined, { locale: 'zh-CN' })).toBe(form);
  });

  it('does not mutate the input form', () => {
    const snapshot = JSON.parse(JSON.stringify(form));
    resolveMetadataFormLabels(form, 'object', bundle, { locale: 'zh-CN' });
    expect(form).toEqual(snapshot);
  });

  it('respects locale fallback chain', () => {
    const fallbackBundle: TranslationBundle = {
      'en-US': {
        metadataForms: { object: { sections: { basics: { label: 'Basics (en)' } } } },
      },
    };
    const out = resolveMetadataFormLabels(form, 'object', fallbackBundle, {
      locale: 'fr-FR',
      fallbackChain: ['en-US'],
    });
    expect(out.sections[0].label).toBe('Basics (en)');
  });
});

import {
  translateApp,
  translateDashboard,
  resolveViewLabel as _resolveViewLabel,
} from './i18n-resolver';

describe('locale fallback resolution (BCP-47)', () => {
  const bundle: TranslationBundle = {
    'zh-CN': {
      objects: { account: { label: '客户' } },
    },
  };

  it('resolves base language to a registered region variant (zh → zh-CN)', () => {
    const out = translateMetadataDocument(
      'object',
      { name: 'account', label: 'Account' },
      bundle,
      { locale: 'zh' },
    );
    expect(out.label).toBe('客户');
  });

  it('resolves case-insensitively (zh-cn → zh-CN)', () => {
    const out = translateMetadataDocument(
      'object',
      { name: 'account', label: 'Account' },
      bundle,
      { locale: 'zh-cn' },
    );
    expect(out.label).toBe('客户');
  });

  it('resolves a region-qualified request down to base/other variant (zh-TW → zh-CN)', () => {
    const out = translateMetadataDocument(
      'object',
      { name: 'account', label: 'Account' },
      bundle,
      { locale: 'zh-TW' },
    );
    expect(out.label).toBe('客户');
  });

  it('falls back to literal when no related locale is registered', () => {
    const out = translateMetadataDocument(
      'object',
      { name: 'account', label: 'Account' },
      bundle,
      { locale: 'fr', fallbackChain: [] },
    );
    expect(out.label).toBe('Account');
  });
});

describe('translateApp', () => {
  const bundle: TranslationBundle = {
    'zh-CN': {
      apps: {
        setup: {
          label: '系统设置',
          description: '平台设置与管理',
          navigation: {
            group_overview: { label: '总览' },
            nav_users: { label: '用户' },
          },
        },
      },
    },
  };

  const app = {
    name: 'setup',
    label: 'Setup',
    description: 'Platform settings and administration',
    navigation: [
      {
        id: 'group_overview',
        type: 'group',
        label: 'Overview',
        children: [{ id: 'nav_users', type: 'object', label: 'Users' }],
      },
    ],
  };

  it('translates app label/description and nested navigation labels', () => {
    const out = translateApp(app, bundle, { locale: 'zh-CN' });
    expect(out.label).toBe('系统设置');
    expect(out.description).toBe('平台设置与管理');
    expect(out.navigation[0].label).toBe('总览');
    expect(out.navigation[0].children[0].label).toBe('用户');
  });

  it('works through translateMetadataDocument with app type', () => {
    const out = translateMetadataDocument('app', app, bundle, { locale: 'zh' });
    expect(out.navigation[0].children[0].label).toBe('用户');
  });

  it('does not mutate the input app', () => {
    const snapshot = JSON.parse(JSON.stringify(app));
    translateApp(app, bundle, { locale: 'zh-CN' });
    expect(app).toEqual(snapshot);
  });

  it('falls back to literal labels when no translation present', () => {
    const out = translateApp(app, undefined, { locale: 'zh-CN' });
    expect(out.label).toBe('Setup');
    expect(out.navigation[0].label).toBe('Overview');
  });
});

describe('translateDashboard', () => {
  const bundle: TranslationBundle = {
    'zh-CN': {
      dashboards: {
        system_overview: {
          label: '系统概览',
          widgets: {
            widget_total_users: { title: '用户总数', description: '系统中注册的用户总数' },
          },
        },
      },
    },
  };

  const dashboard = {
    name: 'system_overview',
    label: 'System Overview',
    widgets: [
      { id: 'widget_total_users', title: 'Total Users', description: 'Total registered users' },
      { id: 'widget_other', title: 'Other' },
    ],
  };

  it('translates dashboard label and widget title/description', () => {
    const out = translateDashboard(dashboard, bundle, { locale: 'zh-CN' });
    expect(out.label).toBe('系统概览');
    expect(out.widgets[0].title).toBe('用户总数');
    expect(out.widgets[0].description).toBe('系统中注册的用户总数');
  });

  it('leaves widgets without a translation entry unchanged', () => {
    const out = translateDashboard(dashboard, bundle, { locale: 'zh-CN' });
    expect(out.widgets[1].title).toBe('Other');
  });

  it('works through translateMetadataDocument with dashboard type', () => {
    const out = translateMetadataDocument('dashboard', dashboard, bundle, { locale: 'zh-CN' });
    expect(out.label).toBe('系统概览');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// translateObject — built-in system-field label fallback
// ────────────────────────────────────────────────────────────────────────────

import { translateObject } from './i18n-resolver';

describe('translateObject system-field label fallback', () => {
  const contract = {
    name: 'contracts',
    label: 'Contract',
    fields: {
      title: { name: 'title', type: 'text', label: '合同名称' },
      owner_id: { name: 'owner_id', type: 'lookup', label: 'Owner' },
      created_at: { name: 'created_at', type: 'datetime', label: 'Created At' },
      created_by: { name: 'created_by', type: 'lookup', label: 'Created By' },
      updated_at: { name: 'updated_at', type: 'datetime', label: 'Last Modified At' },
      updated_by: { name: 'updated_by', type: 'lookup', label: 'Last Modified By' },
    },
  };

  it('localizes injected system-field labels even without a bundle', () => {
    const out = translateObject(contract, undefined, { locale: 'zh-CN' });
    const fields = out.fields as Record<string, any>;
    expect(fields.owner_id.label).toBe('所有者');
    expect(fields.created_at.label).toBe('创建时间');
    expect(fields.created_by.label).toBe('创建人');
    expect(fields.updated_at.label).toBe('更新时间');
    expect(fields.updated_by.label).toBe('更新人');
    // Authored labels stay untouched.
    expect(fields.title.label).toBe('合同名称');
    // Input not mutated.
    expect((contract.fields as any).owner_id.label).toBe('Owner');
  });

  it('applies BCP-47 fallback for base-language and variant locales', () => {
    const zh = translateObject(contract, undefined, { locale: 'zh' });
    expect((zh.fields as any).owner_id.label).toBe('所有者');
    const ja = translateObject(contract, undefined, { locale: 'ja' });
    expect((ja.fields as any).created_by.label).toBe('作成者');
  });

  it('keeps English labels for en and unknown locales', () => {
    const en = translateObject(contract, undefined, { locale: 'en' });
    expect((en.fields as any).owner_id.label).toBe('Owner');
    const fr = translateObject(contract, undefined, { locale: 'fr-FR', fallbackChain: [] });
    expect((fr.fields as any).owner_id.label).toBe('Owner');
  });

  it('never overrides an author-customized system-field label', () => {
    const custom = {
      name: 'contracts',
      fields: { owner_id: { name: 'owner_id', type: 'lookup', label: '负责人' } },
    };
    const out = translateObject(custom, undefined, { locale: 'zh-CN' });
    expect((out.fields as any).owner_id.label).toBe('负责人');
  });

  it('prefers an explicit bundle entry over the built-in fallback', () => {
    const withBundle: TranslationBundle = {
      'zh-CN': {
        objects: {
          contracts: { fields: { owner_id: { label: '合同负责人' } } },
        },
      } as any,
    };
    const out = translateObject(contract, withBundle, { locale: 'zh-CN' });
    expect((out.fields as any).owner_id.label).toBe('合同负责人');
  });

  it('handles the array field shape', () => {
    const arrayDoc = {
      name: 'contracts',
      fields: [{ name: 'owner_id', type: 'lookup', label: 'Owner' }],
    };
    const out = translateObject(arrayDoc, undefined, { locale: 'zh-CN' });
    expect((out.fields as any)[0].label).toBe('所有者');
  });
});
