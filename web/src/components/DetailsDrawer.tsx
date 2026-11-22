import React, { useState } from 'react';
import {
  BookOpen,
  CheckSquare,
  Clock,
  Cpu,
  KeyRound,
  Link2,
  Play,
  Plus,
  Square,
  Trash2,
} from 'lucide-react';
import type {
  Bot,
  BotEngine,
  BotRoutine,
  BotTask,
  ConnectedApp,
  LibraryItem,
} from '../types';

export type DetailsTab = 'engine' | 'apps' | 'tasks' | 'routines' | 'memory' | 'library';

interface DetailsDrawerProps {
  bot: Bot;
  tab: DetailsTab;
  onTabChange: (tab: DetailsTab) => void;
  apps: ConnectedApp[];
  tasks: BotTask[];
  routines: BotRoutine[];
  library: LibraryItem[];
  onUpdateEngine: (botId: string, engine: Partial<BotEngine>) => Promise<void>;
  onSubscriptionLogin: (botId: string) => Promise<void>;
  onToggleApp: (slug: string) => Promise<void>;
  onAddTask: (botId: string, title: string) => Promise<void>;
  onToggleTask: (taskId: string, done: boolean) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onAddRoutine: (botId: string, name: string, schedule: string, prompt: string) => Promise<void>;
  onToggleRoutine: (routineId: string, enabled: boolean) => Promise<void>;
  onRunRoutine: (routineId: string) => Promise<void>;
  onUpdateMemory: (botId: string, memory: string[]) => Promise<void>;
  onDeleteLibrary: (id: string) => Promise<void>;
}

const MODEL_CATALOG: Record<BotEngine['provider'], string[]> = {
  anthropic: ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-haiku-3-5'],
  openai: ['gpt-4o', 'o3-mini', 'gpt-4.1'],
  xai: ['grok-3', 'grok-3-mini', 'grok-2-vision'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash'],
};

export const DetailsDrawer: React.FC<DetailsDrawerProps> = ({
  bot,
  tab,
  onTabChange,
  apps,
  tasks,
  routines,
  library,
  onUpdateEngine,
  onSubscriptionLogin,
  onToggleApp,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onAddRoutine,
  onToggleRoutine,
  onRunRoutine,
  onUpdateMemory,
  onDeleteLibrary,
}) => {
  const [newTask, setNewTask] = useState('');
  const [routineName, setRoutineName] = useState('');
  const [routineSchedule, setRoutineSchedule] = useState('Every day at 09:00');
  const [routinePrompt, setRoutinePrompt] = useState('');
  const [newMemory, setNewMemory] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<LibraryItem | null>(null);

  const botTasks = tasks.filter((t) => t.botId === bot.id);
  const botRoutines = routines.filter((r) => r.botId === bot.id);

  const tabs: { id: DetailsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'engine', label: 'Engine', icon: Cpu },
    { id: 'apps', label: 'Apps', icon: Link2 },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'routines', label: 'Routines', icon: Clock },
    { id: 'memory', label: 'Memory', icon: KeyRound },
    { id: 'library', label: 'Library', icon: BookOpen },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              tab === id
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
        {tab === 'engine' && (
          <div className="space-y-4">
            <div>
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">Model &amp; Provider</div>
              <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">
                Each bot runs its own Hermes gateway and model configuration.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block font-medium text-zinc-700 dark:text-zinc-300">Provider</label>
              <select
                value={bot.engine.provider}
                onChange={(e) => {
                  const provider = e.target.value as BotEngine['provider'];
                  void onUpdateEngine(bot.id, {
                    provider,
                    model: MODEL_CATALOG[provider][0],
                    subscriptionActive: false,
                    subscriptionLabel: undefined,
                  });
                }}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
              >
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI (ChatGPT)</option>
                <option value="xai">xAI (Grok)</option>
                <option value="google">Google (Gemini)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block font-medium text-zinc-700 dark:text-zinc-300">Model</label>
              <select
                value={bot.engine.model}
                onChange={(e) => void onUpdateEngine(bot.id, { model: e.target.value })}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
              >
                {MODEL_CATALOG[bot.engine.provider].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">Subscription Sign-in</span>
                {bot.engine.subscriptionActive ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium">
                    {bot.engine.subscriptionLabel || 'Active'}
                  </span>
                ) : (
                  <span className="text-zinc-400">API key mode</span>
                )}
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Opens Hermes sign-in inside {bot.name}’s terminal on display {bot.screen.display} so the bot can use your existing consumer subscription.
              </p>
              <button
                type="button"
                onClick={() => void onSubscriptionLogin(bot.id)}
                className="w-full py-2 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
              >
                Sign in to a subscription on screen {bot.screen.display}
              </button>
            </div>
          </div>
        )}

        {tab === 'apps' && (
          <div className="space-y-3">
            <div>
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">Connected Apps (Composio)</div>
              <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">
                Read actions run automatically. Write actions (send, post, delete) pause for your approval card in chat.
              </p>
            </div>

            <div className="space-y-2">
              {apps.map((app) => (
                <div
                  key={app.slug}
                  className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{app.name}</span>
                      <span className="text-[11px] text-zinc-400">{app.category}</span>
                    </div>
                    {app.connected && app.accountLabel && (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {app.accountLabel}
                      </div>
                    )}
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                      {app.capabilities.join(' · ')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onToggleApp(app.slug)}
                    className={`px-2.5 py-1 rounded-lg font-medium shrink-0 transition-colors ${
                      app.connected
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-red-50 hover:text-red-600'
                        : 'bg-orange-500 text-white hover:bg-orange-600'
                    }`}
                  >
                    {app.connected ? 'Disconnect' : 'Connect'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'tasks' && (
          <div className="space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTask.trim()) return;
                void onAddTask(bot.id, newTask.trim());
                setNewTask('');
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder={`Add task for ${bot.name}...`}
                className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-zinc-900 dark:text-zinc-100"
              />
              <button
                type="submit"
                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            {botTasks.length === 0 ? (
              <p className="text-zinc-400 text-center py-6">No tasks yet for {bot.name}.</p>
            ) : (
              <div className="space-y-1.5">
                {botTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800"
                  >
                    <button
                      type="button"
                      onClick={() => void onToggleTask(t.id, !t.done)}
                      className="flex items-center gap-2 text-left flex-1"
                    >
                      {t.done ? (
                        <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-zinc-400 shrink-0" />
                      )}
                      <span
                        className={
                          t.done
                            ? 'line-through text-zinc-400'
                            : 'text-zinc-800 dark:text-zinc-200'
                        }
                      >
                        {t.title}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteTask(t.id)}
                      className="text-zinc-400 hover:text-red-500 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'routines' && (
          <div className="space-y-3">
            <div className="space-y-2">
              {botRoutines.map((r) => (
                <div
                  key={r.id}
                  className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">{r.name}</div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{r.schedule}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void onRunRoutine(r.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 font-medium"
                      >
                        <Play className="w-3 h-3" />
                        Run
                      </button>
                      <button
                        type="button"
                        onClick={() => void onToggleRoutine(r.id, !r.enabled)}
                        className={`px-2 py-1 rounded-md font-medium ${
                          r.enabled
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {r.enabled ? 'On' : 'Off'}
                      </button>
                    </div>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{r.prompt}</p>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!routineName.trim() || !routinePrompt.trim()) return;
                void onAddRoutine(bot.id, routineName.trim(), routineSchedule.trim(), routinePrompt.trim());
                setRoutineName('');
                setRoutinePrompt('');
              }}
              className="p-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 space-y-2"
            >
              <div className="font-medium text-zinc-700 dark:text-zinc-300">New Routine</div>
              <input
                type="text"
                value={routineName}
                onChange={(e) => setRoutineName(e.target.value)}
                placeholder="Routine name"
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1.5"
              />
              <input
                type="text"
                value={routineSchedule}
                onChange={(e) => setRoutineSchedule(e.target.value)}
                placeholder="Schedule (e.g. Weekdays at 09:00)"
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1.5"
              />
              <textarea
                value={routinePrompt}
                onChange={(e) => setRoutinePrompt(e.target.value)}
                placeholder="What should the bot do on each run?"
                rows={2}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1.5"
              />
              <button
                type="submit"
                className="w-full py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium"
              >
                Add routine
              </button>
            </form>
          </div>
        )}

        {tab === 'memory' && (
          <div className="space-y-3">
            <div>
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">Bot Memory &amp; MCP</div>
              <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">
                MCP endpoint: <code className="font-mono text-orange-600">/mcp/{bot.id}</code>
              </p>
            </div>
            <div className="space-y-1.5">
              {bot.memory.map((m, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                >
                  <span className="text-zinc-700 dark:text-zinc-300">{m}</span>
                  <button
                    type="button"
                    onClick={() =>
                      void onUpdateMemory(
                        bot.id,
                        bot.memory.filter((_, i) => i !== idx),
                      )
                    }
                    className="text-zinc-400 hover:text-red-500 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newMemory.trim()) return;
                void onUpdateMemory(bot.id, [...bot.memory, newMemory.trim()]);
                setNewMemory('');
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={newMemory}
                onChange={(e) => setNewMemory(e.target.value)}
                placeholder="Add persistent memory note..."
                className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1.5"
              />
              <button
                type="submit"
                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {tab === 'library' && (
          <div className="space-y-2.5">
            {selectedDoc ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSelectedDoc(null)}
                  className="text-orange-600 dark:text-orange-400 font-medium hover:underline"
                >
                  ← Back to Library
                </button>
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {selectedDoc.filename}
                </div>
                <pre className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 whitespace-pre-wrap font-mono text-[11px] text-zinc-700 dark:text-zinc-300 overflow-x-auto">
                  {selectedDoc.content}
                </pre>
              </div>
            ) : (
              library.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedDoc(item)}
                    className="text-left flex-1 min-w-0"
                  >
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {item.filename}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Saved by {item.botName}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteLibrary(item.id)}
                    className="text-zinc-400 hover:text-red-500 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
