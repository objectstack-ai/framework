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
    },
  },
};
