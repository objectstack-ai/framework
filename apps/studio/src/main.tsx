// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Main Entry Point
 * 
 * Initializes the console application with support for two runtime modes:
 * - MSW Mode: Uses Mock Service Worker with in-browser ObjectStack kernel
 * - Server Mode: Connects to a real ObjectStack server
 * 
 * Set VITE_RUNTIME_MODE=server to connect to a real server
 * Set VITE_RUNTIME_MODE=msw (or leave empty) for MSW mode
 */

import './mocks/process-polyfill';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { startMockServer } from './mocks/browser';
import { initRuntimeConfig, isMswMode, logConfig } from './lib/config';

// Bootstrap the application
async function bootstrap() {
  // Only start MSW in MSW mode
  if (isMswMode()) {
    console.log('[Console] Starting in MSW mode (in-browser kernel)');
    try {
      await startMockServer();
    } catch (err) {
      console.error('[Console] ❌ Failed to start MSW mock server:', err);
      // Render anyway so the user sees the error boundary or at least some UI
    }
  } else {
    console.log('[Console] Starting in Server mode');
  }

  // Resolve single- vs multi-project mode BEFORE rendering so route guards
  // (see __root.tsx) make the correct decision on first paint. In server mode
  // this fetches /api/v1/studio/runtime-config; in MSW mode it only honours
  // the VITE_STUDIO_SINGLE_PROJECT build flag.
  await initRuntimeConfig();

  logConfig();

  // Render the React app
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap().catch((err) => {
  console.error('[Console] ❌ Fatal bootstrap error:', err);
  // Last-resort: render error message directly to DOM
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
