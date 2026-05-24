import { describe, it, expect } from 'vitest';
import {
  WorkflowRuleSchema,
  WorkflowTriggerType,
  FieldUpdateActionSchema,
  EmailAlertActionSchema,
  ConnectorActionRefSchema,
  HttpCallActionSchema,
  TaskCreationActionSchema,
  PushNotificationActionSchema,
  CustomScriptActionSchema,
  WorkflowActionSchema,
  type WorkflowRule,
} from './workflow.zod';

describe('WorkflowTriggerType', () => {
  it('should accept all trigger types', () => {
    const types = ['on_create', 'on_update', 'on_create_or_update', 'on_delete', 'schedule'];
    
    types.forEach(type => {
      expect(() => WorkflowTriggerType.parse(type)).not.toThrow();
    });
  });

  it('should reject invalid trigger types', () => {
    expect(() => WorkflowTriggerType.parse('invalid')).toThrow();
    expect(() => WorkflowTriggerType.parse('on_save')).toThrow();
  });
});

describe('FieldUpdateActionSchema', () => {
  it('should accept field update action', () => {
    const action = {
      name: 'set_status',
      type: 'field_update' as const,
      field: 'status',
      value: 'approved',
    };

    expect(() => FieldUpdateActionSchema.parse(action)).not.toThrow();
  });

  it('should accept field update with formula', () => {
    const action = {
      name: 'calculate_total',
      type: 'field_update' as const,
      field: 'total_amount',
      value: 'quantity * price',
    };

    expect(() => FieldUpdateActionSchema.parse(action)).not.toThrow();
  });
});

describe('EmailAlertActionSchema', () => {
  it('should accept email alert action', () => {
    const action = {
      name: 'notify_manager',
      type: 'email_alert' as const,
      template: 'approval_request',
      recipients: ['manager@example.com'],
    };

    expect(() => EmailAlertActionSchema.parse(action)).not.toThrow();
  });

  it('should accept email alert with multiple recipients', () => {
    const action = {
      name: 'notify_team',
      type: 'email_alert' as const,
      template: 'task_assigned',
      recipients: ['user1@example.com', 'user2@example.com', '{owner.email}'],
    };

    expect(() => EmailAlertActionSchema.parse(action)).not.toThrow();
  });
});

describe('ConnectorActionRefSchema', () => {
  it('should accept generic connector action (e.g. Slack)', () => {
    const action = {
      name: 'notify_slack',
      type: 'connector_action' as const,
      connectorId: 'slack',
      actionId: 'post_message',
      input: {
        channel: '#general',
        text: 'New lead created!',
      },
    };

    expect(() => ConnectorActionRefSchema.parse(action)).not.toThrow();
  });

  it('should accept generic connector action (e.g. Twilio)', () => {
    const action = {
      name: 'send_sms',
      type: 'connector_action' as const,
      connectorId: 'twilio',
      actionId: 'send_sms',
      input: {
        to: '+1234567890',
        message: 'Your order has been shipped!',
      },
    };

    expect(() => ConnectorActionRefSchema.parse(action)).not.toThrow();
  });

  it('should validate input is a record', () => {
    const action = {
      name: 'invalid_action',
      type: 'connector_action' as const,
      connectorId: 'slack',
      actionId: 'post_message',
      input: 'invalid_input', // Should be an object
    };

    expect(() => ConnectorActionRefSchema.parse(action)).toThrow();
  });
});

describe('HttpCallActionSchema', () => {
  it('should accept basic GET request', () => {
    const action = {
      name: 'fetch_data',
      type: 'http_call' as const,
      url: 'https://api.example.com/data',
      method: 'GET' as const,
    };

    expect(() => HttpCallActionSchema.parse(action)).not.toThrow();
  });

  it('should accept POST request with body and headers', () => {
    const action = {
      name: 'send_data',
      type: 'http_call' as const,
      url: 'https://api.example.com/create',
      method: 'POST' as const,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Version': 'v1',
      },
      body: JSON.stringify({
        name: '{record.name}',
        value: '{record.value}',
      }),
    };

    expect(() => HttpCallActionSchema.parse(action)).not.toThrow();
  });

  it('should accept all HTTP methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
    
    methods.forEach(method => {
      const action = {
        name: `test_${method.toLowerCase()}`,
        type: 'http_call' as const,
        url: 'https://api.example.com/test',
        method,
      };
      expect(() => HttpCallActionSchema.parse(action)).not.toThrow();
    });
  });
});

describe('TaskCreationActionSchema', () => {
  it('should accept minimal task creation', () => {
    const action = {
      name: 'create_followup_task',
      type: 'task_creation' as const,
      taskObject: 'task',
      subject: 'Follow up with customer',
    };

    expect(() => TaskCreationActionSchema.parse(action)).not.toThrow();
  });

  it('should accept complete task creation', () => {
    const action = {
      name: 'create_project_task',
      type: 'task_creation' as const,
      taskObject: 'project_task',
      subject: 'Review and approve proposal',
      description: 'Please review the proposal and provide feedback',
      assignedTo: '{owner.manager_id}',
      dueDate: 'TODAY() + 7',
      priority: 'high',
      relatedTo: '{record.id}',
      additionalFields: {
        environment_id: '{record.environment_id}',
        estimated_hours: 4,
      },
    };

    expect(() => TaskCreationActionSchema.parse(action)).not.toThrow();
  });
});

describe('PushNotificationActionSchema', () => {
  it('should accept basic push notification', () => {
    const action = {
      name: 'send_push',
      type: 'push_notification' as const,
      title: 'New Message',
      body: 'You have a new message from support',
      recipients: ['user-123', 'user-456'],
    };

    expect(() => PushNotificationActionSchema.parse(action)).not.toThrow();
  });

  it('should accept push notification with full configuration', () => {
    const action = {
      name: 'send_rich_push',
      type: 'push_notification' as const,
      title: 'Order Shipped',
      body: 'Your order #12345 has been shipped!',
      recipients: ['{customer.device_token}'],
      data: {
        orderId: '{record.id}',
        trackingNumber: '{record.tracking_number}',
      },
      badge: 1,
      sound: 'notification.wav',
      clickAction: '/orders/{record.id}',
    };

    expect(() => PushNotificationActionSchema.parse(action)).not.toThrow();
  });
});

describe('CustomScriptActionSchema', () => {
  it('should accept JavaScript script with defaults', () => {
    const action = {
      name: 'run_custom_logic',
      type: 'custom_script' as const,
      code: 'console.log("Hello from workflow");',
    };

    const result = CustomScriptActionSchema.parse(action);
    expect(result.language).toBe('javascript');
    expect(result.timeout).toBe(30000);
  });

  it('should accept TypeScript script', () => {
    const action = {
      name: 'calculate_score',
      type: 'custom_script' as const,
      language: 'typescript' as const,
      code: `
        const score = record.value1 * 0.3 + record.value2 * 0.7;
        return { score };
      `,
      timeout: 10000,
      context: {
        record: '{record}',
        user: '{$User}',
      },
    };

    expect(() => CustomScriptActionSchema.parse(action)).not.toThrow();
  });

  it('should accept Python script', () => {
    const action = {
      name: 'data_processing',
      type: 'custom_script' as const,
      language: 'python' as const,
      code: 'import json\nresult = json.dumps({"processed": True})',
      timeout: 60000,
    };

    expect(() => CustomScriptActionSchema.parse(action)).not.toThrow();
  });
});

describe('WorkflowActionSchema', () => {
  it('should accept field update action', () => {
    const action = {
      name: 'update_field',
      type: 'field_update' as const,
      field: 'priority',
      value: 'high',
    };

    expect(() => WorkflowActionSchema.parse(action)).not.toThrow();
  });

  it('should accept email alert action', () => {
    const action = {
      name: 'send_email',
      type: 'email_alert' as const,
      template: 'welcome_email',
      recipients: ['user@example.com'],
    };

    expect(() => WorkflowActionSchema.parse(action)).not.toThrow();
  });

  it('should accept connector action (SMS)', () => {
    const action = {
      name: 'send_sms',
      type: 'connector_action' as const,
      connectorId: 'twilio',
      actionId: 'send_sms',
      input: {
        recipients: ['+1234567890'],
        message: 'Test message',
      },
    };

    expect(() => WorkflowActionSchema.parse(action)).not.toThrow();
  });

  it('should accept connector action (Slack)', () => {
    const action = {
      name: 'send_slack',
      type: 'connector_action' as const,
      connectorId: 'slack',
      actionId: 'post_message',
      input: {
        channel: '#general',
        message: 'Test message',
      },
    };

    expect(() => WorkflowActionSchema.parse(action)).not.toThrow();
  });

  it('should accept connector action (Teams)', () => {
    const action = {
      name: 'send_teams',
      type: 'connector_action' as const,
      connectorId: 'teams',
      actionId: 'send_message',
      input: {
        channel: 'channel-id',
        message: 'Test message',
      },
    };

    expect(() => WorkflowActionSchema.parse(action)).not.toThrow();
  });

  it('should accept HTTP call action', () => {
    const action = {
      name: 'api_call',
      type: 'http_call' as const,
      url: 'https://api.example.com/endpoint',
      method: 'POST' as const,
    };

    expect(() => WorkflowActionSchema.parse(action)).not.toThrow();
  });

  it('should accept task creation action', () => {
    const action = {
      name: 'create_task',
      type: 'task_creation' as const,
      taskObject: 'task',
      subject: 'Follow up',
    };

    expect(() => WorkflowActionSchema.parse(action)).not.toThrow();
  });

  it('should accept push notification action', () => {
    const action = {
      name: 'send_push',
      type: 'push_notification' as const,
      title: 'Notification',
      body: 'You have a new update',
      recipients: ['user-123'],
    };

    expect(() => WorkflowActionSchema.parse(action)).not.toThrow();
  });
});

describe('WorkflowRuleSchema', () => {
  it('should accept valid workflow rule', () => {
    const rule = {
      name: 'new_lead_process',
      objectName: 'lead',
      triggerType: 'on_create',
      criteria: 'amount > 1000',
      active: true,
      actions: [
        {
          name: 'set_status',
          type: 'field_update' as const,
          field: 'status',
          value: 'new',
        },
        {
          name: 'notify_team',
          type: 'connector_action' as const,
          connectorId: 'slack',
          actionId: 'post_message',
          input: { channel: '#sales', text: 'New high value lead!' },
        },
      ],
      timeTriggers: [
        {
          timeLength: 2,
          timeUnit: 'days',
          offsetDirection: 'after',
          offsetFrom: 'trigger_date',
          actions: [
            {
              name: 'followup_check',
              type: 'task_creation' as const,
              taskObject: 'task',
              subject: 'Follow up lead',
              dueDate: 'TODAY()',
            },
          ],
        },
      ],
    };

    expect(() => WorkflowRuleSchema.parse(rule)).not.toThrow();
    const parsed = WorkflowRuleSchema.parse(rule);
    expect(parsed.name).toBe('new_lead_process');
  });

  it('should reject invalid workflow name (PascalCase)', () => {
    const rule = {
      name: 'NewLeadProcess', // Invalid
      objectName: 'lead',
      triggerType: 'on_create',
    };
    expect(() => WorkflowRuleSchema.parse(rule)).toThrow();
  });

  it('should reject invalid workflow name (spaces)', () => {
    const rule = {
      name: 'new lead process', // Invalid
      objectName: 'lead',
      triggerType: 'on_create',
    };
    expect(() => WorkflowRuleSchema.parse(rule)).toThrow();
  });
});

// ============================================================================
// Protocol Improvement Tests: Workflow executionOrder
// ============================================================================

describe('WorkflowRuleSchema - executionOrder', () => {
  it('should accept workflow with custom executionOrder', () => {
    const result = WorkflowRuleSchema.parse({
      name: 'first_workflow',
      objectName: 'order',
      triggerType: 'on_create',
      executionOrder: 10,
    });
    expect(result.executionOrder).toBe(10);
  });

  it('should default executionOrder to 100', () => {
    const result = WorkflowRuleSchema.parse({
      name: 'default_order',
      objectName: 'order',
      triggerType: 'on_create',
    });
    expect(result.executionOrder).toBe(100);
  });

  it('should accept executionOrder of 0', () => {
    const result = WorkflowRuleSchema.parse({
      name: 'first_ever',
      objectName: 'lead',
      triggerType: 'on_update',
      executionOrder: 0,
    });
    expect(result.executionOrder).toBe(0);
  });
});
