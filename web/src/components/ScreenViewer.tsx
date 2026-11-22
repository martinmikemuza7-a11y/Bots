import React, { useEffect, useState } from 'react';
import {
  FolderOpen,
  Globe,
  Home,
  Maximize2,
  Minimize2,
  MousePointerClick,
  RefreshCw,
  Terminal as TerminalIcon,
} from 'lucide-react';
import type { Bot, ConnectedApp, LibraryItem, ScreenApp } from '../types';

interface ScreenViewerProps {
  bot: Bot;
  apps: ConnectedApp[];
  library: LibraryItem[];
  onInteract: (payload: {
    activeApp?: ScreenApp;
    url?: string;
    command?: string;
    takeControl?: boolean;
  }) => Promise<void>;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export const ScreenViewer: React.FC<ScreenViewerProps> = ({
  bot,
  apps,
  library,
  onInteract,
  expanded = false,
  onToggleExpand,
}) => {
  const [urlInput, setUrlInput] = useState(bot.screen.url);
  const [cmdInput, setCmdInput] = useState('');
  const [clock, setClock] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  );

  useEffect(() => {
    setUrlInput(bot.screen.url);
  }, [bot.screen.url, bot.id]);

  useEffect(() => {
    const id = setInterval(() => {
      setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 15_000);
    return () => clearInterval(id);
  }, []);

  const connectedApps = apps.filter((a) => a.connected);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    void onInteract({ url: urlInput.trim(), activeApp: 'chrome' });
  };

  const handleCmdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmdInput.trim()) return;
    const next = cmdInput.trim();
    setCmdInput('');
    void onInteract({ command: next, activeApp: 'terminal' });
  };

  return (
    <div className="flex flex-col h-full bg-zinc-100 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
      {/* Screen Header Controls */}
      <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono font-medium text-zinc-700 dark:text-zinc-200">
            <span
              className={`h-2 w-2 rounded-full ${
                bot.status === 'working' ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500'
              }`}
            />
            Display {bot.screen.display}
          </span>
          <span className="text-zinc-400">·</span>
          <span className="text-zinc-500 dark:text-zinc-400 truncate max-w-[140px]">
            {bot.screen.activeApp.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void onInteract({ takeControl: !bot.screen.takeControl })}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-medium transition-colors ${
              bot.screen.takeControl
                ? 'bg-orange-500 text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
            title="Toggle direct mouse & keyboard takeover"
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            <span>{bot.screen.takeControl ? 'Controlling' : 'Take control'}</span>
          </button>

          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              title={expanded ? 'Exit full-size viewer' : 'Open full-size viewer'}
            >
              {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Virtual Orgo Desktop Viewport */}
      <div className="relative flex-1 flex flex-col bg-gradient-to-br from-slate-100 via-zinc-50 to-orange-50/40 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900 overflow-hidden select-none">
        {/* Dressed Linux Top Bar */}
        <div className="flex items-center justify-between px-3 py-1 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-zinc-200/70 dark:border-zinc-800/70 text-[11px] text-zinc-600 dark:text-zinc-300">
          <span className="font-semibold tracking-tight">{bot.name} Desktop</span>
          <span className="font-mono">{clock}</span>
        </div>

        {/* Desktop Content Area */}
        <div className="flex-1 p-3 overflow-y-auto">
          {bot.screen.activeApp === 'home' && (
            <div className="h-full flex flex-col items-center justify-center text-center px-3 py-4">
              <div className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">
                {clock}
              </div>
              <div className="mt-1 text-base font-semibold text-zinc-800 dark:text-zinc-200">
                {bot.name}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mt-0.5 line-clamp-2">
                {bot.role}
              </p>

              <div className="mt-5 grid grid-cols-3 gap-2.5 w-full max-w-xs">
                <button
                  type="button"
                  onClick={() => void onInteract({ activeApp: 'chrome' })}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 hover:border-orange-400 transition-colors shadow-xs"
                >
                  <Globe className="w-5 h-5 text-blue-500" />
                  <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">Chrome</span>
                </button>
                <button
                  type="button"
                  onClick={() => void onInteract({ activeApp: 'terminal' })}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 hover:border-orange-400 transition-colors shadow-xs"
                >
                  <TerminalIcon className="w-5 h-5 text-zinc-800 dark:text-zinc-200" />
                  <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">Terminal</span>
                </button>
                <button
                  type="button"
                  onClick={() => void onInteract({ activeApp: 'files' })}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 hover:border-orange-400 transition-colors shadow-xs"
                >
                  <FolderOpen className="w-5 h-5 text-amber-500" />
                  <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">Library</span>
                </button>

                {connectedApps.slice(0, 3).map((app) => (
                  <button
                    key={app.slug}
                    type="button"
                    onClick={() =>
                      void onInteract({
                        activeApp: 'chrome',
                        url:
                          app.slug === 'x'
                            ? 'https://x.com/home'
                            : app.slug === 'gmail'
                              ? 'https://mail.google.com'
                              : `https://${app.slug}.com`,
                      })
                    }
                    className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-white/75 dark:bg-zinc-900/75 border border-zinc-200/70 dark:border-zinc-800 hover:border-orange-400 transition-colors"
                  >
                    <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                      {app.name}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Connected</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {bot.screen.activeApp === 'chrome' && (
            <div className="h-full flex flex-col rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
              {/* Chrome Address Bar */}
              <form
                onSubmit={handleUrlSubmit}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700"
              >
                <button
                  type="button"
                  onClick={() => void onInteract({ activeApp: 'home', url: 'chrome://newtab' })}
                  className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                  title="Bot Home Screen"
                >
                  <Home className="w-3.5 h-3.5" />
                </button>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1 text-[11px] font-mono text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                <button
                  type="submit"
                  className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                  title="Navigate"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </form>

              {/* Simulated Live Page */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-orange-600 dark:text-orange-400">
                    Chrome · {bot.screen.display}
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {bot.screen.takeControl ? 'Interactive' : 'Live view'}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {bot.screen.pageTitle}
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {bot.screen.pageSummary}
                </p>

                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3 space-y-2">
                  <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    Active Session Context
                  </div>
                  <div className="text-xs text-zinc-700 dark:text-zinc-300 font-mono break-all">
                    URL: {bot.screen.url}
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                    Engine: {bot.engine.provider} / {bot.engine.model}
                    {bot.engine.subscriptionActive ? ` (${bot.engine.subscriptionLabel})` : ''}
                  </div>
                </div>
              </div>
            </div>
          )}

          {bot.screen.activeApp === 'terminal' && (
            <div className="h-full flex flex-col rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100 font-mono text-[11px] overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-zinc-400">
                <span>hermes-shell ({bot.screen.display})</span>
                <span>zsh</span>
              </div>
              <div className="flex-1 p-3 overflow-y-auto space-y-1">
                {bot.screen.terminalLines.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap break-all leading-relaxed text-emerald-300/90">
                    {line}
                  </div>
                ))}
              </div>
              <form
                onSubmit={handleCmdSubmit}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-t border-zinc-800"
              >
                <span className="text-orange-400">$</span>
                <input
                  type="text"
                  value={cmdInput}
                  onChange={(e) => setCmdInput(e.target.value)}
                  placeholder="Type a shell command (e.g. status, ls)..."
                  className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-500 focus:outline-none"
                />
              </form>
            </div>
          )}

          {bot.screen.activeApp === 'files' && (
            <div className="h-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 overflow-y-auto">
              <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                Shared Bot HQ Library
              </div>
              <div className="space-y-2">
                {library.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
                  >
                    <div className="flex items-center justify-between text-xs font-medium text-zinc-900 dark:text-zinc-100">
                      <span>{item.filename}</span>
                      <span className="text-[11px] text-zinc-400">{item.botName}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 font-mono">
                      {item.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dressed Desktop Dock */}
        <div className="flex justify-center pb-2.5 pt-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-white/85 dark:bg-zinc-900/85 backdrop-blur border border-zinc-200 dark:border-zinc-800 shadow-sm">
            {(
              [
                { id: 'home', icon: Home, label: 'Home' },
                { id: 'chrome', icon: Globe, label: 'Chrome' },
                { id: 'terminal', icon: TerminalIcon, label: 'Terminal' },
                { id: 'files', icon: FolderOpen, label: 'Files' },
              ] as const
            ).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => void onInteract({ activeApp: id })}
                title={label}
                className={`p-1.5 rounded-xl transition-colors ${
                  bot.screen.activeApp === id
                    ? 'bg-orange-500 text-white'
                    : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
