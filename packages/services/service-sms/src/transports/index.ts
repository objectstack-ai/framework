// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ISmsTransport } from '@objectstack/spec/contracts';
import { LogSmsTransport } from '../sms-service.js';
import { AliyunSmsTransport } from './aliyun.js';
import { TwilioSmsTransport } from './twilio.js';

export { AliyunSmsTransport, type AliyunSmsTransportOptions } from './aliyun.js';
export { TwilioSmsTransport, type TwilioSmsTransportOptions } from './twilio.js';

export type SmsProviderTag = 'log' | 'aliyun' | 'twilio';

export interface MakeSmsTransportOptions {
  provider: SmsProviderTag;
  /** Provider-specific credentials/options (see the transport option types). */
  options?: Record<string, unknown>;
  logger?: { info: (msg: string, meta?: any) => void };
}

/**
 * Build an ISmsTransport from a provider tag + opts. Used by
 * SmsServicePlugin to materialise the transport selected by config /
 * the `sms` settings namespace.
 *
 * Throws when a non-`log` provider is missing required credentials.
 */
export function makeSmsTransport(opts: MakeSmsTransportOptions): ISmsTransport {
  const { provider, options = {}, logger } = opts;
  switch (provider) {
    case 'log':
      return new LogSmsTransport(logger);
    case 'aliyun':
      return new AliyunSmsTransport(options as any);
    case 'twilio':
      return new TwilioSmsTransport(options as any);
    default:
      throw new Error(`makeSmsTransport: unknown provider '${provider}'`);
  }
}
