// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { DatasourceInput } from '@objectstack/spec/data';

/**
 * Primary CRM datasource — in-memory SQLite for the example.
 * In production, swap `driver` to 'postgres' and supply real `config`.
 */
export const CrmDatasource: DatasourceInput = {
  name: 'crm_primary',
  label: 'CRM Primary Database',
  driver: 'sqlite',
  config: {
    filename: ':memory:',
  },
  pool: {
    min: 1,
    max: 5,
  },
  active: true,
};

/**
 * Read-replica for analytics queries — demonstrates datasource routing.
 */
export const CrmAnalyticsDatasource: DatasourceInput = {
  name: 'crm_analytics',
  label: 'CRM Analytics Read Replica',
  driver: 'sqlite',
  config: {
    filename: ':memory:',
    readOnly: true,
  },
  active: true,
};
