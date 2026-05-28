// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { OpportunityWonFlow } from './opportunity-won.flow.js';
import { LeadQualificationFlow } from './lead-qualification.flow.js';
import { RenewalReminderFlow } from './renewal-reminder.flow.js';
import { ConvertLeadScreenFlow } from './convert-lead.flow.js';

export { ConvertLeadScreenFlow } from './convert-lead.flow.js';

export const allFlows = [OpportunityWonFlow, LeadQualificationFlow, RenewalReminderFlow, ConvertLeadScreenFlow];
