// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * TransitionOverlay — full-page semi-transparent backdrop with a spinner
 * and a short status message. Used whenever we kick off a navigation
 * that will unload the current document (SSO bounce, logout, post-login
 * redirect to another SPA) so the user gets unmistakable feedback that
 * the click did fire, especially on slow networks where the bare button
 * would look broken.
 *
 * Rendered via a portal into `document.body` so it floats above every
 * Card / Dialog without z-index gymnastics.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';

export interface TransitionOverlayProps {
  /** Status text shown next to the spinner. */
  message: string;
}

export function TransitionOverlay({ message }: TransitionOverlayProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
        <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        <span>{message}</span>
      </div>
    </div>,
    document.body,
  );
}
