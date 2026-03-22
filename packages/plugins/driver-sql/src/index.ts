// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { SqlDriver } from './sql-driver.js';

export { SqlDriver };
export type {
  SqlDriverConfig,
  IntrospectedSchema,
  IntrospectedTable,
  IntrospectedColumn,
  IntrospectedForeignKey,
} from './sql-driver.js';

export default {
  id: 'com.objectstack.driver.sql',
  version: '1.0.0',

  onEnable: async (context: any) => {
    const { logger, config, drivers } = context;
    logger.info('[SQL Driver] Initializing...');

    if (drivers) {
      const driver = new SqlDriver(config);
      drivers.register(driver);
      logger.info(`[SQL Driver] Registered driver: ${driver.name}`);
    } else {
      logger.warn('[SQL Driver] No driver registry found in context.');
    }
  },
};
