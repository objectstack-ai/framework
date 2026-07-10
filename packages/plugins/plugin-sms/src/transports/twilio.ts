// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ISmsTransport, NormalizedSmsMessage, SmsTransportSendResult } from '@objectstack/spec/contracts';

export interface TwilioSmsTransportOptions {
  accountSid: string;
  authToken: string;
  /** Sender number (E.164). One of `from` / `messagingServiceSid` is required. */
  from?: string;
  /** Twilio Messaging Service SID (alternative to a fixed `from` number). */
  messagingServiceSid?: string;
  /** API base URL override (tests). Default `https://api.twilio.com`. */
  baseUrl?: string;
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Twilio Programmable Messaging transport — a single `POST
 * /2010-04-01/Accounts/{sid}/Messages.json` with HTTP Basic auth. Plain
 * `fetch`, no vendor SDK. Free-form: delivers `body` verbatim.
 */
export class TwilioSmsTransport implements ISmsTransport {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: TwilioSmsTransportOptions) {
    if (!options.accountSid || !options.authToken) {
      throw new Error('TwilioSmsTransport: accountSid and authToken are required');
    }
    if (!options.from && !options.messagingServiceSid) {
      throw new Error('TwilioSmsTransport: one of from / messagingServiceSid is required');
    }
    this.baseUrl = (options.baseUrl ?? 'https://api.twilio.com').replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async send(message: NormalizedSmsMessage): Promise<SmsTransportSendResult> {
    const form = new URLSearchParams({
      To: message.to,
      Body: message.body,
      ...(this.options.messagingServiceSid
        ? { MessagingServiceSid: this.options.messagingServiceSid }
        : { From: this.options.from as string }),
    });
    const auth = Buffer.from(`${this.options.accountSid}:${this.options.authToken}`).toString('base64');
    const response = await this.fetchImpl(
      `${this.baseUrl}/2010-04-01/Accounts/${encodeURIComponent(this.options.accountSid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      },
    );

    let payload: any = {};
    try { payload = await response.json(); } catch { /* non-JSON error body */ }
    if (!response.ok) {
      const code = payload?.code ?? `HTTP_${response.status}`;
      const detail = payload?.message ?? response.statusText ?? 'request failed';
      throw new Error(`Twilio send failed (${code}): ${detail}`);
    }
    return { messageId: String(payload.sid ?? ''), response: payload.status };
  }
}
