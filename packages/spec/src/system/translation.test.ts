import { describe, it, expect } from 'vitest';
import {
  TranslationDataSchema,
  TranslationBundleSchema,
  LocaleSchema,
  FieldTranslationSchema,
  ObjectTranslationDataSchema,
  TranslationFileOrganizationSchema,
  TranslationConfigSchema,
  ObjectTranslationNodeSchema,
  AppTranslationBundleSchema,
  TranslationDiffStatusSchema,
  TranslationDiffItemSchema,
  TranslationCoverageResultSchema,
  type TranslationBundle,
  type ObjectTranslationData,
  type TranslationConfig,
  type ObjectTranslationNode,
  type AppTranslationBundle,
  type TranslationDiffItem,
  type TranslationCoverageResult,
} from './translation.zod';

describe('LocaleSchema', () => {
  it('should accept valid locale strings', () => {
    const validLocales = ['en-US', 'zh-CN', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP'];

    validLocales.forEach(locale => {
      expect(() => LocaleSchema.parse(locale)).not.toThrow();
    });
  });

  it('should accept simple language codes', () => {
    const locales = ['en', 'zh', 'es', 'fr', 'de'];

    locales.forEach(locale => {
      expect(() => LocaleSchema.parse(locale)).not.toThrow();
    });
  });
});

describe('TranslationDataSchema', () => {
  it('should accept empty translation data', () => {
    const data = TranslationDataSchema.parse({});

    expect(data).toBeDefined();
  });

  it('should accept object translations', () => {
    const data = TranslationDataSchema.parse({
      objects: {
        account: {
          label: 'Account',
          pluralLabel: 'Accounts',
        },
      },
    });

    expect(data.objects?.account.label).toBe('Account');
  });

  it('should accept field translations', () => {
    const data = TranslationDataSchema.parse({
      objects: {
        account: {
          label: 'Account',
          fields: {
            name: {
              label: 'Account Name',
              help: 'Enter the name of the account',
            },
            status: {
              label: 'Status',
              options: {
                active: 'Active',
                inactive: 'Inactive',
              },
            },
          },
        },
      },
    });

    expect(data.objects?.account.fields?.name.label).toBe('Account Name');
    expect(data.objects?.account.fields?.status.options?.active).toBe('Active');
  });

  it('should accept app translations', () => {
    const data = TranslationDataSchema.parse({
      apps: {
        sales: {
          label: 'Sales',
          description: 'Manage your sales pipeline',
        },
      },
    });

    expect(data.apps?.sales.label).toBe('Sales');
  });

  it('should accept message translations', () => {
    const data = TranslationDataSchema.parse({
      messages: {
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'error.required': 'This field is required',
      },
    });

    expect(data.messages?.['common.save']).toBe('Save');
  });

  it('should accept complete translation data', () => {
    const data = TranslationDataSchema.parse({
      objects: {
        account: {
          label: 'Account',
          pluralLabel: 'Accounts',
          fields: {
            name: {
              label: 'Name',
            },
          },
        },
      },
      apps: {
        sales: {
          label: 'Sales',
        },
      },
      messages: {
        'common.save': 'Save',
      },
    });

    expect(data.objects).toBeDefined();
    expect(data.apps).toBeDefined();
    expect(data.messages).toBeDefined();
  });
});

describe('TranslationBundleSchema', () => {
  it('should accept valid translation bundle', () => {
    const bundle: TranslationBundle = {
      'en-US': {
        objects: {
          account: {
            label: 'Account',
            pluralLabel: 'Accounts',
          },
        },
      },
    };

    expect(() => TranslationBundleSchema.parse(bundle)).not.toThrow();
  });

  it('should accept multi-language bundle', () => {
    const bundle = TranslationBundleSchema.parse({
      'en-US': {
        objects: {
          account: {
            label: 'Account',
          },
        },
        messages: {
          'common.save': 'Save',
        },
      },
      'zh-CN': {
        objects: {
          account: {
            label: '客户',
          },
        },
        messages: {
          'common.save': '保存',
        },
      },
    });

    expect(bundle['en-US'].objects?.account.label).toBe('Account');
    expect(bundle['zh-CN'].objects?.account.label).toBe('客户');
  });

  it('should handle English translations', () => {
    const bundle = TranslationBundleSchema.parse({
      'en-US': {
        objects: {
          account: {
            label: 'Account',
            pluralLabel: 'Accounts',
            fields: {
              name: {
                label: 'Account Name',
                help: 'The name of the account',
              },
              type: {
                label: 'Type',
                options: {
                  customer: 'Customer',
                  partner: 'Partner',
                  vendor: 'Vendor',
                },
              },
            },
          },
        },
        apps: {
          sales: {
            label: 'Sales',
            description: 'Manage your sales pipeline',
          },
        },
        messages: {
          'common.save': 'Save',
          'common.cancel': 'Cancel',
          'common.delete': 'Delete',
        },
      },
    });

    expect(bundle['en-US'].objects?.account.label).toBe('Account');
  });

  it('should handle Chinese translations', () => {
    const bundle = TranslationBundleSchema.parse({
      'zh-CN': {
        objects: {
          account: {
            label: '客户',
            pluralLabel: '客户',
            fields: {
              name: {
                label: '客户名称',
                help: '输入客户名称',
              },
            },
          },
        },
        messages: {
          'common.save': '保存',
          'common.cancel': '取消',
        },
      },
    });

    expect(bundle['zh-CN'].objects?.account.label).toBe('客户');
  });

  it('should handle Spanish translations', () => {
    const bundle = TranslationBundleSchema.parse({
      'es-ES': {
        objects: {
          account: {
            label: 'Cuenta',
            pluralLabel: 'Cuentas',
          },
        },
        messages: {
          'common.save': 'Guardar',
          'common.cancel': 'Cancelar',
        },
      },
    });

    expect(bundle['es-ES'].objects?.account.label).toBe('Cuenta');
  });

  it('should handle field option translations', () => {
    const bundle = TranslationBundleSchema.parse({
      'en-US': {
        objects: {
          opportunity: {
            label: 'Opportunity',
            fields: {
              stage: {
                label: 'Stage',
                options: {
                  prospecting: 'Prospecting',
                  qualification: 'Qualification',
                  proposal: 'Proposal',
                  closed_won: 'Closed Won',
                  closed_lost: 'Closed Lost',
                },
              },
            },
          },
        },
      },
      'zh-CN': {
        objects: {
          opportunity: {
            label: '商机',
            fields: {
              stage: {
                label: '阶段',
                options: {
                  prospecting: '寻找客户',
                  qualification: '资格审查',
                  proposal: '提案',
                  closed_won: '成交',
                  closed_lost: '失败',
                },
              },
            },
          },
        },
      },
    });

    expect(bundle['en-US'].objects?.opportunity.fields?.stage.options?.prospecting).toBe('Prospecting');
    expect(bundle['zh-CN'].objects?.opportunity.fields?.stage.options?.prospecting).toBe('寻找客户');
  });

  it('should handle app menu translations', () => {
    const bundle = TranslationBundleSchema.parse({
      'en-US': {
        apps: {
          sales: {
            label: 'Sales',
            description: 'Manage your sales pipeline and opportunities',
          },
          service: {
            label: 'Service',
            description: 'Handle customer support cases',
          },
        },
      },
      'fr-FR': {
        apps: {
          sales: {
            label: 'Ventes',
            description: 'Gérez votre pipeline de ventes',
          },
          service: {
            label: 'Service',
            description: 'Gérez les cas de support client',
          },
        },
      },
    });

    expect(bundle['en-US'].apps?.sales.label).toBe('Sales');
    expect(bundle['fr-FR'].apps?.sales.label).toBe('Ventes');
  });

  it('should handle UI message translations', () => {
    const bundle = TranslationBundleSchema.parse({
      'en-US': {
        messages: {
          'error.required': 'This field is required',
          'error.invalid_email': 'Invalid email address',
          'success.saved': 'Successfully saved',
          'confirm.delete': 'Are you sure you want to delete this record?',
        },
      },
      'de-DE': {
        messages: {
          'error.required': 'Dieses Feld ist erforderlich',
          'error.invalid_email': 'Ungültige E-Mail-Adresse',
          'success.saved': 'Erfolgreich gespeichert',
          'confirm.delete': 'Möchten Sie diesen Datensatz wirklich löschen?',
        },
      },
    });

    expect(bundle['en-US'].messages?.['error.required']).toBe('This field is required');
    expect(bundle['de-DE'].messages?.['error.required']).toBe('Dieses Feld ist erforderlich');
  });

  it('should accept empty locale data', () => {
    const bundle = TranslationBundleSchema.parse({
      'en-US': {},
      'zh-CN': {},
    });

    expect(bundle['en-US']).toBeDefined();
    expect(bundle['zh-CN']).toBeDefined();
  });

  it('should handle partial translations', () => {
    const bundle = TranslationBundleSchema.parse({
      'en-US': {
        objects: {
          account: {
            label: 'Account',
          },
        },
        messages: {
          'common.save': 'Save',
        },
      },
      'zh-CN': {
        objects: {
          account: {
            label: '客户',
          },
        },
        // messages not translated yet
      },
    });

    expect(bundle['zh-CN'].objects?.account.label).toBe('客户');
    expect(bundle['zh-CN'].messages).toBeUndefined();
  });
});

// ============================================================================
// Protocol Improvement Tests: Translation validationMessages
// ============================================================================

describe('TranslationDataSchema - validationMessages', () => {
  it('should accept translation data with validationMessages', () => {
    const data = TranslationDataSchema.parse({
      validationMessages: {
        'discount_limit': 'Discount cannot exceed 40%',
        'amount_required': 'Amount is required for closed deals',
      },
    });
    expect(data.validationMessages?.['discount_limit']).toBe('Discount cannot exceed 40%');
    expect(data.validationMessages?.['amount_required']).toBe('Amount is required for closed deals');
  });

  it('should accept Chinese validation messages', () => {
    const bundle = TranslationBundleSchema.parse({
      'zh-CN': {
        validationMessages: {
          'discount_limit': '折扣不能超过40%',
          'end_date_check': '结束日期必须大于开始日期',
        },
      },
    });
    expect(bundle['zh-CN'].validationMessages?.['discount_limit']).toBe('折扣不能超过40%');
  });

  it('should accept translation data without validationMessages (optional)', () => {
    const data = TranslationDataSchema.parse({
      messages: { 'save': 'Save' },
    });
    expect(data.validationMessages).toBeUndefined();
  });
});

// ============================================================================
// FieldTranslationSchema
// ============================================================================

describe('FieldTranslationSchema', () => {
  it('should accept label only', () => {
    const result = FieldTranslationSchema.parse({ label: 'Account Name' });
    expect(result.label).toBe('Account Name');
    expect(result.help).toBeUndefined();
    expect(result.options).toBeUndefined();
  });

  it('should accept label with help text', () => {
    const result = FieldTranslationSchema.parse({
      label: 'Industry',
      help: 'Select the primary industry',
    });
    expect(result.help).toBe('Select the primary industry');
  });

  it('should accept field with options', () => {
    const result = FieldTranslationSchema.parse({
      label: 'Status',
      options: { active: 'Active', inactive: 'Inactive' },
    });
    expect(result.options?.active).toBe('Active');
  });

  it('should accept empty object', () => {
    const result = FieldTranslationSchema.parse({});
    expect(result).toBeDefined();
  });
});

// ============================================================================
// ObjectTranslationDataSchema — per-object file validation
// ============================================================================

describe('ObjectTranslationDataSchema', () => {
  it('should accept minimal object translation', () => {
    const data: ObjectTranslationData = {
      label: 'Account',
    };
    const result = ObjectTranslationDataSchema.parse(data);
    expect(result.label).toBe('Account');
    expect(result.pluralLabel).toBeUndefined();
    expect(result.fields).toBeUndefined();
  });

  it('should accept full object translation (en/account.json)', () => {
    const data = ObjectTranslationDataSchema.parse({
      label: 'Account',
      pluralLabel: 'Accounts',
      fields: {
        name: { label: 'Account Name', help: 'Legal name of the company' },
        type: {
          label: 'Type',
          options: { customer: 'Customer', partner: 'Partner', vendor: 'Vendor' },
        },
        industry: { label: 'Industry' },
      },
    });
    expect(data.label).toBe('Account');
    expect(data.pluralLabel).toBe('Accounts');
    expect(data.fields?.name.label).toBe('Account Name');
    expect(data.fields?.type.options?.customer).toBe('Customer');
  });

  it('should accept Chinese object translation (zh-CN/account.json)', () => {
    const data = ObjectTranslationDataSchema.parse({
      label: '客户',
      pluralLabel: '客户',
      fields: {
        name: { label: '客户名称', help: '公司或组织的法定名称' },
        type: {
          label: '类型',
          options: { customer: '正式客户', partner: '合作伙伴' },
        },
      },
    });
    expect(data.label).toBe('客户');
    expect(data.fields?.name.help).toBe('公司或组织的法定名称');
  });

  it('should reject object translation without label', () => {
    expect(() =>
      ObjectTranslationDataSchema.parse({ pluralLabel: 'Accounts' }),
    ).toThrow();
  });

  it('should compose into TranslationDataSchema via objects record', () => {
    const localeData = TranslationDataSchema.parse({
      objects: {
        account: { label: 'Account', pluralLabel: 'Accounts' },
        contact: { label: 'Contact' },
      },
    });
    expect(localeData.objects?.account.label).toBe('Account');
    expect(localeData.objects?.contact.label).toBe('Contact');
  });
});

// ============================================================================
// TranslationFileOrganizationSchema
// ============================================================================

describe('TranslationFileOrganizationSchema', () => {
  it('should accept bundled', () => {
    expect(TranslationFileOrganizationSchema.parse('bundled')).toBe('bundled');
  });

  it('should accept per_locale', () => {
    expect(TranslationFileOrganizationSchema.parse('per_locale')).toBe('per_locale');
  });

  it('should accept per_namespace', () => {
    expect(TranslationFileOrganizationSchema.parse('per_namespace')).toBe('per_namespace');
  });

  it('should reject invalid value', () => {
    expect(() => TranslationFileOrganizationSchema.parse('flat')).toThrow();
  });
});

// ============================================================================
// TranslationConfigSchema
// ============================================================================

describe('TranslationConfigSchema', () => {
  it('should accept minimal config with defaults', () => {
    const config: TranslationConfig = TranslationConfigSchema.parse({
      defaultLocale: 'en',
      supportedLocales: ['en'],
    });
    expect(config.defaultLocale).toBe('en');
    expect(config.supportedLocales).toEqual(['en']);
    expect(config.fallbackLocale).toBeUndefined();
    expect(config.fileOrganization).toBe('per_locale');
    expect(config.lazyLoad).toBe(false);
    expect(config.cache).toBe(true);
  });

  it('should accept full multi-language config', () => {
    const config = TranslationConfigSchema.parse({
      defaultLocale: 'en',
      supportedLocales: ['en', 'zh-CN', 'ja-JP', 'es-ES'],
      fallbackLocale: 'en',
      fileOrganization: 'per_namespace',
      lazyLoad: true,
      cache: true,
    });
    expect(config.supportedLocales).toHaveLength(4);
    expect(config.fileOrganization).toBe('per_namespace');
    expect(config.lazyLoad).toBe(true);
  });

  it('should accept bundled organization for small projects', () => {
    const config = TranslationConfigSchema.parse({
      defaultLocale: 'en',
      supportedLocales: ['en', 'zh-CN'],
      fileOrganization: 'bundled',
    });
    expect(config.fileOrganization).toBe('bundled');
  });

  it('should reject config without defaultLocale', () => {
    expect(() =>
      TranslationConfigSchema.parse({
        supportedLocales: ['en'],
      }),
    ).toThrow();
  });

  it('should reject config without supportedLocales', () => {
    expect(() =>
      TranslationConfigSchema.parse({
        defaultLocale: 'en',
      }),
    ).toThrow();
  });
});

// ============================================================================
// ObjectTranslationNodeSchema — object-first aggregated translation node
// ============================================================================

describe('ObjectTranslationNodeSchema', () => {
  it('should accept minimal node with label only', () => {
    const node: ObjectTranslationNode = ObjectTranslationNodeSchema.parse({
      label: 'Account',
    });
    expect(node.label).toBe('Account');
    expect(node.pluralLabel).toBeUndefined();
    expect(node.description).toBeUndefined();
    expect(node.helpText).toBeUndefined();
    expect(node.fields).toBeUndefined();
    expect(node._options).toBeUndefined();
    expect(node._views).toBeUndefined();
    expect(node._sections).toBeUndefined();
    expect(node._actions).toBeUndefined();
  });

  it('should accept full object-first node with all sub-groups', () => {
    const node: ObjectTranslationNode = ObjectTranslationNodeSchema.parse({
      label: '客户',
      pluralLabel: '客户',
      description: '客户管理对象',
      helpText: '用于管理公司的所有客户',
      fields: {
        name: { label: '客户名称', help: '公司或组织的法定名称' },
        industry: {
          label: '行业',
          options: { tech: '科技', finance: '金融' },
        },
      },
      _options: {
        status: { active: '活跃', inactive: '停用' },
      },
      _views: {
        all_accounts: { label: '全部客户', description: '查看所有客户' },
      },
      _sections: {
        basic_info: { label: '基本信息' },
      },
      _actions: {
        convert_lead: { label: '转换线索', confirmMessage: '确认转换？' },
      },
    });

    expect(node.label).toBe('客户');
    expect(node.pluralLabel).toBe('客户');
    expect(node.description).toBe('客户管理对象');
    expect(node.helpText).toBe('用于管理公司的所有客户');
    expect(node.fields?.name.label).toBe('客户名称');
    expect(node.fields?.industry.options?.tech).toBe('科技');
    expect(node._options?.status.active).toBe('活跃');
    expect(node._views?.all_accounts.label).toBe('全部客户');
    expect(node._sections?.basic_info.label).toBe('基本信息');
    expect(node._actions?.convert_lead.label).toBe('转换线索');
    expect(node._actions?.convert_lead.confirmMessage).toBe('确认转换？');
  });

  it('should reject node without label', () => {
    expect(() =>
      ObjectTranslationNodeSchema.parse({ pluralLabel: 'Accounts' }),
    ).toThrow();
  });

  it('should accept node with only fields and views', () => {
    const node = ObjectTranslationNodeSchema.parse({
      label: 'Opportunity',
      fields: {
        stage: { label: 'Stage', options: { open: 'Open', closed: 'Closed' } },
      },
      _views: {
        pipeline: { label: 'Pipeline View' },
      },
    });
    expect(node.fields?.stage.label).toBe('Stage');
    expect(node._views?.pipeline.label).toBe('Pipeline View');
  });
});

// ============================================================================
// AppTranslationBundleSchema — object-first full app bundle
// ============================================================================

describe('AppTranslationBundleSchema', () => {
  it('should accept empty bundle', () => {
    const bundle: AppTranslationBundle = AppTranslationBundleSchema.parse({});
    expect(bundle).toBeDefined();
  });

  it('should accept bundle with object-first translations', () => {
    const bundle: AppTranslationBundle = AppTranslationBundleSchema.parse({
      o: {
        account: {
          label: '客户',
          fields: { name: { label: '客户名称' } },
          _views: { all_accounts: { label: '全部客户' } },
        },
        contact: {
          label: '联系人',
          fields: { email: { label: '邮箱' } },
        },
      },
    });

    expect(bundle.o?.account.label).toBe('客户');
    expect(bundle.o?.account.fields?.name.label).toBe('客户名称');
    expect(bundle.o?.account._views?.all_accounts.label).toBe('全部客户');
    expect(bundle.o?.contact.label).toBe('联系人');
  });

  it('should accept bundle with global options', () => {
    const bundle = AppTranslationBundleSchema.parse({
      _globalOptions: {
        currency: { usd: '美元', eur: '欧元', gbp: '英镑' },
        country: { us: '美国', cn: '中国' },
      },
    });

    expect(bundle._globalOptions?.currency.usd).toBe('美元');
    expect(bundle._globalOptions?.country.cn).toBe('中国');
  });

  it('should accept bundle with all global groups', () => {
    const bundle: AppTranslationBundle = AppTranslationBundleSchema.parse({
      app: {
        crm: { label: 'CRM', description: 'Customer Relationship Management' },
      },
      nav: { home: 'Home', settings: 'Settings' },
      dashboard: {
        sales_overview: { label: 'Sales Overview', description: 'Key sales metrics' },
      },
      reports: {
        pipeline_report: { label: 'Pipeline Report' },
      },
      pages: {
        landing: { title: 'Welcome', description: 'Landing page' },
      },
      messages: {
        'common.save': 'Save',
        'common.cancel': 'Cancel',
      },
      validationMessages: {
        'discount_limit': 'Discount cannot exceed 40%',
      },
    });

    expect(bundle.app?.crm.label).toBe('CRM');
    expect(bundle.nav?.home).toBe('Home');
    expect(bundle.dashboard?.sales_overview.label).toBe('Sales Overview');
    expect(bundle.reports?.pipeline_report.label).toBe('Pipeline Report');
    expect(bundle.pages?.landing.title).toBe('Welcome');
    expect(bundle.messages?.['common.save']).toBe('Save');
    expect(bundle.validationMessages?.['discount_limit']).toBe('Discount cannot exceed 40%');
  });

  it('should accept a complete Chinese translation bundle', () => {
    const zh: AppTranslationBundle = AppTranslationBundleSchema.parse({
      o: {
        account: {
          label: '客户',
          pluralLabel: '客户',
          description: '客户管理对象',
          fields: {
            name: { label: '客户名称', help: '公司或组织的法定名称' },
            industry: { label: '行业', options: { tech: '科技', finance: '金融' } },
          },
          _options: { status: { active: '活跃', inactive: '停用' } },
          _views: { all_accounts: { label: '全部客户' } },
          _sections: { basic_info: { label: '基本信息' } },
          _actions: { convert: { label: '转换', confirmMessage: '确认转换？' } },
        },
        opportunity: {
          label: '商机',
          fields: {
            stage: { label: '阶段', options: { open: '打开', closed: '关闭' } },
          },
        },
      },
      _globalOptions: { currency: { usd: '美元', eur: '欧元' } },
      app: { crm: { label: '客户关系管理', description: '管理销售流程' } },
      nav: { home: '首页', settings: '设置' },
      dashboard: { sales_overview: { label: '销售概览' } },
      reports: { pipeline_report: { label: '管道报表' } },
      pages: { landing: { title: '欢迎' } },
      messages: { 'common.save': '保存', 'common.cancel': '取消' },
      validationMessages: { 'discount_limit': '折扣不能超过40%' },
    });

    expect(zh.o?.account.label).toBe('客户');
    expect(zh.o?.account._options?.status.active).toBe('活跃');
    expect(zh.o?.opportunity.fields?.stage.options?.open).toBe('打开');
    expect(zh._globalOptions?.currency.usd).toBe('美元');
    expect(zh.app?.crm.label).toBe('客户关系管理');
    expect(zh.nav?.home).toBe('首页');
    expect(zh.messages?.['common.save']).toBe('保存');
  });
});

// ============================================================================
// TranslationDiffStatusSchema
// ============================================================================

describe('TranslationDiffStatusSchema', () => {
  it('should accept valid statuses', () => {
    expect(TranslationDiffStatusSchema.parse('missing')).toBe('missing');
    expect(TranslationDiffStatusSchema.parse('redundant')).toBe('redundant');
    expect(TranslationDiffStatusSchema.parse('stale')).toBe('stale');
  });

  it('should reject invalid status', () => {
    expect(() => TranslationDiffStatusSchema.parse('outdated')).toThrow();
  });
});

// ============================================================================
// TranslationDiffItemSchema
// ============================================================================

describe('TranslationDiffItemSchema', () => {
  it('should accept a missing translation diff item', () => {
    const item: TranslationDiffItem = TranslationDiffItemSchema.parse({
      key: 'o.account.fields.website.label',
      status: 'missing',
      objectName: 'account',
      locale: 'zh-CN',
    });
    expect(item.key).toBe('o.account.fields.website.label');
    expect(item.status).toBe('missing');
    expect(item.objectName).toBe('account');
    expect(item.locale).toBe('zh-CN');
  });

  it('should accept a redundant diff item without objectName', () => {
    const item = TranslationDiffItemSchema.parse({
      key: 'messages.old_key',
      status: 'redundant',
      locale: 'en',
    });
    expect(item.objectName).toBeUndefined();
    expect(item.status).toBe('redundant');
  });

  it('should accept a stale diff item', () => {
    const item = TranslationDiffItemSchema.parse({
      key: 'o.contact.label',
      status: 'stale',
      objectName: 'contact',
      locale: 'ja',
    });
    expect(item.status).toBe('stale');
  });

  it('should reject diff item without key', () => {
    expect(() =>
      TranslationDiffItemSchema.parse({ status: 'missing', locale: 'en' }),
    ).toThrow();
  });
});

// ============================================================================
// TranslationCoverageResultSchema
// ============================================================================

describe('TranslationCoverageResultSchema', () => {
  it('should accept a full coverage result', () => {
    const result: TranslationCoverageResult = TranslationCoverageResultSchema.parse({
      locale: 'zh-CN',
      totalKeys: 120,
      translatedKeys: 105,
      missingKeys: 12,
      redundantKeys: 3,
      staleKeys: 0,
      coveragePercent: 87.5,
      items: [
        { key: 'o.account.fields.website.label', status: 'missing', objectName: 'account', locale: 'zh-CN' },
        { key: 'messages.old_key', status: 'redundant', locale: 'zh-CN' },
      ],
    });

    expect(result.locale).toBe('zh-CN');
    expect(result.totalKeys).toBe(120);
    expect(result.translatedKeys).toBe(105);
    expect(result.missingKeys).toBe(12);
    expect(result.redundantKeys).toBe(3);
    expect(result.staleKeys).toBe(0);
    expect(result.coveragePercent).toBe(87.5);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].status).toBe('missing');
  });

  it('should accept a scoped coverage result for a single object', () => {
    const result = TranslationCoverageResultSchema.parse({
      locale: 'de',
      objectName: 'account',
      totalKeys: 15,
      translatedKeys: 15,
      missingKeys: 0,
      redundantKeys: 0,
      staleKeys: 0,
      coveragePercent: 100,
      items: [],
    });

    expect(result.objectName).toBe('account');
    expect(result.coveragePercent).toBe(100);
    expect(result.items).toHaveLength(0);
  });

  it('should reject result with negative counts', () => {
    expect(() =>
      TranslationCoverageResultSchema.parse({
        locale: 'en',
        totalKeys: -1,
        translatedKeys: 0,
        missingKeys: 0,
        redundantKeys: 0,
        staleKeys: 0,
        coveragePercent: 0,
        items: [],
      }),
    ).toThrow();
  });

  it('should reject result with coverage percent above 100', () => {
    expect(() =>
      TranslationCoverageResultSchema.parse({
        locale: 'en',
        totalKeys: 10,
        translatedKeys: 10,
        missingKeys: 0,
        redundantKeys: 0,
        staleKeys: 0,
        coveragePercent: 101,
        items: [],
      }),
    ).toThrow();
  });
});
