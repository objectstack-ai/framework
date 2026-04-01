// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useState, useRef, useEffect, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import { Bot, X, Send, Trash2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAiChatPanel, loadMessages, saveMessages } from '@/hooks/use-ai-chat-panel';
import { getApiBaseUrl } from '@/lib/config';

const PANEL_WIDTH = 380;
const COLLAPSED_WIDTH = 48;

/**
 * Extract the text content from a UIMessage's parts array.
 */
function getMessageText(msg: UIMessage): string {
  return (msg.parts ?? [])
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export function AiChatPanel() {
  const { isOpen, setOpen, toggle } = useAiChatPanel();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const baseUrl = getApiBaseUrl();

  const initialMessages = useMemo(() => loadMessages() as UIMessage[], []);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: `${baseUrl}/api/v1/ai/chat` }),
    [baseUrl],
  );

  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport,
    messages: initialMessages,
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      saveMessages(messages);
    }
  }, [messages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const clearHistory = () => {
    setMessages([]);
    saveMessages([]);
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    sendMessage({ text });
  };

  // Handle Enter to submit, Shift+Enter for newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Collapsed state: edge button ──
  if (!isOpen) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggle}
              data-testid="ai-chat-toggle"
              className={cn(
                'fixed right-0 top-1/2 -translate-y-1/2 z-50',
                'flex items-center justify-center',
                'h-10 rounded-l-md border border-r-0 border-border',
                'bg-background text-foreground shadow-md',
                'hover:bg-accent transition-colors',
              )}
              style={{ width: COLLAPSED_WIDTH }}
            >
              <Sparkles className="h-5 w-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>AI Chat <kbd className="ml-1 text-[10px] opacity-60">⌘⇧I</kbd></p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // ── Expanded panel ──
  return (
    <aside
      data-testid="ai-chat-panel"
      className={cn(
        'fixed right-0 top-0 z-50 h-full',
        'flex flex-col border-l border-border',
        'bg-background shadow-xl',
        'animate-in slide-in-from-right duration-200',
      )}
      style={{ width: PANEL_WIDTH }}
    >
      {/* ── Header ── */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Bot className="h-4 w-4 text-primary" />
          AI Chat
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearHistory}>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Clear chat</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Clear history</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </div>

      {/* ── Messages ── */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div ref={scrollRef} className="flex flex-col gap-3 p-3 overflow-y-auto h-full">
          {messages.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
              <Sparkles className="h-8 w-8 opacity-40" />
              <p className="text-sm">Ask anything about your project.</p>
              <p className="text-xs opacity-60">
                <kbd>⌘⇧I</kbd> to toggle this panel
              </p>
            </div>
          )}
          {messages.map((msg) => {
            const text = getMessageText(msg);
            if (!text && msg.role !== 'user') return null;
            return (
              <div
                key={msg.id}
                className={cn(
                  'flex flex-col gap-1 rounded-lg px-3 py-2 text-sm',
                  msg.role === 'user'
                    ? 'ml-8 bg-primary text-primary-foreground'
                    : 'mr-8 bg-muted text-foreground',
                )}
              >
                <span className="text-[10px] font-medium opacity-60 uppercase">
                  {msg.role === 'user' ? 'You' : 'Assistant'}
                </span>
                <div className="whitespace-pre-wrap break-words">{text}</div>
              </div>
            );
          })}
          {isStreaming && (
            <div className="mr-8 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
              Thinking…
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Error: {error.message || 'Something went wrong'}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ── Input ── */}
      <div className="shrink-0 border-t p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            data-testid="ai-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI…"
            rows={1}
            className={cn(
              'flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              'max-h-32 min-h-[36px]',
            )}
          />
          <Button
            type="button"
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={!input.trim() || isStreaming}
            onClick={handleSend}
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </div>
    </aside>
  );
}
