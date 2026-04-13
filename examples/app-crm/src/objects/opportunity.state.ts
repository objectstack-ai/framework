// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { StateMachineConfig } from '@objectstack/spec/automation';

/**
 * Opportunity Sales Pipeline State Machine
 * 
 * Defines the strict stage transitions for Opportunities to enforce
 * a valid sales process and guide AI agents.
 */
export const OpportunityStateMachine: StateMachineConfig = {
  id: 'opportunity_pipeline',
  initial: 'prospecting',
  states: {
    prospecting: {
      on: {
        QUALIFY: { target: 'qualification', description: 'Initial qualification passed' },
        LOSE: { target: 'closed_lost', description: 'Lost at prospecting stage' },
      },
      meta: {
        aiInstructions: 'New opportunity. Identify decision makers and confirm budget exists before advancing.',
      },
    },
    qualification: {
      on: {
        ANALYZE: { target: 'needs_analysis', description: 'Begin needs analysis' },
        LOSE: { target: 'closed_lost', description: 'Lost at qualification stage' },
      },
      meta: {
        aiInstructions: 'Qualifying opportunity. Gather BANT (Budget, Authority, Need, Timeline) details.',
      },
    },
    needs_analysis: {
      on: {
        PROPOSE: { target: 'proposal', description: 'Submit proposal' },
        LOSE: { target: 'closed_lost', description: 'Lost during needs analysis' },
      },
      meta: {
        aiInstructions: 'Analyzing customer needs. Document requirements and pain points before proposing.',
      },
    },
    proposal: {
      on: {
        NEGOTIATE: { target: 'negotiation', description: 'Enter negotiation' },
        LOSE: { target: 'closed_lost', description: 'Proposal rejected' },
      },
      meta: {
        aiInstructions: 'Proposal submitted. Follow up on pricing and terms. Prepare for negotiation.',
      },
    },
    negotiation: {
      on: {
        WIN: { target: 'closed_won', description: 'Deal won' },
        LOSE: { target: 'closed_lost', description: 'Lost in negotiation' },
      },
      meta: {
        aiInstructions: 'In negotiation. Focus on closing. Escalate blockers to management if needed.',
      },
    },
    closed_won: {
      type: 'final',
      meta: {
        aiInstructions: 'Deal won. No further stage changes allowed. Trigger contract creation.',
      },
    },
    closed_lost: {
      type: 'final',
      meta: {
        aiInstructions: 'Deal lost. Record loss reason. No further stage changes allowed.',
      },
    },
  },
};
