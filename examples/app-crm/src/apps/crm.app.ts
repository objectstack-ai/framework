// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { App } from '@objectstack/spec/ui';

export const CrmApp = App.create({
  name: 'crm_enterprise',
  label: 'Enterprise CRM',
  icon: 'briefcase',
  defaultAgent: 'sales_copilot',
  branding: {
    primaryColor: '#4169E1',
    logo: '/assets/crm-logo.png',
    favicon: '/assets/crm-favicon.ico',
  },
  
  navigation: [
    {
      id: 'group_sales',
      type: 'group',
      label: 'Sales',
      icon: 'chart-line',
      expanded: true,
      children: [
        { id: 'nav_lead', type: 'object', objectName: 'lead', label: 'Leads', icon: 'user-plus' },
        { id: 'nav_account', type: 'object', objectName: 'account', label: 'Accounts', icon: 'building' },
        { id: 'nav_contact', type: 'object', objectName: 'contact', label: 'Contacts', icon: 'user' },
        { id: 'nav_opportunity', type: 'object', objectName: 'opportunity', label: 'Opportunities', icon: 'target' },
        { id: 'nav_quote', type: 'object', objectName: 'quote', label: 'Quotes', icon: 'receipt' },
        { id: 'nav_contract', type: 'object', objectName: 'contract', label: 'Contracts', icon: 'file-pen-line' },
        // Business-prominence shortcut: power users open the Kanban directly.
        { id: 'nav_pipeline', type: 'object', objectName: 'opportunity', viewName: 'pipeline_kanban', label: 'Sales Pipeline', icon: 'columns-3' },
        { id: 'nav_sales_dashboard', type: 'dashboard', dashboardName: 'sales_dashboard', label: 'Sales Dashboard', icon: 'chart-bar' },
      ],
    },
    {
      id: 'group_service',
      type: 'group',
      label: 'Service',
      icon: 'headset',
      expanded: true,
      children: [
        { id: 'nav_case', type: 'object', objectName: 'case', label: 'Cases', icon: 'life-buoy' },
        { id: 'nav_task', type: 'object', objectName: 'task', label: 'Tasks', icon: 'list-checks' },
        // Business-prominence shortcut: support managers open the workflow board directly.
        { id: 'nav_case_board', type: 'object', objectName: 'case', viewName: 'case_workflow', label: 'Service Board', icon: 'columns-3' },
        { id: 'nav_service_dashboard', type: 'dashboard', dashboardName: 'service_dashboard', label: 'Service Dashboard', icon: 'chart-pie' },
      ],
    },
    {
      id: 'group_marketing',
      type: 'group',
      label: 'Marketing',
      icon: 'megaphone',
      expanded: true,
      children: [
        { id: 'nav_campaign', type: 'object', objectName: 'campaign', label: 'Campaigns', icon: 'megaphone' },
        // Lead lives in Sales (where reps convert them daily). Marketing
        // surfaces lead generation via Campaigns; users jump to a specific
        // lead from the campaign detail or via global search.
      ],
    },
    {
      id: 'group_products',
      type: 'group',
      label: 'Products',
      icon: 'box',
      children: [
        { id: 'nav_product', type: 'object', objectName: 'product', label: 'Products', icon: 'box-open' },
      ],
    },
    {
      id: 'group_analytics',
      type: 'group',
      label: 'Analytics',
      icon: 'chart-area',
      children: [
        // Analytics hosts cross-functional executive views only. Operational
        // dashboards (Sales / Service) live in their owning functional group
        // to keep each item in exactly one place.
        { id: 'nav_exec_dashboard', type: 'dashboard', dashboardName: 'executive_dashboard', label: 'Executive Dashboard', icon: 'gauge' },
      ],
    },
    {
      id: 'group_reports',
      type: 'group',
      label: 'Reports',
      icon: 'chart-bar',
      expanded: true,
      children: [
        // Matrix reports — exercise the new spec `groupingsAcross` +
        // `dateGranularity` end-to-end. Naming matches the report definitions
        // so users can correlate the sidebar item to source code.
        { id: 'nav_report_pipeline_coverage', type: 'report', reportName: 'pipeline_coverage_by_quarter', label: 'Pipeline Coverage (Quarter)', icon: 'columns-3' },
        { id: 'nav_report_lead_inflow',       type: 'report', reportName: 'lead_inflow_by_month_source',  label: 'Lead Inflow (Month)',         icon: 'trending-up' },
        { id: 'nav_report_cases_daily',       type: 'report', reportName: 'cases_opened_by_day_priority', label: 'Cases Opened (Day)',          icon: 'calendar-days' },
        { id: 'nav_report_account_matrix',    type: 'report', reportName: 'accounts_by_industry_type',    label: 'Accounts by Industry × Type', icon: 'grid-3x3' },
        // Multi-level summary
        { id: 'nav_report_funnel_owner',      type: 'report', reportName: 'opportunity_funnel_owner_stage', label: 'Funnel by Owner → Stage',   icon: 'filter' },
        // Single-axis summaries
        { id: 'nav_report_opps_by_stage',     type: 'report', reportName: 'opportunities_by_stage',       label: 'Opportunities by Stage',      icon: 'bar-chart-3' },
        { id: 'nav_report_won_by_owner',      type: 'report', reportName: 'won_opportunities_by_owner',   label: 'Won by Owner',                icon: 'trophy' },
        { id: 'nav_report_cases_by_status',   type: 'report', reportName: 'cases_by_status_priority',     label: 'Cases by Status × Priority',  icon: 'life-buoy' },
        { id: 'nav_report_sla',               type: 'report', reportName: 'sla_performance',              label: 'SLA Performance',             icon: 'timer' },
        // Joined report — multi-block analytic surface (M3).
        { id: 'nav_report_churn',             type: 'report', reportName: 'customer_churn_signals',       label: 'Customer Churn Signals',      icon: 'alert-triangle' },
      ],
    },
    {
      id: 'group_approvals',
      type: 'group',
      label: 'Approvals',
      icon: 'check-circle',
      expanded: true,
      children: [
        { id: 'nav_approval_requests', type: 'object', objectName: 'sys_approval_request', label: 'Approval Requests', icon: 'inbox',    requiresObject: 'sys_approval_request' },
        { id: 'nav_approval_actions',  type: 'object', objectName: 'sys_approval_action',  label: 'Action History',    icon: 'history',  requiresObject: 'sys_approval_action' },
        { id: 'nav_approval_processes',type: 'object', objectName: 'sys_approval_process', label: 'Processes',         icon: 'workflow', requiresObject: 'sys_approval_process' },
      ],
    },
  ],
});
