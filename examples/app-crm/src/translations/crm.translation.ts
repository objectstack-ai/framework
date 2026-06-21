// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineTranslationBundle } from '@objectstack/spec/system';

/**
 * CRM translation bundle — English + Simplified Chinese.
 *
 * Provides display labels for all CRM objects, apps, and common UI messages
 * so the Studio i18n pipeline has real data to render.
 */
export const CrmTranslationBundle = defineTranslationBundle({
  en: {
    objects: {
      crm_account: {
        label: 'Account',
        pluralLabel: 'Accounts',
        fields: {
          name: { label: 'Account Name' },
          industry: { label: 'Industry' },
          annual_revenue: { label: 'Annual Revenue' },
          website: { label: 'Website' },
          phone: { label: 'Phone' },
          billing_address: { label: 'Billing Address' },
          owner_id: { label: 'Account Owner' },
        },
      },
      crm_contact: {
        label: 'Contact',
        pluralLabel: 'Contacts',
        fields: {
          first_name: { label: 'First Name' },
          last_name: { label: 'Last Name' },
          email: { label: 'Email' },
          phone: { label: 'Phone' },
          title: { label: 'Job Title' },
          account_id: { label: 'Account' },
        },
      },
      crm_opportunity: {
        label: 'Opportunity',
        pluralLabel: 'Opportunities',
        fields: {
          name: { label: 'Opportunity Name' },
          stage: { label: 'Stage' },
          amount: { label: 'Deal Value' },
          close_date: { label: 'Expected Close' },
          probability: { label: 'Win Probability (%)' },
          discount_percent: { label: 'Discount (%)' },
          owner_id: { label: 'Owner' },
        },
        _sections: {
          deal_info: { label: 'Deal Information' },
          finance: { label: 'Financial Details' },
        },
      },
      crm_lead: {
        label: 'Lead',
        pluralLabel: 'Leads',
        fields: {
          first_name: { label: 'First Name' },
          last_name: { label: 'Last Name' },
          email: { label: 'Email' },
          company: { label: 'Company' },
          status: { label: 'Status' },
          lead_score: { label: 'Lead Score' },
          source: { label: 'Lead Source' },
        },
      },
      crm_activity: {
        label: 'Activity',
        pluralLabel: 'Activities',
        fields: {
          subject: { label: 'Subject' },
          type: { label: 'Activity Type' },
          status: { label: 'Status' },
          due_date: { label: 'Due Date' },
          contact_id: { label: 'Contact' },
          opportunity_id: { label: 'Opportunity' },
        },
      },
    },
    apps: {
      crm: {
        label: 'CRM',
        description: 'Customer Relationship Management',
        navigation: {
          sales: { label: 'Sales' },
          admin: { label: 'Administration' },
        },
      },
    },
    messages: {
      'crm.lead.convert.success': 'Lead converted to opportunity successfully.',
      'crm.lead.convert.error': 'Failed to convert lead. Please try again.',
      'crm.opportunity.won': 'Congratulations! Deal marked as won.',
      'crm.discount.pending_approval': 'Discount requires manager approval.',
      'crm.activity.due_today': 'You have {count} activities due today.',
    },
  },

  'zh-CN': {
    objects: {
      crm_account: {
        label: '客户',
        pluralLabel: '客户列表',
        fields: {
          name: { label: '客户名称' },
          industry: { label: '行业' },
          annual_revenue: { label: '年营收' },
          website: { label: '官网' },
          phone: { label: '电话' },
          billing_address: { label: '账单地址' },
          owner_id: { label: '负责人' },
        },
      },
      crm_contact: {
        label: '联系人',
        pluralLabel: '联系人列表',
        fields: {
          first_name: { label: '名' },
          last_name: { label: '姓' },
          email: { label: '邮箱' },
          phone: { label: '电话' },
          title: { label: '职位' },
          account_id: { label: '所属客户' },
        },
      },
      crm_opportunity: {
        label: '商机',
        pluralLabel: '商机列表',
        fields: {
          name: { label: '商机名称' },
          stage: { label: '阶段' },
          amount: { label: '金额' },
          close_date: { label: '预计成交日期' },
          probability: { label: '赢单概率 (%)' },
          discount_percent: { label: '折扣 (%)' },
          owner_id: { label: '负责人' },
        },
        _sections: {
          deal_info: { label: '商机信息' },
          finance: { label: '财务明细' },
        },
      },
      crm_lead: {
        label: '线索',
        pluralLabel: '线索列表',
        fields: {
          first_name: { label: '名' },
          last_name: { label: '姓' },
          email: { label: '邮箱' },
          company: { label: '公司' },
          status: { label: '状态' },
          lead_score: { label: '线索评分' },
          source: { label: '来源' },
        },
      },
      crm_activity: {
        label: '活动',
        pluralLabel: '活动列表',
        fields: {
          subject: { label: '主题' },
          type: { label: '活动类型' },
          status: { label: '状态' },
          due_date: { label: '截止日期' },
          contact_id: { label: '联系人' },
          opportunity_id: { label: '商机' },
        },
      },
    },
    apps: {
      crm: {
        label: '客户管理',
        description: '客户关系管理系统',
        navigation: {
          sales: { label: '销售管理' },
          admin: { label: '系统管理' },
        },
      },
    },
    messages: {
      'crm.lead.convert.success': '线索已成功转化为商机。',
      'crm.lead.convert.error': '线索转化失败，请重试。',
      'crm.opportunity.won': '恭喜！商机已标记为赢单。',
      'crm.discount.pending_approval': '折扣需要经理审批。',
      'crm.activity.due_today': '您今天有 {count} 个活动待处理。',
    },
  },
});
