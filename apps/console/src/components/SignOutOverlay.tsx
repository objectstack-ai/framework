// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * SignOutOverlay — UX patch for Console sign-out.
 *
 * The UserMenu inside `@object-ui/app-shell` calls `useAuth().signOut()`
 * directly: there's no visible feedback between the click and the moment
 * `AccountLoginRedirect` finally hard-navigates the browser to
 * `/_account/login`. On a slow link this gap can be 1–3 seconds and feels
 * like the click did nothing.
 *
 * This component sits at the App root, watches the `useAuth()` state and
 * the moment the user transitions from authenticated → null it paints a
 * full-screen overlay with a spinner. The overlay survives until the
 * browser actually unloads the document (which `AccountLoginRedirect`
 * triggers a tick later via `window.location.assign`).
 *
 * We don't need to hook the UserMenu directly — we just react to the
 * underlying auth state change, which works no matter which dropdown
 * variant the published `app-shell` renders.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@object-ui/auth';

interface OverlayProps {
  message: string;
}

function Overlay({ message }: OverlayProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)' }}
    >
      <div className="flex flex-col items-center gap-3" style={{ color: '#525252', fontSize: 14 }}>
        <div
          style={{
            width: 32,
            height: 32,
            border: '2px solid #d4d4d4',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'so-spin 0.8s linear infinite',
          }}
        />
        <span>{message}</span>
        <style>{`@keyframes so-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>,
    document.body,
  );
}

export function SignOutOverlay() {
  const { user, isAuthenticated } = useAuth();
  const wasAuthed = useRef<boolean>(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    // Latch on the first authenticated render — we only care about
    // the authed → unauthed transition, not the initial null state
    // while session is still loading.
    if (isAuthenticated || user) {
      wasAuthed.current = true;
      return;
    }
    if (wasAuthed.current && !signingOut) {
      setSigningOut(true);
      // Safety net: if AccountLoginRedirect somehow fails to navigate
      // within 8s, drop the overlay so the user isn't stuck staring at
      // a spinner forever.
      const t = window.setTimeout(() => setSigningOut(false), 8000);
      return () => window.clearTimeout(t);
    }
  }, [isAuthenticated, user, signingOut]);

  if (!signingOut) return null;
  return <Overlay message="Signing you out…" />;
}
