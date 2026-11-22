import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cpu,
  Loader2,
  Mic,
  Monitor,
  Moon,
  Plus,
  RotateCcw,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Sun,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { BotAvatar } from './components/BotAvatar';
import { DetailsDrawer, type DetailsTab } from './components/DetailsDrawer';
import { ScreenViewer } from './components/ScreenViewer';
import { VoiceModal } from './components/VoiceModal';
import type {
  Bot,
  BotEngine,
  ChatMessage,
  ScreenApp,
  ToolStep,
  WorkspaceState,
} from './types';

function formatDuration(ms?: number): string {
  if (!ms || ms < 1000) return '1s';
  const totalSec = Math.round(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function renderFormattedText(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return (
      <React.Fragment key={lineIdx}>
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={idx} className="font-semibold text-zinc-900 dark:text-zinc-50">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <code
                key={idx}
                className="px-1 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 font-mono text-[11px]"
              >
                {part.slice(1, -1)}
              </code>
            );
          }
          return <React.Fragment key={idx}>{part}</React.Fragment>;
        })}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

const StepStatusIcon: React.FC<{ status: ToolStep['status'] }> = ({ status }) => {
  if (status === 'running') return <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin shrink-0" />;
  if (status === 'waiting_approval')
    return <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
  if (status === 'rejected') return <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />;
  return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
};

const WorkTraceChip: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const [open, setOpen] = useState(Boolean(message.isStreaming));
  const steps = message.steps || [];

  useEffect(() => {
    if (message.isStreaming) setOpen(true);
  }, [message.isStreaming]);

  if (steps.length === 0) return null;

  return (
    <div className="mb-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 transition-colors"
      >
        {message.isStreaming ? (
          <Loader2 className="w-3 h-3 text-orange-500 animate-spin" />
        ) : open ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <span>
          {message.isStreaming
            ? `Working · ${steps.length} ${steps.length === 1 ? 'step' : 'steps'}`
            : `Worked for ${formatDuration(message.durationMs)} · ${steps.length} ${
                steps.length === 1 ? 'step' : 'steps'
              }`}
        </span>
      </button>

      {open && (
        <div className="mt-2 pl-3 border-l-2 border-zinc-200 dark:border-zinc-800 space-y-1.5">
          {steps.map((s) => (
            <div key={s.id} className="flex items-start gap-2 text-xs">
              <div className="mt-0.5">
                <StepStatusIcon status={s.status} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">{s.label}</span>
                  <span className="font-mono text-[10px] text-zinc-400">{s.tool}</span>
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                  {s.detail}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export function App() {
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [activeBotId, setActiveBotId] = useState<string>('primary');
  const [rightMode, setRightMode] = useState<'screen' | 'details'>('screen');
  const [detailsTab, setDetailsTab] = useState<DetailsTab>('engine');
  const [expandedScreen, setExpandedScreen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [newBotOpen, setNewBotOpen] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [newBotRole, setNewBotRole] = useState('');
  const [newBotProvider, setNewBotProvider] = useState<BotEngine['provider']>('anthropic');
  const [prompt, setPrompt] = useState('');
  const [dark, setDark] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchState = useCallback(async () => {
    const res = await fetch('/api/state');
    if (!res.ok) return;
    const data = (await res.json()) as WorkspaceState;
    setState(data);
    setActiveBotId((prev) =>
      data.bots.some((b) => b.id === prev) ? prev : data.bots[0]?.id || 'primary',
    );
  }, []);

  useEffect(() => {
    void fetchState();
    const es = new EventSource('/api/events');
    es.onmessage = () => {
      void fetchState();
    };
    return () => es.close();
  }, [fetchState]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const activeBot: Bot | undefined = useMemo(
    () => state?.bots.find((b) => b.id === activeBotId) || state?.bots[0],
    [state, activeBotId],
  );

  const messages = useMemo(
    () => (activeBot ? state?.messages[activeBot.id] || [] : []),
    [state, activeBot],
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeBotId]);

  useEffect(() => {
    if (activeBot?.status !== 'working' || !activeBot.workingSince) {
      setElapsedSec(0);
      return;
    }
    const tick = () => {
      setElapsedSec(Math.max(1, Math.floor((Date.now() - activeBot.workingSince!) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeBot?.status, activeBot?.workingSince]);

  const apiCall = async (url: string, options?: RequestInit) => {
    setErrorBanner(null);
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setErrorBanner(err.error || 'Request failed');
      return null;
    }
    await fetchState();
    return res.json().catch(() => ({}));
  };

  const handleSend = async (text?: string) => {
    if (!activeBot) return;
    const content = (text ?? prompt).trim();
    if (!content) return;
    if (!text) setPrompt('');
    await apiCall(`/api/bots/${activeBot.id}/chat`, {
      method: 'POST',
      body: JSON.stringify({ prompt: content }),
    });
  };

  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBotName.trim()) return;
    const modelMap: Record<BotEngine['provider'], string> = {
      anthropic: 'claude-sonnet-4-5',
      openai: 'gpt-4o',
      xai: 'grok-3',
      google: 'gemini-2.5-pro',
    };
    const created = (await apiCall('/api/bots', {
      method: 'POST',
      body: JSON.stringify({
        name: newBotName.trim(),
        role: newBotRole.trim() || 'Specialized Hermes Agent',
        provider: newBotProvider,
        model: modelMap[newBotProvider],
      }),
    })) as Bot | null;
    if (created?.id) {
      setActiveBotId(created.id);
      setNewBotName('');
      setNewBotRole('');
      setNewBotOpen(false);
    }
  };

  if (!state || !activeBot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-orange-500" />
        Loading Bot HQ...
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Left Sidebar: Team of Bots */}
      <aside className="w-64 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col">
        <div className="px-4 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold text-xs">
              HQ
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Bot HQ</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {state.bots.length}/{state.config.maxBots} Orgo screens
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void apiCall('/api/fixtures/reset', { method: 'POST' })}
              className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Reset sample fixtures"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Toggle theme"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Bots List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Your Team
          </div>

          {state.bots.map((bot) => {
            const selected = bot.id === activeBot.id;
            return (
              <div
                key={bot.id}
                className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-colors ${
                  selected
                    ? 'bg-orange-50 dark:bg-orange-500/10 border border-orange-200/80 dark:border-orange-500/30'
                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/70 border border-transparent'
                }`}
                onClick={() => setActiveBotId(bot.id)}
              >
                <BotAvatar
                  variant={bot.avatarVariant}
                  color={bot.accentColor}
                  status={bot.status}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold truncate">{bot.name}</span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {bot.screen.display}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                    {bot.status === 'waiting_approval'
                      ? 'Needs approval'
                      : bot.status === 'working'
                        ? bot.currentAction || 'Working...'
                        : bot.engine.model}
                  </div>
                </div>
                {!bot.isPrimary && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void apiCall(`/api/bots/${bot.id}`, { method: 'DELETE' });
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 transition-opacity"
                    title="Delete bot and release screen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}

          {state.bots.length < state.config.maxBots && (
            <button
              type="button"
              onClick={() => setNewBotOpen(true)}
              className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:border-orange-400 hover:text-orange-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add bot</span>
            </button>
          )}
        </div>

        {/* Workspace Quick Shortcuts */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 space-y-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setRightMode('details');
              setDetailsTab('apps');
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
          >
            <span>Connected Apps</span>
            <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
              {state.apps.filter((a) => a.connected).length}/{state.apps.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setRightMode('details');
              setDetailsTab('library');
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
          >
            <span>Library</span>
            <span className="font-mono text-[11px] text-zinc-400">{state.library.length} files</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setRightMode('details');
              setDetailsTab('routines');
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
          >
            <span>Routines</span>
            <span className="font-mono text-[11px] text-zinc-400">
              {state.routines.filter((r) => r.enabled).length} active
            </span>
          </button>
        </div>
      </aside>

      {/* Center: Bot Chat & Live Work Stream */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="px-5 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BotAvatar
              variant={activeBot.avatarVariant}
              color={activeBot.accentColor}
              status={activeBot.status}
              size="md"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold truncate">{activeBot.name}</h1>
                {activeBot.isPrimary && (
                  <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-medium text-zinc-500">
                    Primary Hermes
                  </span>
                )}
                {activeBot.status === 'working' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[11px] font-medium">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Working · {elapsedSec}s
                  </span>
                )}
                {activeBot.status === 'waiting_approval' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[11px] font-medium">
                    <ShieldAlert className="w-3 h-3" />
                    Waiting on approval
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{activeBot.role}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setRightMode('details');
                setDetailsTab('engine');
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-orange-400"
            >
              <Cpu className="w-3.5 h-3.5 text-orange-500" />
              <span>{activeBot.engine.model}</span>
            </button>

            <button
              type="button"
              onClick={() => setVoiceOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium hover:opacity-90"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Voice</span>
            </button>
          </div>
        </header>

        {errorBanner && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              {errorBanner}
            </span>
            <button type="button" onClick={() => setErrorBanner(null)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((msg) => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-xl rounded-2xl rounded-br-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 text-sm leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              );
            }

            if (msg.role === 'system') {
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300">
                    {renderFormattedText(msg.content)}
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className="flex items-start gap-3 max-w-2xl">
                <BotAvatar
                  variant={activeBot.avatarVariant}
                  color={activeBot.accentColor}
                  status={msg.isStreaming ? 'working' : 'idle'}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <WorkTraceChip message={msg} />

                  {msg.content && (
                    <div className="rounded-2xl rounded-tl-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 shadow-2xs">
                      {renderFormattedText(msg.content)}
                    </div>
                  )}

                  {msg.approval && (
                    <div className="mt-2.5 rounded-xl border border-amber-300/80 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/30 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
                          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span>Approval required · {msg.approval.app}</span>
                        </div>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                          {msg.approval.action}
                        </span>
                      </div>

                      <div className="text-xs text-zinc-800 dark:text-zinc-200 font-medium">
                        {msg.approval.summary}
                      </div>

                      <div className="rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-amber-200/70 dark:border-zinc-800 p-2.5 space-y-1 text-[11px]">
                        {Object.entries(msg.approval.payload).map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <span className="font-semibold text-zinc-500 w-16 shrink-0">{k}:</span>
                            <span className="text-zinc-800 dark:text-zinc-200 break-words">{v}</span>
                          </div>
                        ))}
                      </div>

                      {msg.approval.status === 'pending' ? (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              void apiCall(`/api/approvals/${msg.approval!.id}/resolve`, {
                                method: 'POST',
                                body: JSON.stringify({ decision: 'approved' }),
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve &amp; execute
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void apiCall(`/api/approvals/${msg.approval!.id}/resolve`, {
                                method: 'POST',
                                body: JSON.stringify({ decision: 'rejected' }),
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-medium transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div
                          className={`text-xs font-semibold ${
                            msg.approval.status === 'approved'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {msg.approval.status === 'approved'
                            ? '✓ Approved and executed'
                            : '✕ Rejected by operator'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Composer */}
        <div className="px-5 pb-4 pt-2 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {[
              'Search X for autonomous agent trends',
              'Draft & send status email via Gmail',
              'Save an executive brief to Library',
              'Ask Atlas for a quick update',
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => void handleSend(chip)}
                className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 text-[11px] text-zinc-600 dark:text-zinc-300 transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="flex items-end gap-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 p-2 focus-within:ring-2 focus-within:ring-orange-500/40"
          >
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={`Message ${activeBot.name}...`}
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setVoiceOpen(true)}
              className="p-2 rounded-xl text-zinc-500 hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
              title="Talk with xAI Voice"
            >
              <Mic className="w-4 h-4" />
            </button>
            <button
              type="submit"
              disabled={!prompt.trim()}
              className="p-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>

      {/* Right Side Panel: Live Screen & Bot Details */}
      <section className="hidden lg:flex w-[420px] shrink-0 border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex-col p-3 gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-200/70 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setRightMode('screen')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              rightMode === 'screen'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Live Screen</span>
          </button>
          <button
            type="button"
            onClick={() => setRightMode('details')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              rightMode === 'details'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Details</span>
          </button>
        </div>

        <div className="flex-1 min-h-0">
          {rightMode === 'screen' ? (
            <ScreenViewer
              bot={activeBot}
              apps={state.apps}
              library={state.library}
              onInteract={async (payload) => {
                await apiCall(`/api/bots/${activeBot.id}/screen/interact`, {
                  method: 'POST',
                  body: JSON.stringify(payload),
                });
              }}
              onToggleExpand={() => setExpandedScreen(true)}
            />
          ) : (
            <DetailsDrawer
              bot={activeBot}
              tab={detailsTab}
              onTabChange={setDetailsTab}
              apps={state.apps}
              tasks={state.tasks}
              routines={state.routines}
              library={state.library}
              onUpdateEngine={async (botId, engine) => {
                await apiCall(`/api/bots/${botId}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ engine }),
                });
              }}
              onSubscriptionLogin={async (botId) => {
                await apiCall(`/api/bots/${botId}/subscription-login`, { method: 'POST' });
                setRightMode('screen');
              }}
              onToggleApp={async (slug) => {
                await apiCall(`/api/apps/${slug}/toggle`, { method: 'POST' });
              }}
              onAddTask={async (botId, title) => {
                await apiCall(`/api/bots/${botId}/tasks`, {
                  method: 'POST',
                  body: JSON.stringify({ title }),
                });
              }}
              onToggleTask={async (taskId, done) => {
                await apiCall(`/api/tasks/${taskId}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ done }),
                });
              }}
              onDeleteTask={async (taskId) => {
                await apiCall(`/api/tasks/${taskId}`, { method: 'DELETE' });
              }}
              onAddRoutine={async (botId, name, schedule, routinePrompt) => {
                await apiCall(`/api/bots/${botId}/routines`, {
                  method: 'POST',
                  body: JSON.stringify({ name, schedule, prompt: routinePrompt }),
                });
              }}
              onToggleRoutine={async (routineId, enabled) => {
                await apiCall(`/api/routines/${routineId}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ enabled }),
                });
              }}
              onRunRoutine={async (routineId) => {
                await apiCall(`/api/routines/${routineId}/run`, { method: 'POST' });
              }}
              onUpdateMemory={async (botId, memory) => {
                await apiCall(`/api/bots/${botId}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ memory }),
                });
              }}
              onDeleteLibrary={async (id) => {
                await apiCall(`/api/library/${id}`, { method: 'DELETE' });
              }}
            />
          )}
        </div>
      </section>

      {/* Full-Size Screen Viewer Modal */}
      {expandedScreen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs p-6 flex items-center justify-center">
          <div className="w-full max-w-5xl h-[85vh]">
            <ScreenViewer
              bot={activeBot}
              apps={state.apps}
              library={state.library}
              expanded
              onToggleExpand={() => setExpandedScreen(false)}
              onInteract={async (payload) => {
                await apiCall(`/api/bots/${activeBot.id}/screen/interact`, {
                  method: 'POST',
                  body: JSON.stringify(payload),
                });
              }}
            />
          </div>
        </div>
      )}

      {/* Voice Modal */}
      {voiceOpen && (
        <VoiceModal
          bot={activeBot}
          onClose={() => setVoiceOpen(false)}
          onVoiceTurn={async (botId, transcript) => {
            const res = (await apiCall('/api/voice/turn', {
              method: 'POST',
              body: JSON.stringify({ botId, transcript }),
            })) as { spokenReply: string; handedToChat: boolean } | null;
            return (
              res || {
                spokenReply: 'Voice request could not be completed right now.',
                handedToChat: false,
              }
            );
          }}
        />
      )}

      {/* New Bot Modal */}
      {newBotOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs p-4 flex items-center justify-center">
          <form
            onSubmit={handleCreateBot}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Add Hermes Bot</h2>
              <button
                type="button"
                onClick={() => setNewBotOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Spawns a dedicated Hermes home, gateway, and Orgo screen on the shared computer.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">Bot Name</label>
                <input
                  type="text"
                  required
                  value={newBotName}
                  onChange={(e) => setNewBotName(e.target.value)}
                  placeholder="e.g. Echo"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Role</label>
                <input
                  type="text"
                  value={newBotRole}
                  onChange={(e) => setNewBotRole(e.target.value)}
                  placeholder="e.g. Release QA & GitHub Triage"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Engine Provider</label>
                <select
                  value={newBotProvider}
                  onChange={(e) => setNewBotProvider(e.target.value as BotEngine['provider'])}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2"
                >
                  <option value="anthropic">Anthropic (Claude Sonnet 4.5)</option>
                  <option value="openai">OpenAI (GPT-4o)</option>
                  <option value="xai">xAI (Grok 3)</option>
                  <option value="google">Google (Gemini 2.5 Pro)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewBotOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium"
              >
                Create bot
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
