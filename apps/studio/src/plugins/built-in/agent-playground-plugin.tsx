// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Built-in Plugin: Agent Playground
 *
 * Interactive testing environment for AI agents.
 * Provides embedded chat interface, agent metadata display,
 * and conversation history management.
 *
 * Priority: 10 (higher than default inspector, lower than specialized designers)
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { defineStudioPlugin } from '@objectstack/spec/studio';
import { useClient } from '@objectstack/client-react';
import { useParams } from '@tanstack/react-router';
import { useScopedClient } from '@/hooks/useObjectStackClient';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import type { StudioPlugin, MetadataViewerProps } from '../types';
import type { Agent } from '@objectstack/spec/ai';
import {
  Bot, Send, Trash2, Sparkles, Wrench,
  CheckCircle2, XCircle, Loader2, ShieldAlert,
  ChevronDown, ChevronRight, Brain, Zap, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/config';

// Storage key for agent playground messages
const getAgentStorageKey = (agentName: string) => `objectstack:agent-playground:${agentName}`;

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

/**
 * Tool Invocation Display Component
 */
interface ToolInvocationDisplayProps {
  part: Extract<UIMessage['parts'][number], { type: 'dynamic-tool' }>;
  onApprove?: (approvalId: string) => void;
  onDeny?: (approvalId: string) => void;
}

function ToolInvocationDisplay({ part, onApprove, onDeny }: ToolInvocationDisplayProps) {
  const toolLabel = formatToolName(part.toolName);
  const argsText = formatToolArgs(part.input);

  switch (part.state) {
    case 'input-streaming':
      return (
        <div className="flex items-start gap-2 rounded-md border border-blue-500/40 bg-blue-500/10 px-2.5 py-2 text-xs">
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
        <div className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/50 px-2.5 py-2 text-xs">
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
        <div className="flex flex-col gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-2.5 py-2 text-xs">
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
        <div className="flex items-start gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-2.5 py-2 text-xs">
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
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <span className="font-medium">{toolLabel} failed</span>
            <p className="mt-0.5 text-destructive/80">{part.errorText}</p>
          </div>
        </div>
      );

    case 'output-denied':
      return (
        <div className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/50 px-2.5 py-2 text-xs">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="font-medium text-muted-foreground">{toolLabel} — denied</span>
        </div>
      );

    default:
      return (
        <div className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/50 px-2.5 py-2 text-xs">
          <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="font-medium">{toolLabel}</span>
        </div>
      );
  }
}

/**
 * Agent Playground Viewer Component
 */
function AgentPlaygroundViewer({ metadataType, metadataName, data, packageId }: MetadataViewerProps) {
  const unscopedClient = useClient();
  const params = useParams({ strict: false }) as { projectId?: string };
  const scopedClient = useScopedClient(params.projectId);
  const client: any = scopedClient ?? unscopedClient;
  const [agent, setAgent] = useState<Agent | null>(data ?? null);
  const [loading, setLoading] = useState(!data);
  const [input, setInput] = useState('');
  const [thinkingState, setThinkingState] = useState<ThinkingState>({
    reasoning: [],
    activeSteps: new Map(),
    completedSteps: [],
  });
  const [showMetadata, setShowMetadata] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const baseUrl = getApiBaseUrl();

  // Load agent metadata
  useEffect(() => {
    if (data) {
      setAgent(data as Agent);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    async function load() {
      try {
        const result: any = await client.meta.getItem(metadataType, metadataName, packageId ? { packageId } : undefined);
        if (mounted) {
          setAgent(result?.item || result);
        }
      } catch (err) {
        console.error(`[AgentPlayground] Failed to load agent ${metadataName}:`, err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [client, metadataType, metadataName, data, packageId]);

  // Load persisted messages for this agent
  const loadMessages = useCallback((): UIMessage[] => {
    try {
      const key = getAgentStorageKey(metadataName);
      const stored = localStorage.getItem(key);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }, [metadataName]);

  // Save messages to localStorage
  const saveMessages = useCallback((msgs: UIMessage[]) => {
    try {
      const key = getAgentStorageKey(metadataName);
      localStorage.setItem(key, JSON.stringify(msgs));
    } catch {
      // silently ignore
    }
  }, [metadataName]);

  const initialMessages = useMemo(() => loadMessages(), [loadMessages]);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: `${baseUrl}/api/v1/ai/agents/${metadataName}/chat` }),
    [baseUrl, metadataName],
  );

  const { messages, sendMessage, setMessages, status, error, addToolApprovalResponse } = useChat({
    transport,
    messages: initialMessages,
    onFinish: () => {
      setThinkingState({
        reasoning: [],
        activeSteps: new Map(),
        completedSteps: [],
      });
    },
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  // Extract reasoning and step progress
  useEffect(() => {
    if (!isStreaming || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'assistant') return;

    const reasoning: string[] = [];
    const activeSteps = new Map<string, { stepName: string; startedAt: number }>();
    const completedSteps: string[] = [];

    (lastMessage.parts || []).forEach((part: any) => {
      if (part.type === 'reasoning-delta' || part.type === 'reasoning') {
        reasoning.push(part.text);
      } else if (part.type === 'step-start') {
        activeSteps.set(part.stepId, {
          stepName: part.stepName,
          startedAt: Date.now(),
        });
      } else if (part.type === 'step-finish') {
        completedSteps.push(part.stepName);
      }
    });

    setThinkingState({ reasoning, activeSteps, completedSteps });
  }, [messages, isStreaming]);

  // Persist messages
  useEffect(() => {
    if (messages.length > 0) {
      saveMessages(messages);
    }
  }, [messages, saveMessages]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const clearHistory = () => {
    setMessages([]);
    saveMessages([]);
  };

  const downloadHistory = () => {
    const blob = new Blob([JSON.stringify(messages, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-${metadataName}-conversation-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    sendMessage({ text });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading agent...</span>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Bot className="h-12 w-12 mx-auto mb-4 opacity-40" />
        <p className="text-sm">Agent not found: <code className="font-mono">{metadataName}</code></p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b bg-background">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-sm font-semibold">{agent.label}</h2>
              <p className="text-xs text-muted-foreground">{agent.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowMetadata(!showMetadata)}
                  >
                    <ChevronDown className={cn(
                      "h-4 w-4 transition-transform",
                      showMetadata && "rotate-180"
                    )} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>{showMetadata ? 'Hide' : 'Show'} metadata</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={downloadHistory}
                    disabled={messages.length === 0}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Download conversation</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={clearHistory}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Clear history</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Agent Metadata (collapsible) */}
        {showMetadata && (
          <div className="px-4 pb-3 border-t">
            <div className="mt-3 text-xs space-y-2">
              <div>
                <span className="text-muted-foreground">Instructions:</span>
                <p className="mt-1 text-foreground whitespace-pre-wrap">{agent.instructions}</p>
              </div>
              {agent.model && (
                <div>
                  <span className="text-muted-foreground">Model:</span>
                  <span className="ml-2 font-mono">{agent.model.model}</span>
                </div>
              )}
              {agent.skills && agent.skills.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Skills:</span>
                  <span className="ml-2">{agent.skills.join(', ')}</span>
                </div>
              )}
              {agent.tools && agent.tools.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Tools:</span>
                  <span className="ml-2">{agent.tools.map(t => t.name).join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="flex flex-col gap-3 p-4 overflow-y-auto h-full">
          {messages.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
              <Sparkles className="h-8 w-8 opacity-40" />
              <p className="text-sm">Start testing {agent.label}</p>
              <p className="text-xs opacity-60">Send a message to begin the conversation</p>
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
              {thinkingState.reasoning.length > 0 && (
                <div className="mr-8">
                  <ReasoningDisplay reasoning={thinkingState.reasoning} />
                </div>
              )}
              {thinkingState.activeSteps.size > 0 && (
                <div className="mr-8">
                  <StepProgress
                    activeSteps={thinkingState.activeSteps}
                    completedSteps={thinkingState.completedSteps}
                  />
                </div>
              )}
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
                <p className="font-medium">Error</p>
                <p className="mt-0.5 text-xs opacity-80">
                  {error.message || 'Something went wrong'}
                </p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="shrink-0 border-t p-4">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
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
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Plugin Definition ───────────────────────────────────────────────

export const agentPlaygroundPlugin: StudioPlugin = {
  manifest: defineStudioPlugin({
    id: 'objectstack.agent-playground',
    name: 'Agent Playground',
    version: '1.0.0',
    description: 'Interactive testing environment for AI agents with embedded chat interface.',
    contributes: {
      metadataViewers: [
        {
          id: 'agent-playground',
          metadataTypes: ['agent'],
          label: 'Playground',
          priority: 10,
          modes: ['preview'],
        },
      ],
    },
  }),

  activate(api) {
    api.registerViewer('agent-playground', AgentPlaygroundViewer);
  },
};
