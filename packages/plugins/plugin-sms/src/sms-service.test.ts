// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import { SmsService, LogSmsTransport, maskPhoneNumber, normalizeSmsRecipient } from './sms-service.js';

const collectingLogger = () => {
  const lines: string[] = [];
  return {
    lines,
    info: (msg: string) => { lines.push(String(msg)); },
    warn: (msg: string) => { lines.push(String(msg)); },
  };
};

describe('normalizeSmsRecipient', () => {
  it('accepts E.164 and strips human separators', () => {
    expect(normalizeSmsRecipient('+8613800000000')).toBe('+8613800000000');
    expect(normalizeSmsRecipient('+1 (500) 555-0006')).toBe('+15005550006');
    expect(normalizeSmsRecipient('138 0000 0000')).toBe('13800000000');
  });
  it('rejects garbage', () => {
    expect(normalizeSmsRecipient('bob@example.com')).toBeUndefined();
    expect(normalizeSmsRecipient('123')).toBeUndefined();
    expect(normalizeSmsRecipient('')).toBeUndefined();
  });
});

describe('maskPhoneNumber', () => {
  it('keeps prefix + last two digits only', () => {
    const masked = maskPhoneNumber('+8613812345678');
    expect(masked.startsWith('+8613')).toBe(true);
    expect(masked.endsWith('78')).toBe(true);
    expect(masked).not.toContain('12345');
  });
});

describe('SmsService', () => {
  it('sends through the transport and reports the provider id', async () => {
    const send = vi.fn(async () => ({ messageId: 'prov_1' }));
    const svc = new SmsService({ transport: { send }, configured: true });
    const r = await svc.send({ to: '+15005550006', body: 'hello' });
    expect(r.status).toBe('sent');
    expect(r.messageId).toBe('prov_1');
    expect(send).toHaveBeenCalledWith({ to: '+15005550006', body: 'hello' });
  });

  it('throws on an invalid recipient BEFORE the transport is called', async () => {
    const send = vi.fn();
    const svc = new SmsService({ transport: { send }, configured: true });
    await expect(svc.send({ to: 'not-a-phone', body: 'x' })).rejects.toThrow(/VALIDATION_FAILED/);
    expect(send).not.toHaveBeenCalled();
  });

  it('resolves status:failed (not a throw) on transport errors', async () => {
    const svc = new SmsService({
      transport: { async send() { throw new Error('provider down'); } },
      configured: true,
    });
    const r = await svc.send({ to: '+15005550006', body: 'x' });
    expect(r.status).toBe('failed');
    expect(r.error).toContain('provider down');
  });

  it('retries on transport throw when retries > 0', async () => {
    let calls = 0;
    const svc = new SmsService({
      transport: { async send() { if (++calls < 2) throw new Error('flaky'); return { messageId: 'ok' }; } },
      configured: true,
      retries: 1,
    });
    const r = await svc.send({ to: '+15005550006', body: 'x' });
    expect(r.status).toBe('sent');
    expect(calls).toBe(2);
  });

  it('never logs the message body (OTP red line, #2780)', async () => {
    const logger = collectingLogger();
    const svc = new SmsService({
      transport: { async send() { return { messageId: 'prov_1' }; } },
      configured: true,
      logger,
    });
    await svc.send({ to: '+8613812345678', body: '123456 is your code' });
    // also exercise the failure path
    svc.setTransport({ async send() { throw new Error('down'); } }, true);
    await svc.send({ to: '+8613812345678', body: '654321 is your code' });
    for (const line of logger.lines) {
      expect(line).not.toContain('123456');
      expect(line).not.toContain('654321');
      expect(line).not.toContain('13812345678'); // full number masked too
    }
  });

  it('surfaces isConfigured / setTransport upgrades', async () => {
    const svc = new SmsService({ transport: new LogSmsTransport(), configured: false });
    expect(svc.isConfigured()).toBe(false);
    svc.setTransport({ async send() { return { messageId: 'x' }; } }, true);
    expect(svc.isConfigured()).toBe(true);
  });
});

describe('LogSmsTransport', () => {
  it('suppresses the body in production', async () => {
    const logger = collectingLogger();
    const transport = new LogSmsTransport(logger);
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await transport.send({ to: '+8613812345678', body: 'SECRET-999999' });
    } finally {
      process.env.NODE_ENV = prev;
    }
    expect(logger.lines.join('\n')).not.toContain('SECRET-999999');
    expect(logger.lines.join('\n')).toContain('body suppressed');
  });

  it('prints the body outside production (local OTP testing)', async () => {
    const logger = collectingLogger();
    const transport = new LogSmsTransport(logger);
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    try {
      await transport.send({ to: '+8613812345678', body: 'code 424242' });
    } finally {
      process.env.NODE_ENV = prev;
    }
    expect(logger.lines.join('\n')).toContain('code 424242');
  });
});
