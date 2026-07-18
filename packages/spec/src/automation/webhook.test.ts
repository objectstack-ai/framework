import { describe, it, expect } from 'vitest';
import {
  WebhookSchema,
  WebhookReceiverSchema,
  WebhookTriggerType,
  type Webhook,
  type WebhookReceiver,
} from './webhook.zod';

describe('WebhookTriggerType', () => {
  it('should accept valid trigger types', () => {
    const validTypes = ['create', 'update', 'delete'];

    validTypes.forEach(type => {
      expect(() => WebhookTriggerType.parse(type)).not.toThrow();
    });
  });

  it('should reject undelete / api — removed, no event source (#3196)', () => {
    // `undelete` had no soft-delete/restore producer; `api` had no manual fire
    // path. Removed rather than left as silent no-ops — authoring one now fails
    // loudly instead of registering a webhook that never fires.
    expect(() => WebhookTriggerType.parse('undelete')).toThrow();
    expect(() => WebhookTriggerType.parse('api')).toThrow();
  });

  it('should reject invalid trigger types', () => {
    expect(() => WebhookTriggerType.parse('insert')).toThrow();
    expect(() => WebhookTriggerType.parse('modify')).toThrow();
    expect(() => WebhookTriggerType.parse('')).toThrow();
  });
});

describe('WebhookSchema', () => {
  it('should accept valid minimal webhook', () => {
    const webhook: Webhook = {
      name: 'account_webhook',
      object: 'account',
      triggers: ['create', 'update'],
      url: 'https://example.com/webhook',
    };

    expect(() => WebhookSchema.parse(webhook)).not.toThrow();
  });

  it('should validate webhook name format (snake_case)', () => {
    expect(() => WebhookSchema.parse({
      name: 'valid_webhook_name',
      object: 'account',
      triggers: ['create'],
      url: 'https://example.com/webhook',
    })).not.toThrow();

    expect(() => WebhookSchema.parse({
      name: 'InvalidWebhook',
      object: 'account',
      triggers: ['create'],
      url: 'https://example.com/webhook',
    })).toThrow();

    expect(() => WebhookSchema.parse({
      name: 'invalid-webhook',
      object: 'account',
      triggers: ['create'],
      url: 'https://example.com/webhook',
    })).toThrow();
  });

  it('should apply default values', () => {
    const webhook = WebhookSchema.parse({
      name: 'test_webhook',
      url: 'https://example.com/webhook',
    });

    expect(webhook.method).toBe('POST');
    expect(webhook.includeSession).toBe(false);
    expect(webhook.isActive).toBe(true);
    expect(webhook.timeoutMs).toBe(30000);
  });

  it('should accept webhook with all fields', () => {
    const webhook = WebhookSchema.parse({
      name: 'full_webhook',
      label: 'Full Webhook',
      object: 'contact',
      triggers: ['create', 'update', 'delete'],
      url: 'https://example.com/webhook',
      method: 'POST',
      secret: 'secret_key_123',
      headers: {
        'Authorization': 'Bearer token123',
        'X-Custom-Header': 'value',
      },
      payloadFields: ['name', 'email', 'phone'],
      includeSession: true,
      retryCount: 5,
      isActive: true,
    });

    expect(webhook.label).toBe('Full Webhook');
    expect(webhook.triggers).toHaveLength(3);
    expect(webhook.secret).toBe('secret_key_123');
  });

  it('should accept different HTTP methods', () => {
    const methods: Array<Webhook['method']> = ['POST', 'PUT', 'GET'];

    methods.forEach(method => {
      const webhook = WebhookSchema.parse({
        name: 'test_webhook',
        object: 'account',
        triggers: ['create'],
        url: 'https://example.com/webhook',
        method,
      });
      expect(webhook.method).toBe(method);
    });
  });

  it('should reject invalid HTTP method', () => {
    expect(() => WebhookSchema.parse({
      name: 'test_webhook',
      url: 'https://example.com/webhook',
      method: 'TRACE',
    })).toThrow();
  });

  it('should accept multiple triggers', () => {
    const webhook = WebhookSchema.parse({
      name: 'multi_trigger_webhook',
      object: 'account',
      triggers: ['create', 'update', 'delete'],
      url: 'https://example.com/webhook',
    });

    expect(webhook.triggers).toHaveLength(3);
  });

  it('should accept HMAC secret for signing', () => {
    const webhook = WebhookSchema.parse({
      name: 'secure_webhook',
      object: 'account',
      triggers: ['create'],
      url: 'https://example.com/webhook',
      secret: 'hmac_secret_key',
    });

    expect(webhook.secret).toBe('hmac_secret_key');
  });

  it('should accept custom headers', () => {
    const webhook = WebhookSchema.parse({
      name: 'auth_webhook',
      object: 'account',
      triggers: ['create'],
      url: 'https://example.com/webhook',
      headers: {
        'Authorization': 'Bearer token',
        'X-API-Key': 'api_key_123',
      },
    });

    expect(webhook.headers).toHaveProperty('Authorization');
    expect(webhook.headers).toHaveProperty('X-API-Key');
  });

  it('should accept payload field filtering', () => {
    const webhook = WebhookSchema.parse({
      name: 'filtered_webhook',
      object: 'contact',
      triggers: ['create'],
      url: 'https://example.com/webhook',
      payloadFields: ['email', 'name'],
    });

    expect(webhook.payloadFields).toEqual(['email', 'name']);
  });

  it('should accept session inclusion', () => {
    const webhook = WebhookSchema.parse({
      name: 'session_webhook',
      object: 'account',
      triggers: ['create'],
      url: 'https://example.com/webhook',
      includeSession: true,
    });

    expect(webhook.includeSession).toBe(true);
  });

  it('should accept custom retry count', () => {
    const webhook = WebhookSchema.parse({
      name: 'retry_webhook',
      url: 'https://example.com/webhook',
      retryPolicy: {
        maxRetries: 10,
        backoffStrategy: 'linear',
      }
    });

    expect(webhook.retryPolicy?.maxRetries).toBe(10);
  });

  it('should accept inactive webhook', () => {
    const webhook = WebhookSchema.parse({
      name: 'inactive_webhook',
      object: 'account',
      triggers: ['create'],
      url: 'https://example.com/webhook',
      isActive: false,
    });

    expect(webhook.isActive).toBe(false);
  });

  it('should validate URL format', () => {
    expect(() => WebhookSchema.parse({
      name: 'test_webhook',
      object: 'account',
      triggers: ['create'],
      url: 'not-a-url',
    })).toThrow();

    expect(() => WebhookSchema.parse({
      name: 'test_webhook',
      object: 'account',
      triggers: ['create'],
      url: 'https://example.com/webhook',
    })).not.toThrow();
  });

  it('should handle Slack webhook', () => {
    const webhook = WebhookSchema.parse({
      name: 'slack_notification',
      label: 'Slack Notification',
      object: 'opportunity',
      triggers: ['create'],
      url: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX',
      method: 'POST',
      payloadFields: ['name', 'amount', 'stage'],
    });

    expect(webhook.url).toContain('slack.com');
  });

  it('should handle Stripe webhook', () => {
    const webhook = WebhookSchema.parse({
      name: 'stripe_payment',
      object: 'payment',
      triggers: ['create', 'update'],
      url: 'https://example.com/stripe/webhook',
      secret: 'whsec_stripe_signing_secret',
      retryCount: 5,
    });

    expect(webhook.secret).toContain('whsec');
  });

  it('should reject webhook without required fields', () => {
    expect(() => WebhookSchema.parse({
      url: 'https://example.com/webhook',
    })).toThrow();

    expect(() => WebhookSchema.parse({
      name: 'test_webhook',
    })).toThrow();
  });
});

describe('WebhookReceiverSchema', () => {
  it('should accept valid minimal webhook receiver', () => {
    const receiver: WebhookReceiver = {
      name: 'stripe_receiver',
      path: '/webhooks/stripe',
      target: 'stripe_flow',
    };

    expect(() => WebhookReceiverSchema.parse(receiver)).not.toThrow();
  });

  it('should validate receiver name format (snake_case)', () => {
    expect(() => WebhookReceiverSchema.parse({
      name: 'valid_receiver_name',
      path: '/webhooks/test',
      target: 'flow_id',
    })).not.toThrow();

    expect(() => WebhookReceiverSchema.parse({
      name: 'InvalidReceiver',
      path: '/webhooks/test',
      target: 'flow_id',
    })).toThrow();
  });

  it('should apply default values', () => {
    const receiver = WebhookReceiverSchema.parse({
      name: 'test_receiver',
      path: '/webhooks/test',
      target: 'flow_id',
    });

    expect(receiver.verificationType).toBe('none');
    expect(receiver.action).toBe('trigger_flow');
  });

  it('should accept receiver with all fields', () => {
    const receiver = WebhookReceiverSchema.parse({
      name: 'secure_receiver',
      path: '/webhooks/secure',
      verificationType: 'hmac',
      verificationParams: {
        header: 'X-Hub-Signature',
        secret: 'secret_key',
      },
      action: 'trigger_flow',
      target: 'processing_flow',
    });

    expect(receiver.verificationType).toBe('hmac');
    expect(receiver.verificationParams?.secret).toBe('secret_key');
  });

  it('should accept different verification types', () => {
    const types: Array<WebhookReceiver['verificationType']> = ['none', 'header_token', 'hmac', 'ip_whitelist'];

    types.forEach(type => {
      const receiver = WebhookReceiverSchema.parse({
        name: 'test_receiver',
        path: '/webhooks/test',
        verificationType: type,
        target: 'flow_id',
      });
      expect(receiver.verificationType).toBe(type);
    });
  });

  it('should accept different action types', () => {
    const actions: Array<WebhookReceiver['action']> = ['trigger_flow', 'script', 'upsert_record'];

    actions.forEach(action => {
      const receiver = WebhookReceiverSchema.parse({
        name: 'test_receiver',
        path: '/webhooks/test',
        action,
        target: 'target_id',
      });
      expect(receiver.action).toBe(action);
    });
  });

  it('should accept header token verification', () => {
    const receiver = WebhookReceiverSchema.parse({
      name: 'header_auth_receiver',
      path: '/webhooks/auth',
      verificationType: 'header_token',
      verificationParams: {
        header: 'X-API-Token',
        secret: 'expected_token_value',
      },
      target: 'flow_id',
    });

    expect(receiver.verificationType).toBe('header_token');
  });

  it('should accept HMAC verification', () => {
    const receiver = WebhookReceiverSchema.parse({
      name: 'hmac_receiver',
      path: '/webhooks/hmac',
      verificationType: 'hmac',
      verificationParams: {
        header: 'X-Hub-Signature-256',
        secret: 'hmac_secret',
      },
      target: 'flow_id',
    });

    expect(receiver.verificationType).toBe('hmac');
  });

  it('should accept IP whitelist verification', () => {
    const receiver = WebhookReceiverSchema.parse({
      name: 'ip_receiver',
      path: '/webhooks/ip',
      verificationType: 'ip_whitelist',
      verificationParams: {
        ips: ['192.168.1.1', '10.0.0.0/8'],
      },
      target: 'flow_id',
    });

    expect(receiver.verificationParams?.ips).toHaveLength(2);
  });

  it('should handle GitHub webhook receiver', () => {
    const receiver = WebhookReceiverSchema.parse({
      name: 'github_webhook',
      path: '/webhooks/github',
      verificationType: 'hmac',
      verificationParams: {
        header: 'X-Hub-Signature-256',
        secret: 'github_webhook_secret',
      },
      action: 'trigger_flow',
      target: 'github_flow',
    });

    expect(receiver.path).toBe('/webhooks/github');
  });

  it('should handle Stripe webhook receiver', () => {
    const receiver = WebhookReceiverSchema.parse({
      name: 'stripe_webhook',
      path: '/webhooks/stripe',
      verificationType: 'hmac',
      verificationParams: {
        secret: 'whsec_stripe_signing_secret',
      },
      action: 'upsert_record',
      target: 'payment_object',
    });

    expect(receiver.action).toBe('upsert_record');
  });

  it('should reject receiver without required fields', () => {
    expect(() => WebhookReceiverSchema.parse({
      path: '/webhooks/test',
      target: 'flow_id',
    })).toThrow();

    expect(() => WebhookReceiverSchema.parse({
      name: 'test_receiver',
      target: 'flow_id',
    })).toThrow();

    expect(() => WebhookReceiverSchema.parse({
      name: 'test_receiver',
      path: '/webhooks/test',
    })).toThrow();
  });
});
