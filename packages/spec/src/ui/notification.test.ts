import { describe, it, expect } from 'vitest';
import {
  NotificationTypeSchema,
  NotificationSeveritySchema,
  NotificationPositionSchema,
  NotificationActionSchema,
  NotificationSchema,
  NotificationConfigSchema,
  type NotificationType,
  type NotificationSeverity,
  type NotificationPosition,
  type NotificationAction,
  type Notification,
  type NotificationConfig,
} from './notification.zod';

describe('NotificationTypeSchema', () => {
  it('should accept all valid notification types', () => {
    const types = ['toast', 'snackbar', 'banner', 'alert', 'inline'] as const;
    types.forEach(type => {
      expect(() => NotificationTypeSchema.parse(type)).not.toThrow();
    });
  });

  it('should reject invalid notification types', () => {
    expect(() => NotificationTypeSchema.parse('popup')).toThrow();
    expect(() => NotificationTypeSchema.parse('')).toThrow();
  });
});

describe('NotificationSeveritySchema', () => {
  it('should accept all valid severities', () => {
    const severities = ['info', 'success', 'warning', 'error'] as const;
    severities.forEach(severity => {
      expect(() => NotificationSeveritySchema.parse(severity)).not.toThrow();
    });
  });

  it('should reject invalid severities', () => {
    expect(() => NotificationSeveritySchema.parse('critical')).toThrow();
    expect(() => NotificationSeveritySchema.parse('')).toThrow();
  });
});

describe('NotificationPositionSchema', () => {
  it('should accept all valid positions', () => {
    const positions = ['top_left', 'top_center', 'top_right', 'bottom_left', 'bottom_center', 'bottom_right'] as const;
    positions.forEach(position => {
      expect(() => NotificationPositionSchema.parse(position)).not.toThrow();
    });
  });

  it('should reject invalid positions', () => {
    expect(() => NotificationPositionSchema.parse('center')).toThrow();
    expect(() => NotificationPositionSchema.parse('')).toThrow();
  });
});

describe('NotificationActionSchema', () => {
  it('should accept a valid action', () => {
    const action: NotificationAction = { label: 'Undo', action: 'undo', variant: 'primary' };
    const result = NotificationActionSchema.parse(action);
    expect(result.label).toBe('Undo');
    expect(result.action).toBe('undo');
    expect(result.variant).toBe('primary');
  });

  it('should default variant to primary', () => {
    const result = NotificationActionSchema.parse({ label: 'Retry', action: 'retry' });
    expect(result.variant).toBe('primary');
  });

  it('should reject missing label', () => {
    expect(() => NotificationActionSchema.parse({ action: 'undo' })).toThrow();
  });

  it('should reject missing action', () => {
    expect(() => NotificationActionSchema.parse({ label: 'Undo' })).toThrow();
  });
});

describe('NotificationSchema', () => {
  it('should apply defaults for minimal config', () => {
    const result = NotificationSchema.parse({ message: 'Something happened' });
    expect(result.type).toBe('toast');
    expect(result.severity).toBe('info');
    expect(result.dismissible).toBe(true);
  });

  it('should accept full config with title, message, actions, and position', () => {
    const notification: Notification = {
      type: 'banner',
      severity: 'error',
      title: 'System Error',
      message: 'An unexpected error occurred',
      icon: 'error_outline',
      duration: 10000,
      dismissible: false,
      actions: [
        { label: 'Retry', action: 'retry', variant: 'primary' },
        { label: 'Dismiss', action: 'dismiss', variant: 'link' },
      ],
      position: 'top_center',
    };
    const result = NotificationSchema.parse(notification);
    expect(result.type).toBe('banner');
    expect(result.severity).toBe('error');
    expect(result.title).toBe('System Error');
    expect(result.actions).toHaveLength(2);
    expect(result.position).toBe('top_center');
    expect(result.dismissible).toBe(false);
  });

  it('should reject missing message', () => {
    expect(() => NotificationSchema.parse({ type: 'toast', severity: 'info' })).toThrow();
  });

  it('should leave optional fields undefined when not provided', () => {
    const result = NotificationSchema.parse({ message: 'Hello' });
    expect(result.title).toBeUndefined();
    expect(result.icon).toBeUndefined();
    expect(result.duration).toBeUndefined();
    expect(result.actions).toBeUndefined();
    expect(result.position).toBeUndefined();
  });
});

describe('NotificationConfigSchema', () => {
  it('should apply all defaults for empty config', () => {
    const result = NotificationConfigSchema.parse({});
    expect(result.defaultPosition).toBe('top_right');
    expect(result.defaultDuration).toBe(5000);
    expect(result.maxVisible).toBe(5);
    expect(result.stackDirection).toBe('down');
    expect(result.pauseOnHover).toBe(true);
  });

  it('should accept full config override', () => {
    const config: NotificationConfig = {
      defaultPosition: 'bottom_left',
      defaultDuration: 3000,
      maxVisible: 3,
      stackDirection: 'up',
      pauseOnHover: false,
    };
    const result = NotificationConfigSchema.parse(config);
    expect(result.defaultPosition).toBe('bottom_left');
    expect(result.defaultDuration).toBe(3000);
    expect(result.maxVisible).toBe(3);
    expect(result.stackDirection).toBe('up');
    expect(result.pauseOnHover).toBe(false);
  });
});

describe('Type exports', () => {
  it('should have valid type exports', () => {
    const type: NotificationType = 'toast';
    const severity: NotificationSeverity = 'info';
    const position: NotificationPosition = 'top_right';
    const action: NotificationAction = { label: 'OK', action: 'confirm', variant: 'primary' };
    const notification: Notification = { type: 'toast', severity: 'info', message: 'Test', dismissible: true };
    const config: NotificationConfig = { defaultPosition: 'top_right', defaultDuration: 5000, maxVisible: 5, stackDirection: 'down', pauseOnHover: true };
    expect(type).toBeDefined();
    expect(severity).toBeDefined();
    expect(position).toBeDefined();
    expect(action).toBeDefined();
    expect(notification).toBeDefined();
    expect(config).toBeDefined();
  });
});

describe('ARIA integration', () => {
  it('should accept ARIA props on NotificationSchema', () => {
    const result = NotificationSchema.parse({
      message: 'File saved',
      ariaLabel: 'Success notification',
      role: 'alert',
    });
    expect(result.ariaLabel).toBe('Success notification');
    expect(result.role).toBe('alert');
  });

  it('should reject I18n ariaLabel on NotificationSchema', () => {
    expect(() => NotificationSchema.parse({
      message: 'Error occurred',
      ariaLabel: { key: 'notifications.error_alert', defaultValue: 'Error alert' },
    })).toThrow();
  });

  it('should leave ARIA fields undefined when not provided', () => {
    const result = NotificationSchema.parse({ message: 'Test' });
    expect(result.ariaLabel).toBeUndefined();
    expect(result.ariaDescribedBy).toBeUndefined();
    expect(result.role).toBeUndefined();
  });
});
