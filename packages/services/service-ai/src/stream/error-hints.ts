// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Turn raw LLM provider errors into actionable messages.
 *
 * Providers surface failures as terse HTTP statuses ("Bad Request") that
 * give an operator nothing to act on — and the chat UI is often the first
 * place a broken provider config becomes visible. This helper attaches
 * the active adapter description (so the reader knows WHICH provider/model
 * was hit) and maps the common failure classes to concrete next steps.
 */

interface ProviderErrorShape {
  message?: unknown;
  name?: unknown;
  statusCode?: unknown;
  status?: unknown;
  responseBody?: unknown;
  cause?: unknown;
}

function httpStatusOf(err: ProviderErrorShape): number | undefined {
  for (const candidate of [err.statusCode, err.status]) {
    const n = Number(candidate);
    if (Number.isInteger(n) && n >= 100 && n <= 599) return n;
  }
  // Some SDK errors nest the transport error (e.g. APICallError as cause).
  if (err.cause && typeof err.cause === 'object') {
    return httpStatusOf(err.cause as ProviderErrorShape);
  }
  return undefined;
}

function hintFor(status: number | undefined, name: string, message: string): string | undefined {
  if (name === 'GatewayAuthenticationError' || status === 401 || status === 403) {
    return 'The API key is missing, invalid, or lacks access to this model. Verify the credential in Setup → AI (or the corresponding env var) and use "Test connection".';
  }
  if (status === 400) {
    return 'The provider rejected the request — most often an invalid model id. The model must be in provider/model form (e.g. anthropic/claude-sonnet-4.6 for a gateway). Check Setup → AI and use "Test connection".';
  }
  if (status === 404) {
    return 'The model id does not exist for this provider. Check the model name in Setup → AI.';
  }
  if (status === 429) {
    return 'The provider rate-limited the request. Retry shortly or check the plan/quota for this API key.';
  }
  if (/ENOTFOUND|ECONNREFUSED|fetch failed|network/i.test(message)) {
    return 'Could not reach the provider endpoint. Check the base URL / network egress from this server.';
  }
  return undefined;
}

/**
 * Build the operator-facing error text for a failed chat/stream call.
 *
 * @param raw - The error part payload or thrown error from the provider stream.
 * @param adapterDescription - Active adapter description (e.g. `Vercel AI Gateway (model: …)`).
 */
export function describeProviderError(raw: unknown, adapterDescription?: string): string {
  const err: ProviderErrorShape =
    raw && typeof raw === 'object' ? (raw as ProviderErrorShape) : { message: raw };
  const message =
    typeof err.message === 'string' && err.message.trim()
      ? err.message.trim()
      : typeof raw === 'string' && raw.trim()
        ? raw.trim()
        : 'Unknown provider error';
  const status = httpStatusOf(err);
  const name = typeof err.name === 'string' ? err.name : '';

  const parts: string[] = [];
  parts.push(status ? `${message} (HTTP ${status})` : message);
  if (adapterDescription) parts.push(`— adapter: ${adapterDescription}`);
  const hint = hintFor(status, name, message);
  if (hint) parts.push(`· ${hint}`);

  // Provider response bodies often carry the real reason ("model not
  // found", "invalid_request_error"...) — append a trimmed excerpt.
  if (typeof err.responseBody === 'string') {
    const body = err.responseBody.trim().replace(/\s+/g, ' ');
    if (body && body !== message) parts.push(`· provider says: ${body.slice(0, 300)}`);
  }

  return parts.join(' ');
}
