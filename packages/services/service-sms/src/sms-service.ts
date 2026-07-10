// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  ISmsService,
  ISmsTransport,
  NormalizedSmsMessage,
  SendSmsInput,
  SendSmsResult,
  SmsTransportSendResult,
} from '@objectstack/spec/contracts';

/**
 * Normalize + validate a recipient phone number. Accepts E.164 and common
 * human formats (spaces / dashes / dots / parens are stripped). Returns
 * `undefined` when the result doesn't look like a phone number.
 *
 * Same shape rule as plugin-auth's `normalizePhoneNumber` — 6-15 digits
 * with an optional leading `+` (kept local: the two packages must not
 * depend on each other).
 */
export function normalizeSmsRecipient(raw: string): string | undefined {
  const stripped = String(raw ?? '').replace(/[\s\-().]/g, '');
  return /^\+?[0-9]{6,15}$/.test(stripped) ? stripped : undefined;
}

/**
 * Mask a phone number for log lines: keep the prefix (country-code-ish) and
 * the last two digits, hide the middle. `+8613812345678` → `+8613******78`.
 * SMS logging policy: masked recipient + status ONLY — never the body
 * (OTP codes travel in it; see the ISmsService contract header).
 */
export function maskPhoneNumber(phone: string): string {
  const p = String(phone ?? '');
  if (p.length <= 6) return `${p.slice(0, 2)}****`;
  return `${p.slice(0, 5)}${'*'.repeat(Math.max(2, p.length - 7))}${p.slice(-2)}`;
}

/**
 * Development transport — never actually sends. Logs the masked recipient
 * (and, OUTSIDE production only, the message body so local OTP flows are
 * testable) and returns a synthetic message id.
 *
 * The production-body suppression is a hard rule from #2780: OTP codes must
 * never land in logs. In dev the body IS the delivery — same pattern as the
 * auth magic-link / invitation URLs, which are printed in dev only.
 */
export class LogSmsTransport implements ISmsTransport {
  private counter = 0;
  constructor(private readonly logger?: { info: (msg: string, meta?: any) => void }) {}
  async send(message: NormalizedSmsMessage): Promise<SmsTransportSendResult> {
    const messageId = `dev-sms-${Date.now()}-${++this.counter}`;
    const dev = (globalThis as any)?.process?.env?.NODE_ENV !== 'production';
    this.logger?.info(
      `[LogSmsTransport] would send SMS to ${maskPhoneNumber(message.to)}` +
      (dev ? ` — body: ${message.body}` : ' (body suppressed outside dev)'),
      { messageId },
    );
    return { messageId, response: 'logged' };
  }
}

export interface SmsServiceOptions {
  transport: ISmsTransport;
  /**
   * Whether `transport` is a real provider (Aliyun / Twilio / injected).
   * `false` = development log fallback; surfaced via `isConfigured()` so
   * consumers can gate SMS-dependent features in production.
   */
  configured: boolean;
  /** Retry attempts on transport throw. Default 0 (no retry). */
  retries?: number;
  /** Logger for diagnostic output. NEVER receives message bodies. */
  logger?: {
    info: (msg: string, meta?: any) => void;
    warn: (msg: string, meta?: any) => void;
  };
}

/**
 * Concrete ISmsService implementation.
 *
 * Flow: validate + normalize input → transport.send() (with optional
 * retry) → SendSmsResult. Deliberately NO persistence and NO body logging —
 * see the contract header in `@objectstack/spec/contracts/sms-service.ts`.
 */
export class SmsService implements ISmsService {
  constructor(public options: SmsServiceOptions) {
    if (!options.transport) throw new Error('SmsService: transport is required');
  }

  /**
   * Hot-swap the underlying transport (settings namespace changed). The
   * `configured` flag travels with the transport.
   */
  setTransport(transport: ISmsTransport, configured: boolean): void {
    this.options.transport = transport;
    this.options.configured = configured;
  }

  isConfigured(): boolean {
    return this.options.configured;
  }

  async send(input: SendSmsInput): Promise<SendSmsResult> {
    const to = normalizeSmsRecipient(input?.to ?? '');
    if (!to) {
      throw new Error(`VALIDATION_FAILED: '${maskPhoneNumber(String(input?.to ?? ''))}' is not a valid phone number`);
    }
    const body = String(input?.body ?? '').trim();
    if (!body && !input?.templateId && !input?.templateParams) {
      throw new Error('VALIDATION_FAILED: body (or templateId/templateParams) is required');
    }

    const normalized: NormalizedSmsMessage = {
      to,
      body,
      ...(input.templateId ? { templateId: input.templateId } : {}),
      ...(input.templateParams ? { templateParams: input.templateParams } : {}),
    };

    const id = `sms-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const maxAttempts = (this.options.retries ?? 0) + 1;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.options.transport.send(normalized);
        this.options.logger?.info(
          `[SmsService] sent to ${maskPhoneNumber(to)} (messageId=${result.messageId})`,
        );
        return { id, status: 'sent', messageId: result.messageId };
      } catch (err) {
        lastError = err;
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, Math.min(2000, 100 * 2 ** (attempt - 1))));
        }
      }
    }
    const errMessage = String((lastError as Error)?.message ?? lastError ?? 'send failed').slice(0, 500);
    this.options.logger?.warn(
      `[SmsService] send to ${maskPhoneNumber(to)} failed: ${errMessage}`,
    );
    return { id, status: 'failed', error: errMessage };
  }
}
