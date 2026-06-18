// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Theme } from '@objectstack/spec/ui';

/**
 * Default CRM brand theme — light mode with professional blue palette.
 */
export const CrmLightTheme: Theme = {
  name: 'crm_light',
  label: 'CRM Light',
  description: 'Default CRM theme — professional blue, light mode.',
  mode: 'light',
  colors: {
    primary: '#1E6FD9',
    secondary: '#6C757D',
    accent: '#17A2B8',
    background: '#FFFFFF',
    surface: '#F8F9FA',
    text: '#212529',
    textSecondary: '#6C757D',
    border: '#DEE2E6',
    success: '#28A745',
    warning: '#FFC107',
    error: '#DC3545',
    info: '#17A2B8',
  },
  typography: {
    fontFamily: { base: "'Inter', 'Segoe UI', system-ui, sans-serif" },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    },
  },
  borderRadius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    full: '9999px',
  },
  density: 'regular',
  wcagContrast: 'AA',
};

/**
 * Dark variant — same palette, dark surfaces.
 */
export const CrmDarkTheme: Theme = {
  name: 'crm_dark',
  label: 'CRM Dark',
  description: 'CRM dark mode theme.',
  mode: 'dark',
  extends: 'crm_light',
  colors: {
    primary: '#4D9EF5',
    secondary: '#ADB5BD',
    accent: '#3DD5F3',
    background: '#121212',
    surface: '#1E1E2E',
    text: '#E9ECEF',
    textSecondary: '#ADB5BD',
    border: '#343A40',
    success: '#40C057',
    warning: '#FFD43B',
    error: '#FA5252',
    info: '#3DD5F3',
  },
  density: 'regular',
};
