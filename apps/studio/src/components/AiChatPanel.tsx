// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import {
  Bot, X, Send, Trash2, Sparkles,
  Wrench, CheckCircle2, XCircle, Loader2, ShieldAlert,
  ChevronDown, ChevronRight, Brain, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAiChatPanel, loadMessages, saveMessages } from '@/hooks/use-ai-chat-panel';
import { getApiBaseUrl } from '@/lib/config';

const PANEL_WIDTH = 380;
const COLLAPSED_WIDTH = 48;

/** @internal — exported for testing */
export const AGENT_STORAGE_KEY = 'objectstack:ai-chat-agent';
/** @internal — exported for testing */
export const GENERAL_CHAT_VALUE = '__general__';

/** Summary returned by GET /api/v1/ai/agents */
interface AgentSummary {
  name: string;
  label: string;
  role: string;
}

/**
 * Extended stream event types for reasoning and steps.
 * These extend the standard Vercel AI SDK stream events.
 */
interface ReasoningStartEvent {
  type: 'reasoning-start';
  id: string;
}

interface ReasoningDeltaEvent {
  type: 'reasoning-delta';
  id: string;
  delta: string;
}

interface ReasoningEndEvent {
  type: 'reasoning-end';
  id: string;
}

interface StepStartEvent {
  type: 'step-start';
  stepId: string;
  stepName: string;
}

interface StepFinishEvent {
  type: 'step-finish';
  stepId: string;
  stepName: string;
}

/**
 * Track active thinking/reasoning state during streaming.
 */
interface ThinkingState {
  reasoning: string[];
  activeSteps: Map<string, { stepName: string; startedAt: number }>;
  completedSteps: string[];
}

/**
 * Extract the text content from a UIMessage's parts array.
 */
function getMessageText(msg: UIMessage): string {
  return (msg.parts ?? [])
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

/**
 * Convert a snake_case tool name to a human-readable label.
 */
function formatToolName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Render a concise summary of tool input arguments.
 */
function formatToolArgs(input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length === 0) return '';
  return entries
    .slice(0, 4)
    .map(([k, v]) => {
      let val: string;
      try {
        val = typeof v === 'string' ? v : (JSON.stringify(v) ?? String(v));
      } catch {
        val = String(v);
      }
      const display = val.length > 30 ? val.slice(0, 30) + '…' : val;
      return `${k}: ${display}`;
    })
    .join(', ');
}

/**
 * Type guard to check if a message part is a tool invocation (dynamic-tool).
 */
function isToolPart(part: UIMessage['parts'][number]): part is Extract<UIMessage['parts'][number], { type: 'dynamic-tool' }> {
  return part.type === 'dynamic-tool';
}

/**
 * Format tool output for display, truncating to a max length.
 */
function formatToolOutput(output: unknown, maxLen = 80): string {
  let raw: string;
  try {
    raw = typeof output === 'string' ? output : (JSON.stringify(output) ?? '');
  } catch {
    raw = String(output ?? '');
  }
  return raw.length > maxLen ? raw.slice(0, maxLen) + '…' : raw;
}

/**
 * Build the chat API URL for the given agent selection.
 * @internal — exported for testing
 */
export function chatApiUrl(baseUrl: string, agentName: string | null): string {
  if (!agentName || agentName === GENERAL_CHAT_VALUE) {
    return `${baseUrl}/api/v1/ai/chat`;
  }
  return `${baseUrl}/api/v1/ai/agents/${agentName}/chat`;
}

/**
 * Load persisted agent selection from localStorage.
 * @internal — exported for testing
 */
export function loadSelectedAgent(): string {
  try {
    return localStorage.getItem(AGENT_STORAGE_KEY) ?? GENERAL_CHAT_VALUE;
  } catch {
    return GENERAL_CHAT_VALUE;
  }
}

/**
 * Persist agent selection to localStorage.
 * @internal — exported for testing
 */
export function saveSelectedAgent(agent: string): void {
  try {
    localStorage.setItem(AGENT_STORAGE_KEY, agent);
  } catch {
    // silently ignore
  }
}

/**
 * Hook to fetch the list of available agents from the server.
 */
function useAgentList(baseUrl: string) {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`${baseUrl}/api/v1/ai/agents`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { agents: [] }))
      .then((data: { agents?: AgentSummary[] }) => {
        if (!cancelled) setAgents(data.agents ?? []);
      })
      .catch(() => {
        if (!cancelled) setAgents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [baseUrl]);

  return { agents, loading };
}

// ── Tool Invocation State Labels ────────────────────────────────────

/**
 * Display reasoning/thinking information in a collapsible section.
 */
interface ReasoningDisplayProps {
  reasoning: string[];
}

function ReasoningDisplay({ reasoning }: ReasoningDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (reasoning.length === 0) return null;

  return (
    <div
      data-testid="reasoning-display"
      className="flex flex-col gap-1 rounded-md border border-border/30 bg-muted/30 px-2.5 py-2 text-xs"
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-left text-muted-foreground hover:text-foreground transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <Brain className="h-3 w-3 shrink-0" />
        <span className="font-medium">Thinking</span>
        <span className="text-[10px] opacity-60">
          ({reasoning.length} step{reasoning.length !== 1 ? 's' : ''})
        </span>
      </button>
      {isExpanded && (
        <div className="mt-1 space-y-1 pl-5 text-muted-foreground italic border-l-2 border-border/30">
          {reasoning.map((step, idx) => (
            <p key={idx} className="text-[11px] leading-relaxed">
              {step}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Display active step progress indicators.
 */
interface StepProgressProps {
  activeSteps: Map<string, { stepName: string; startedAt: number }>;
  completedSteps: string[];
}

function StepProgress({ activeSteps, completedSteps }: StepProgressProps) {
  if (activeSteps.size === 0) return null;

  const totalSteps = completedSteps.length + activeSteps.size;
  const currentStep = completedSteps.length + 1;

  return (
    <div
      data-testid="step-progress"
      className="flex flex-col gap-1.5 rounded-md border border-blue-500/30 bg-blue-500/5 px-2.5 py-2 text-xs"
    >
      <div className="flex items-center gap-2">
        <Zap className="h-3 w-3 shrink-0 text-blue-600 dark:text-blue-400" />
        <span className="font-medium text-blue-700 dark:text-blue-300">
          Step {currentStep} of {totalSteps}
        </span>
      </div>
      {Array.from(activeSteps.values()).map((step, idx) => (
        <div key={idx} className="flex items-center gap-2 pl-5">
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
          <span className="text-blue-700 dark:text-blue-300">{step.stepName}</span>
        </div>
      ))}
    </div>
  );
}

// ── Tool Invocation State Labels ────────────────────────────────────

interface ToolInvocationDisplayProps {
  part: Extract<UIMessage['parts'][number], { type: 'dynamic-tool' }>;
  onApprove?: (approvalId: string) => void;
  onDeny?: (approvalId: string) => void;
}

/**
 * Renders a single tool invocation part with appropriate status indicator.
 */
function ToolInvocationDisplay({ part, onApprove, onDeny }: ToolInvocationDisplayProps) {
  const toolLabel = formatToolName(part.toolName);
  const argsText = formatToolArgs(part.input);

  switch (part.state) {
    case 'input-streaming':
      return (
        <div
          data-testid="tool-invocation-planning"
          className="flex items-start gap-2 rounded-md border border-blue-500/40 bg-blue-500/10 px-2.5 py-2 text-xs"
        >
          <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
          <div className="min-w-0">
            <span className="font-medium text-blue-700 dark:text-blue-300">Planning to call {toolLabel}</span>
            {argsText && (
              <p className="mt-0.5 truncate text-blue-600/80 dark:text-blue-300/80">{argsText}</p>
            )}
          </div>
        </div>
      );

    case 'input-available':
      return (
        <div
          data-testid="tool-invocation-calling"
          className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/50 px-2.5 py-2 text-xs"
        >
          <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
          <div className="min-w-0">
            <span className="font-medium">Calling {toolLabel}</span>
            {argsText && (
              <p className="mt-0.5 truncate text-muted-foreground">{argsText}</p>
            )}
          </div>
        </div>
      );

    case 'approval-requested':
      return (
        <div
          data-testid="tool-invocation-confirm"
          className="flex flex-col gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-2.5 py-2 text-xs"
        >
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-600 dark:text-yellow-400" />
            <div className="min-w-0">
              <span className="font-medium">Confirm: {toolLabel}</span>
              {argsText && (
                <p className="mt-0.5 text-muted-foreground">{argsText}</p>
              )}
            </div>
          </div>
          {part.approval && onApprove && onDeny && (
            <div className="flex gap-2 pl-5">
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={() => onApprove(part.approval!.id)}
              >
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => onDeny(part.approval!.id)}
              >
                <XCircle className="mr-1 h-3 w-3" />
                Deny
              </Button>
            </div>
          )}
        </div>
      );

    case 'output-available':
      return (
        <div
          data-testid="tool-invocation-result"
          className="flex items-start gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-2.5 py-2 text-xs"
        >
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />
          <div className="min-w-0">
            <span className="font-medium">{toolLabel}</span>
            <p className="mt-0.5 text-muted-foreground truncate">
              {formatToolOutput(part.output)}
            </p>
          </div>
        </div>
      );

    case 'output-error':
      return (
        <div
          data-testid="tool-invocation-error"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs"
        >
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <span className="font-medium">{toolLabel} failed</span>
            <p className="mt-0.5 text-destructive/80">{part.errorText}</p>
          </div>
        </div>
      );

    case 'output-denied':
      return (
        <div
          data-testid="tool-invocation-denied"
          className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/50 px-2.5 py-2 text-xs"
        >
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="font-medium text-muted-foreground">{toolLabel} — denied</span>
        </div>
      );

    default:
      return (
        <div
          data-testid="tool-invocation-unknown"
          className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/50 px-2.5 py-2 text-xs"
        >
          <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="font-medium">{toolLabel}</span>
        </div>
      );
  }
}

export function AiChatPanel() {
  const { isOpen, setOpen, toggle } = useAiChatPanel();
  const [input, setInput] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string>(loadSelectedAgent);
  const [thinkingState, setThinkingState] = useState<ThinkingState>({
    reasoning: [],
    activeSteps: new Map(),
    completedSteps: [],
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const baseUrl = getApiBaseUrl();
  const { agents, loading: agentsLoading } = useAgentList(baseUrl);

  // Validate persisted agent against fetched list — fall back to general
  // chat if the previously selected agent is no longer available.
  useEffect(() => {
    if (agentsLoading) return;
    if (selectedAgent === GENERAL_CHAT_VALUE) return;
    const isValid = agents.some((a) => a.name === selectedAgent);
    if (!isValid) {
      setSelectedAgent(GENERAL_CHAT_VALUE);
      saveSelectedAgent(GENERAL_CHAT_VALUE);
    }
  }, [agents, agentsLoading, selectedAgent]);

  const initialMessages = useMemo(() => loadMessages() as UIMessage[], []);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: chatApiUrl(baseUrl, selectedAgent) }),
    [baseUrl, selectedAgent],
  );

  const { messages, sendMessage, setMessages, status, error, addToolApprovalResponse, data } = useChat({
    transport,
    messages: initialMessages,
    streamMode: 'stream-data',
    onFinish: () => {
      // Reset thinking state when stream completes
      setThinkingState({
        reasoning: [],
        activeSteps: new Map(),
        completedSteps: [],
      });
    },
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  // Process stream data events for reasoning and step progress
  useEffect(() => {
    if (!data || data.length === 0) return;

    // Process each data event from the stream
    data.forEach((event: any) => {
      if (event.type === 'reasoning-delta') {
        setThinkingState((prev) => ({
          ...prev,
          reasoning: [...prev.reasoning, event.delta],
        }));
      } else if (event.type === 'step-start') {
        setThinkingState((prev) => {
          const newActiveSteps = new Map(prev.activeSteps);
          newActiveSteps.set(event.stepId, {
            stepName: event.stepName,
            startedAt: Date.now(),
          });
          return {
            ...prev,
            activeSteps: newActiveSteps,
          };
        });
      } else if (event.type === 'step-finish') {
        setThinkingState((prev) => {
          const newActiveSteps = new Map(prev.activeSteps);
          newActiveSteps.delete(event.stepId);
          return {
            ...prev,
            activeSteps: newActiveSteps,
            completedSteps: [...prev.completedSteps, event.stepName],
          };
        });
      }
    });
  }, [data]);

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

  const handleAgentChange = useCallback((value: string) => {
    setSelectedAgent(value);
    saveSelectedAgent(value);
    // Clear conversation when switching agents to avoid context confusion
    setMessages([]);
    saveMessages([]);
  }, [setMessages]);

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
      <div className="shrink-0 border-b">
        <div className="flex h-12 items-center justify-between px-3">
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
        {/* ── Agent Selector ── */}
        <div className="px-3 pb-2">
          <Select
            value={selectedAgent}
            onValueChange={handleAgentChange}
            disabled={agentsLoading || isStreaming}
          >
            <SelectTrigger
              data-testid="agent-selector"
              className="h-8 text-xs"
            >
              <SelectValue placeholder="Select agent…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={GENERAL_CHAT_VALUE}>
                General Chat
              </SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.name} value={a.name}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            const toolParts = (msg.parts ?? []).filter(isToolPart);
            const hasContent = !!text || toolParts.length > 0;
            if (!hasContent && msg.role !== 'user') return null;
            return (
              <div
                key={msg.id}
                className={cn(
                  'flex flex-col gap-1.5 rounded-lg px-3 py-2 text-sm',
                  msg.role === 'user'
                    ? 'ml-8 bg-primary text-primary-foreground'
                    : 'mr-8 bg-muted text-foreground',
                )}
              >
                <span className="text-[10px] font-medium opacity-60 uppercase">
                  {msg.role === 'user' ? 'You' : 'Assistant'}
                </span>
                {text && <div className="whitespace-pre-wrap break-words">{text}</div>}
                {toolParts.map((toolPart) => (
                  <ToolInvocationDisplay
                    key={toolPart.toolCallId}
                    part={toolPart}
                    onApprove={(approvalId) =>
                      addToolApprovalResponse({ id: approvalId, approved: true })
                    }
                    onDeny={(approvalId) =>
                      addToolApprovalResponse({
                        id: approvalId,
                        approved: false,
                        reason: 'User denied the operation',
                      })
                    }
                  />
                ))}
              </div>
            );
          })}
          {isStreaming && (
            <>
              {/* Show reasoning if available */}
              {thinkingState.reasoning.length > 0 && (
                <div className="mr-8">
                  <ReasoningDisplay reasoning={thinkingState.reasoning} />
                </div>
              )}
              {/* Show step progress if available */}
              {thinkingState.activeSteps.size > 0 && (
                <div className="mr-8">
                  <StepProgress
                    activeSteps={thinkingState.activeSteps}
                    completedSteps={thinkingState.completedSteps}
                  />
                </div>
              )}
              {/* Default thinking indicator when no detailed state available */}
              {thinkingState.reasoning.length === 0 && thinkingState.activeSteps.size === 0 && (
                <div className="mr-8 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
                  Thinking…
                </div>
              )}
            </>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Chat Error</p>
                <p className="mt-0.5 text-xs opacity-80">
                  {error.message || 'Something went wrong'}
                </p>
                {error.message && /unexpected|json|parse|stream/i.test(error.message) && (
                  <p className="mt-1 text-xs opacity-70">
                    The server may not be returning the expected Vercel AI Data Stream format.
                    Ensure the backend endpoint supports SSE streaming.
                  </p>
                )}
              </div>
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
