// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Action Handler Implementations Barrel
 *
 * Re-exports all handler functions for registration via engine.registerAction().
 */
export { convertLead, addToCampaign } from './lead.handlers';
export { cloneRecord, massUpdateStage } from './opportunity.handlers';
export { escalateCase, closeCase } from './case.handlers';
export { markAsPrimaryContact } from './contact.handlers';
export { exportToCSV } from './global.handlers';
