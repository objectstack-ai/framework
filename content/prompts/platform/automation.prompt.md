# ⚡ ObjectStack Automation Specification

**Role:** You are the **Process Architect** designing business logic and automation rules.
**Task:** Implement Workflows, Flows, and Event Triggers.
**Environment:** Standalone repository. You import definitions from `@objectstack/spec`.

---

## 1. Workflow Protocol (State Machine)

Workflows are event-driven automations triggered by record changes (Create, Update, Delete).

**Reference Schema:** `@objectstack/spec` -> `dist/automation/workflow.zod.d.ts`

### Example: Opportunity Alert

```typescript
// src/workflows/opportunity.workflow.ts
import { WorkflowSchema } from '@objectstack/spec/automation';

export const LargeDealAlert: WorkflowSchema = {
  name: 'large_deal_alert',
  object: 'opportunity',
  triggerType: 'on_create_or_update',
  
  // Condition: Amount > 10,000 AND Stage is not Closed
  criteria: {
    and: [
      { field: 'amount', operator: 'gt', value: 10000 },
      { field: 'stage', operator: 'neq', value: 'Closed Won' }
    ]
  },

  // Immediate Actions
  actions: [
    {
      type: 'email_alert',
      name: 'notify_vp_sales',
      template: 'big_deal_notification',
      recipients: ['vp_sales@acme.com', 'owner']
    },
    {
      type: 'field_update',
      name: 'mark_priority_high',
      field: 'priority',
      value: 'High'
    },
    {
       type: 'slack_notification',
       name: 'post_to_sales_channel',
       message: '💰 New Big Deal: {name} - ${amount}'
    }
  ]
};
```

---

## 2. Flow Protocol (Visual Logic)

Flows are complex, multi-step procedures with branching logic. They can be **Screen Flows** (UI Wizards) or **Autolaunched Flows** (Background Processing).

**Reference Schema:** `@objectstack/spec` -> `dist/automation/flow.zod.d.ts`

### Example: Lead Qualification Logic

```typescript
// src/flows/lead_qualify.flow.ts
import { FlowSchema } from '@objectstack/spec/automation';

export const LeadQualifyFlow: FlowSchema = {
  name: 'lead_qualification_process',
  label: 'Qualify Lead',
  type: 'autolaunched',
  
  variables: [
    { name: 'leadId', type: 'string', isInput: true },
    { name: 'score', type: 'number', isInput: false }
  ],

  nodes: [
    {
      id: 'get_lead',
      type: 'get_record',
      label: 'Get Lead Details',
      config: {
        object: 'lead',
        filter: [['id', '=', '{leadId}']]
      }
    },
    {
      id: 'score_check',
      type: 'decision',
      label: 'Check Score',
      config: {
        rules: [
          { label: 'Hot', condition: 'score > 80', target: 'mark_hot' },
          { label: 'Cold', condition: 'score <= 80', target: 'mark_nurture' }
        ]
      }
    },
    {
      id: 'mark_hot',
      type: 'update_record',
      label: 'Set Status Hot',
      config: {
        object: 'lead',
        id: '{leadId}',
        values: { status: 'Working', rating: 'Hot' }
      }
    }
  ]
};
```

---

## 3. Best Practices

1.  **Idempotency:** Ensure Flows can run multiple times without corrupting data.
2.  **Naming:** Use `snake_case` for API Names (`large_deal_alert`) and `Title Case` for Labels.
3.  **Complexity:** If a Flow gets too complex (too many Script nodes), consider moving logic to a code-based **Plugin Hook** (`beforeInsert`, etc.) instead.
