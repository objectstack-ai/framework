// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { MouseEvent } from 'react';
import { useObjectTranslation } from '@object-ui/i18n';

export interface LegalLinksProps {
  /** URL to the deployment's Terms of Service. Hidden when undefined / empty. */
  termsUrl?: string;
  /** URL to the deployment's Privacy Policy. Hidden when undefined / empty. */
  privacyUrl?: string;
}

/**
 * Open a legal document in a popup window. We deliberately avoid
 * navigating the auth tab (which would lose half-typed credentials)
 * and avoid the default new-tab behaviour so the document is visually
 * scoped to "this is a side-trip, come back to the form". Falls back
 * to a normal navigation if the popup is blocked.
 */
function openLegalPopup(event: MouseEvent<HTMLAnchorElement>, url: string): void {
  // Honour cmd/ctrl/middle-click — power users may want a real tab.
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) {
    return;
  }
  event.preventDefault();
  const width = Math.min(960, window.screen.availWidth - 80);
  const height = Math.min(720, window.screen.availHeight - 80);
  const left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
  const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
  const features = [
    'popup=yes',
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'resizable=yes',
    'scrollbars=yes',
    'noopener=yes',
    'noreferrer=yes',
  ].join(',');
  const win = window.open(url, 'objectstack-legal', features);
  if (!win) {
    // Popup blocked — fall back to a normal new-tab navigation.
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Fine-print legal links shown beneath the login / register cards.
 *
 * URLs come from `GET /api/v1/auth/config` → `features.termsUrl` /
 * `features.privacyUrl`, which the server resolves from env vars
 * `OS_TERMS_URL` / `OS_PRIVACY_URL` (defaulting to the public
 * ObjectStack pages). Clicking a link opens the document in a centred
 * popup window so the user doesn't lose their place in the auth form.
 */
export function LegalLinks({ termsUrl, privacyUrl }: LegalLinksProps): React.ReactElement | null {
  const { t } = useObjectTranslation('account');
  const hasTerms = typeof termsUrl === 'string' && termsUrl.length > 0;
  const hasPrivacy = typeof privacyUrl === 'string' && privacyUrl.length > 0;
  if (!hasTerms && !hasPrivacy) return null;
  return (
    <p className="px-6 text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
      {t('legal.agreementPrefix')}{' '}
      {hasTerms ? (
        <a
          href={termsUrl}
          target="objectstack-legal"
          rel="noreferrer noopener"
          onClick={(event) => openLegalPopup(event, termsUrl!)}
        >
          {t('legal.termsOfService')}
        </a>
      ) : null}
      {hasTerms && hasPrivacy ? <> {t('legal.and')} </> : null}
      {hasPrivacy ? (
        <a
          href={privacyUrl}
          target="objectstack-legal"
          rel="noreferrer noopener"
          onClick={(event) => openLegalPopup(event, privacyUrl!)}
        >
          {t('legal.privacyPolicy')}
        </a>
      ) : null}
      .
    </p>
  );
}

