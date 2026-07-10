// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { ISmsTransport, NormalizedSmsMessage, SmsTransportSendResult } from '@objectstack/spec/contracts';

export interface AliyunSmsTransportOptions {
  accessKeyId: string;
  accessKeySecret: string;
  /** 短信签名 SignName — the registered sender signature, e.g. `阿里云短信测试`. */
  signName: string;
  /**
   * Default 模板 TemplateCode used when the input carries no `templateId`
   * (Aliyun only delivers pre-registered templates — free-form bodies are
   * refused by the API). A catch-all template with a single `${content}`
   * variable makes generic notification sends possible.
   */
  defaultTemplateCode?: string;
  /** API endpoint host. Default `dysmsapi.aliyuncs.com`. */
  endpoint?: string;
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
}

const API_VERSION = '2017-05-25';
const ALGORITHM = 'ACS3-HMAC-SHA256';

const sha256Hex = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
const hmac256Hex = (key: string, s: string): string => createHmac('sha256', key).update(s, 'utf8').digest('hex');

/** RFC 3986 percent-encoding (Aliyun requires `%20`, `%2A`, `%7E` handling). */
const encode = (s: string): string =>
  encodeURIComponent(s)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~');

/**
 * Aliyun SMS (dysmsapi `SendSms`) transport, signed with the current
 * ACS3-HMAC-SHA256 scheme — plain `fetch` + `node:crypto`, no vendor SDK.
 *
 * Aliyun is template-only: the transport sends `templateId` (falling back to
 * the configured default TemplateCode) with `templateParams` (falling back to
 * `{ content: body }` for the catch-all-template pattern). The rendered
 * `body` itself is never transmitted outside `TemplateParam`.
 */
export class AliyunSmsTransport implements ISmsTransport {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: AliyunSmsTransportOptions) {
    if (!options.accessKeyId || !options.accessKeySecret) {
      throw new Error('AliyunSmsTransport: accessKeyId and accessKeySecret are required');
    }
    if (!options.signName) {
      throw new Error('AliyunSmsTransport: signName is required');
    }
    this.endpoint = options.endpoint ?? 'dysmsapi.aliyuncs.com';
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async send(message: NormalizedSmsMessage): Promise<SmsTransportSendResult> {
    const templateCode = message.templateId ?? this.options.defaultTemplateCode;
    if (!templateCode) {
      throw new Error(
        'AliyunSmsTransport: Aliyun requires a template — pass templateId or configure a default template code',
      );
    }
    const templateParam = JSON.stringify(message.templateParams ?? { content: message.body });

    const query: Record<string, string> = {
      PhoneNumbers: message.to,
      SignName: this.options.signName,
      TemplateCode: templateCode,
      TemplateParam: templateParam,
    };
    const canonicalQuery = Object.keys(query)
      .sort()
      .map((k) => `${encode(k)}=${encode(query[k])}`)
      .join('&');

    const bodyHash = sha256Hex(''); // POST with all parameters in the query string
    const headers: Record<string, string> = {
      host: this.endpoint,
      'x-acs-action': 'SendSms',
      'x-acs-content-sha256': bodyHash,
      'x-acs-date': new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      'x-acs-signature-nonce': randomUUID(),
      'x-acs-version': API_VERSION,
    };
    const signedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaderNames.map((k) => `${k}:${headers[k].trim()}\n`).join('');
    const signedHeaders = signedHeaderNames.join(';');

    const canonicalRequest = ['POST', '/', canonicalQuery, canonicalHeaders, signedHeaders, bodyHash].join('\n');
    const stringToSign = `${ALGORITHM}\n${sha256Hex(canonicalRequest)}`;
    const signature = hmac256Hex(this.options.accessKeySecret, stringToSign);

    const response = await this.fetchImpl(`https://${this.endpoint}/?${canonicalQuery}`, {
      method: 'POST',
      headers: {
        ...headers,
        Authorization: `${ALGORITHM} Credential=${this.options.accessKeyId},SignedHeaders=${signedHeaders},Signature=${signature}`,
      },
    });

    let payload: any = {};
    try { payload = await response.json(); } catch { /* non-JSON error body */ }
    if (!response.ok || payload?.Code !== 'OK') {
      const code = payload?.Code ?? `HTTP_${response.status}`;
      const detail = payload?.Message ?? response.statusText ?? 'request failed';
      throw new Error(`Aliyun SendSms failed (${code}): ${detail}`);
    }
    return { messageId: String(payload.BizId ?? payload.RequestId ?? ''), response: payload.RequestId };
  }
}
