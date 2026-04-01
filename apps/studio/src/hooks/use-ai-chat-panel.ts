// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useState, useEffect, useCallback } from 'react';
import type { UIMessage } from 'ai';

const STORAGE_KEY = 'objectstack:ai-chat-messages';
const PANEL_STATE_KEY = 'objectstack:ai-chat-panel-open';

/**
 * Load persisted chat messages from localStorage.
 */
export function loadMessages(): UIMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Persist chat messages to localStorage.
 */
export function saveMessages(messages: UIMessage[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // localStorage may be full or unavailable — silently ignore
  }
}

/**
 * Load panel open/closed state from localStorage.
 */
function loadPanelState(): boolean {
  try {
    return localStorage.getItem(PANEL_STATE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Hook for managing AI Chat Panel state:
 * - Panel visibility toggle (open/close)
 * - Global keyboard shortcut (Ctrl+Shift+I / Cmd+Shift+I)
 * - Panel state persistence to localStorage
 */
export function useAiChatPanel() {
  const [isOpen, setIsOpen] = useState<boolean>(loadPanelState);

  // Persist panel state to localStorage
  const setOpen = useCallback((open: boolean) => {
    setIsOpen(open);
    try {
      localStorage.setItem(PANEL_STATE_KEY, String(open));
    } catch {
      // silently ignore
    }
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PANEL_STATE_KEY, String(next));
      } catch {
        // silently ignore
      }
      return next;
    });
  }, []);

  // Global keyboard shortcut: Ctrl+Shift+I / Cmd+Shift+I
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.shiftKey && (e.ctrlKey || e.metaKey) && e.key === 'I') {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return { isOpen, setOpen, toggle };
}
