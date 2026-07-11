// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import {
  BUILTIN_PHONE_SMS_TEMPLATES,
  PHONE_SMS_TOPICS,
  builtinPhoneSmsBody,
  interpolatePhoneSms,
  loadPhoneSmsTemplateBody,
  phoneSmsLocaleChain,
  seedPhoneSmsTemplates,
} from './phone-sms-texts.js';

describe('phoneSmsLocaleChain', () => {
  it('expands a regioned locale and always ends in en', () => {
    expect(phoneSmsLocaleChain('zh-CN')).toEqual(['zh-CN', 'zh', 'en']);
    expect(phoneSmsLocaleChain('zh')).toEqual(['zh', 'en']);
    expect(phoneSmsLocaleChain('en-US')).toEqual(['en-US', 'en']);
    expect(phoneSmsLocaleChain(undefined)).toEqual(['en']);
  });
});

describe('builtin templates', () => {
  it('carry an en row for every topic (terminal fallback guarantee)', () => {
    for (const topic of Object.values(PHONE_SMS_TOPICS)) {
      expect(builtinPhoneSmsBody(topic, undefined)).toBeTruthy();
    }
  });

  it('resolve zh for zh-CN deployments', () => {
    const body = builtinPhoneSmsBody(PHONE_SMS_TOPICS.otp, 'zh-CN');
    expect(body).toContain('验证码');
    expect(body).toContain('{{code}}');
  });

  it('fall back to en for locales without a bundled text', () => {
    const body = builtinPhoneSmsBody(PHONE_SMS_TOPICS.otp, 'ja-JP');
    expect(body).toContain('verification code');
  });
});

describe('interpolatePhoneSms', () => {
  it('substitutes holes and blanks unknown ones', () => {
    expect(
      interpolatePhoneSms('您的 {{appName}} 验证码为 {{code}}，{{minutes}} 分钟内有效。', {
        appName: '对象栈',
        code: '123456',
        minutes: 5,
      }),
    ).toBe('您的 对象栈 验证码为 123456，5 分钟内有效。');
    expect(interpolatePhoneSms('x {{missing}} y', {})).toBe('x  y');
  });
});

describe('loadPhoneSmsTemplateBody', () => {
  const engineWith = (rows: Array<Record<string, unknown>>) => ({
    find: vi.fn(async (_obj: string, q: any) =>
      rows.filter(
        (r) =>
          r.topic === q.where.topic &&
          r.channel === q.where.channel &&
          r.locale === q.where.locale &&
          r.is_active === true,
      ),
    ),
    insert: vi.fn(),
  });

  it('returns the tenant row for the exact locale', async () => {
    const engine = engineWith([
      { topic: 'auth.phone_otp', channel: 'sms', locale: 'zh-CN', is_active: true, body: '自定义 {{code}}' },
    ]);
    await expect(loadPhoneSmsTemplateBody(engine, 'auth.phone_otp', 'zh-CN')).resolves.toBe('自定义 {{code}}');
  });

  it('walks the locale chain (zh-CN → zh)', async () => {
    const engine = engineWith([
      { topic: 'auth.phone_otp', channel: 'sms', locale: 'zh', is_active: true, body: 'zh 行 {{code}}' },
    ]);
    await expect(loadPhoneSmsTemplateBody(engine, 'auth.phone_otp', 'zh-CN')).resolves.toBe('zh 行 {{code}}');
  });

  it('yields null with no matching row, no engine, or a broken lookup', async () => {
    await expect(loadPhoneSmsTemplateBody(engineWith([]), 'auth.phone_otp', 'zh')).resolves.toBeNull();
    await expect(loadPhoneSmsTemplateBody(undefined, 'auth.phone_otp', 'zh')).resolves.toBeNull();
    const broken = { find: vi.fn(async () => { throw new Error('no such table'); }), insert: vi.fn() };
    await expect(loadPhoneSmsTemplateBody(broken, 'auth.phone_otp', 'zh')).resolves.toBeNull();
  });
});

describe('seedPhoneSmsTemplates', () => {
  it('inserts missing rows and never overwrites existing ones', async () => {
    const existing = [
      { topic: 'auth.phone_otp', channel: 'sms', locale: 'zh', body: '租户定制', is_active: false },
    ];
    const inserted: Array<Record<string, unknown>> = [];
    const engine = {
      find: vi.fn(async (_obj: string, q: any) =>
        existing.filter(
          (r) => r.topic === q.where.topic && r.channel === q.where.channel && r.locale === q.where.locale,
        ),
      ),
      insert: vi.fn(async (_obj: string, row: any) => { inserted.push(row); return row; }),
    };
    await seedPhoneSmsTemplates(engine);
    // 4 built-ins, 1 already present (even deactivated!) → 3 inserts.
    expect(inserted).toHaveLength(BUILTIN_PHONE_SMS_TEMPLATES.length - 1);
    expect(inserted.some((r) => r.topic === 'auth.phone_otp' && r.locale === 'zh')).toBe(false);
  });

  it('isolates per-row failures (missing table) via the logger', async () => {
    const warn = vi.fn();
    const engine = {
      find: vi.fn(async () => { throw new Error('no such table'); }),
      insert: vi.fn(),
    };
    await seedPhoneSmsTemplates(engine, { warn });
    expect(warn).toHaveBeenCalledTimes(BUILTIN_PHONE_SMS_TEMPLATES.length);
    expect(engine.insert).not.toHaveBeenCalled();
  });
});
