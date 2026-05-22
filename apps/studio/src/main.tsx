// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Main Entry Point
 *
 * Studio is a thin SPA that always talks to a real ObjectStack backend
 * over HTTP (see lib/config.ts). The backend is reached via the dev
 * server proxy when running standalone at :5173, or same-origin when
 * embedded under `/_studio/`.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { initRuntimeConfig, logConfig } from './lib/config';

async function bootstrap() {
  // Resolve single- vs multi-project mode BEFORE rendering so route guards
  // (see __root.tsx) make the correct decision on first paint.
  await initRuntimeConfig();

  logConfig();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap().catch((err) => {
  console.error('[Studio] ❌ Fatal bootstrap error:', err);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="padding:2rem;font-family:system-ui;color:#ef4444">
        <h1>Failed to start</h1>
        <pre style="background:#1e1e2e;color:#cdd6f4;padding:1rem;border-radius:8px;overflow:auto">${
          err instanceof Error ? err.stack || err.message : String(err)
        }</pre>
      </div>
    `;
  }
});
