// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ISmsService — Outbound SMS Service Contract (#2780)
 *
 * Sends short text messages through a pluggable transport (Aliyun SMS,
 * Twilio, etc.). Concrete implementations live in `@objectstack/service-sms`;
 * provider integrations plug in as an `ISmsTransport`.
 *
 * Mirrors the shape of `IEmailService`/`IEmailTransport` (email-service.ts)
 * with two deliberate differences:
 *
 * 1. **No persistence surface.** SMS bodies routinely carry one-time
 *    passwords; persisting them (the `sys_email` analog) would turn the
 *    message log into a credential store. Implementations MUST NOT write
 *    message bodies to durable storage or logs.
 * 2. **Template-based providers.** Some providers (notably Aliyun) refuse
 *    free-form bodies and only deliver pre-registered templates. The input
 *    therefore carries an optional provider `templateId` + `templateParams`
 *    alongside the rendered `body`; a transport uses whichever it needs.
 *
 * Follows Dependency Inversion Principle — consumers (auth OTP, the
 * messaging `sms` channel) depend on this interface, never on a concrete
 * provider implementation.
 */

/**
 * Input for ISmsService.send().
 */
export interface SendSmsInput {
  /** Recipient phone number, E.164 recommended (`+8613800000000`). */
  to: string;
  /**
   * Rendered message text. Free-form transports (Twilio, log) deliver it
   * verbatim; template-only transports (Aliyun) ignore it in favour of
   * `templateId`/`templateParams`.
   */
  body: string;
  /**
   * Provider-side template identifier (e.g. an Aliyun `TemplateCode`).
   * Optional — template-only transports fall back to their configured
   * default template when omitted.
   */
  templateId?: string;
  /** Variables for a provider-side template (e.g. `{ code: '123456' }`). */
  templateParams?: Record<string, string>;
  /** Optional related record for audit linkage (ids only — never bodies). */
  relatedObject?: string;
  relatedId?: string;
}

/**
 * Normalized message handed to an ISmsTransport. The service validates the
 * recipient shape before invoking the transport.
 */
export interface NormalizedSmsMessage {
  to: string;
  body: string;
  templateId?: string;
  templateParams?: Record<string, string>;
}

/**
 * Transport-level result.
 */
export interface SmsTransportSendResult {
  /** Provider message id (Aliyun BizId, Twilio SID, …). */
  messageId: string;
  /** Optional raw response detail from the underlying provider. */
  response?: string;
}

/**
 * Pluggable SMS transport. service-sms ships a `LogSmsTransport` for
 * development; production deployments configure a concrete provider
 * (Aliyun / Twilio) or inject their own implementation of this shape.
 *
 * Transports MUST NOT mutate the message and MUST NOT log the body
 * (OTP codes travel in it).
 */
export interface ISmsTransport {
  send(message: NormalizedSmsMessage): Promise<SmsTransportSendResult>;
}

/** Delivery status surfaced to callers. */
export type SmsDeliveryStatus = 'sent' | 'failed';

/**
 * Outcome of ISmsService.send().
 */
export interface SendSmsResult {
  /** Correlation id for this attempt (not persisted — see contract header). */
  id: string;
  status: SmsDeliveryStatus;
  /** Provider message id, set when status='sent'. */
  messageId?: string;
  /** Failure detail, set when status='failed'. Never contains the body. */
  error?: string;
}

/**
 * SMS service contract.
 */
export interface ISmsService {
  /**
   * Send (or attempt to send) an SMS through the configured transport.
   * Resolves with `status:'failed'` on transport errors rather than
   * throwing; throws only on invalid input (bad recipient / empty body).
   */
  send(input: SendSmsInput): Promise<SendSmsResult>;

  /**
   * Whether a real provider transport is active. `false` means the service
   * is running on the development log fallback — messages are not actually
   * delivered anywhere. Consumers that advertise SMS-dependent features
   * (e.g. phone OTP sign-in) SHOULD gate on this in production.
   */
  isConfigured(): boolean;
}
