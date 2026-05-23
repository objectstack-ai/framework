// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import React from 'react';
import ReactDOM from 'react-dom/client';
import { I18nProvider, useI18nContext } from '@object-ui/i18n';
import App from './App';
import './index.css';
import { DEFAULT_LANGUAGE, loadLanguage } from './i18n';

const initialLanguage =
  (typeof localStorage !== 'undefined' && localStorage.getItem('account.lang')) ||
  (typeof navigator !== 'undefined' && navigator.language) ||
  DEFAULT_LANGUAGE;

/**
 * I18nGate — don't paint any route content until our locale JSON has
 * actually been merged into i18next.
 *
 * Without this gate the first frame after React mounts uses
 * `@object-ui/i18n`'s bundled-default `zh` translation (e.g.
 * `auth.login.title === "登录您的账户"`) before our local locale
 * overrides it 100-300 ms later, causing a visible flicker on every
 * login/register page. We keep the boot skeleton (rendered by
 * `index.html`) instead by returning `null` until i18next reports the
 * resource bundle for the active language is available.
 */
function I18nGate({ children }: { children: React.ReactNode }) {
  const { i18n, language } = useI18nContext();
  const [tick, force] = React.useReducer((n: number) => n + 1, 0);
  const [safetyTimedOut, setSafetyTimedOut] = React.useState(false);
  React.useEffect(() => {
    const onLoaded = () => force();
    i18n.on('loaded', onLoaded);
    i18n.on('languageChanged', onLoaded);
    // Safety net: never block the UI for more than 1.5s waiting on i18n —
    // a brief default-translation flash is strictly better than a frozen
    // skeleton if the locale fetch silently stalls.
    const t = window.setTimeout(() => setSafetyTimedOut(true), 1500);
    return () => {
      i18n.off('loaded', onLoaded);
      i18n.off('languageChanged', onLoaded);
      window.clearTimeout(t);
    };
  }, [i18n]);
  void tick;
  const ready =
    safetyTimedOut ||
    (i18n.isInitialized &&
      !!i18n.hasResourceBundle?.(language, 'translation'));
  if (!ready) return null;
  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider
      config={{
        defaultLanguage: initialLanguage,
        fallbackLanguage: DEFAULT_LANGUAGE,
      }}
      loadLanguage={loadLanguage}
    >
      <I18nGate>
        <App />
      </I18nGate>
    </I18nProvider>
  </React.StrictMode>,
);
