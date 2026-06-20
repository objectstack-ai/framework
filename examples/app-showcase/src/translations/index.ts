// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * English + Simplified Chinese labels for the core showcase objects.
 *
 * Covers EVERY field surfaced as a column on the showcase pages so a list never
 * mixes locales (the prior bundle translated only a handful, leaving columns
 * like Project / Assignee / Progress falling back to their English field label
 * next to translated 状态 / 优先级 — an obvious inconsistency on a zh-CN session).
 */
export const ShowcaseTranslationBundle = {
  en: {
    objects: {
      showcase_project: {
        label: 'Project',
        pluralLabel: 'Projects',
        fields: {
          name: { label: 'Project Name' },
          account: { label: 'Account' },
          owner: { label: 'Owner' },
          status: { label: 'Status' },
          health: { label: 'Health' },
          budget: { label: 'Budget' },
          spent: { label: 'Spent' },
          start_date: { label: 'Start Date' },
          end_date: { label: 'End Date' },
        },
      },
      showcase_task: {
        label: 'Task',
        pluralLabel: 'Tasks',
        fields: {
          title: { label: 'Title' },
          project: { label: 'Project' },
          assignee: { label: 'Assignee' },
          status: { label: 'Status' },
          priority: { label: 'Priority' },
          due_date: { label: 'Due Date' },
          progress: { label: 'Progress' },
          estimate_hours: { label: 'Estimate (h)' },
          start_date: { label: 'Start Date' },
          end_date: { label: 'End Date' },
          created_at: { label: 'Created' },
          location: { label: 'Work Location' },
          cover: { label: 'Cover' },
        },
      },
      showcase_account: {
        label: 'Account',
        pluralLabel: 'Accounts',
        fields: {
          name: { label: 'Account Name' },
          industry: { label: 'Industry' },
          annual_revenue: { label: 'Annual Revenue' },
          website: { label: 'Website' },
          hq: { label: 'Headquarters' },
          status: { label: 'Lifecycle' },
          tax_id: { label: 'Tax ID' },
          billing_email: { label: 'Billing Email' },
          support_config: { label: 'Support Config' },
          churn_reason: { label: 'Churn Reason' },
        },
      },
      showcase_invoice: {
        label: 'Invoice',
        pluralLabel: 'Invoices',
        fields: {
          name: { label: 'Invoice Number' },
          account: { label: 'Account' },
          owner: { label: 'Owner' },
          status: { label: 'Status' },
          issued_on: { label: 'Issued On' },
          tax_rate: { label: 'Tax Rate (%)' },
          paid_on: { label: 'Paid On' },
          total: { label: 'Total' },
        },
      },
      showcase_preference: {
        label: 'Setting',
        pluralLabel: 'Settings',
        fields: {
          name: { label: 'Name' },
          theme: { label: 'Theme' },
          default_landing: { label: 'Default Landing Page' },
          email_digest: { label: 'Email Digest' },
          items_per_page: { label: 'Rows per Page' },
          notifications_enabled: { label: 'Enable Notifications' },
          compact_density: { label: 'Compact Density' },
        },
      },
    },
  },
  'zh-CN': {
    objects: {
      showcase_project: {
        label: '项目',
        pluralLabel: '项目',
        fields: {
          name: { label: '项目名称' },
          account: { label: '客户' },
          owner: { label: '负责人' },
          status: { label: '状态' },
          health: { label: '健康度' },
          budget: { label: '预算' },
          spent: { label: '已花费' },
          start_date: { label: '开始日期' },
          end_date: { label: '结束日期' },
        },
      },
      showcase_task: {
        label: '任务',
        pluralLabel: '任务',
        fields: {
          title: { label: '标题' },
          project: { label: '项目' },
          assignee: { label: '负责人' },
          status: { label: '状态' },
          priority: { label: '优先级' },
          due_date: { label: '截止日期' },
          progress: { label: '进度' },
          estimate_hours: { label: '预计工时' },
          start_date: { label: '开始日期' },
          end_date: { label: '结束日期' },
          created_at: { label: '创建时间' },
          location: { label: '工作地点' },
          cover: { label: '封面' },
        },
      },
      showcase_account: {
        label: '客户',
        pluralLabel: '客户',
        fields: {
          name: { label: '客户名称' },
          industry: { label: '行业' },
          annual_revenue: { label: '年收入' },
          website: { label: '网站' },
          hq: { label: '总部' },
          status: { label: '生命周期' },
          tax_id: { label: '税号' },
          billing_email: { label: '账单邮箱' },
          support_config: { label: '支持配置' },
          churn_reason: { label: '流失原因' },
        },
      },
      showcase_invoice: {
        label: '发票',
        pluralLabel: '发票',
        fields: {
          name: { label: '发票号' },
          account: { label: '客户' },
          owner: { label: '负责人' },
          status: { label: '状态' },
          issued_on: { label: '开具日期' },
          tax_rate: { label: '税率 (%)' },
          paid_on: { label: '付款日期' },
          total: { label: '合计' },
        },
      },
      showcase_preference: {
        label: '设置',
        pluralLabel: '设置',
        fields: {
          name: { label: '名称' },
          theme: { label: '主题' },
          default_landing: { label: '默认着陆页' },
          email_digest: { label: '邮件摘要' },
          items_per_page: { label: '每页行数' },
          notifications_enabled: { label: '启用通知' },
          compact_density: { label: '紧凑密度' },
        },
      },
    },
  },
};
