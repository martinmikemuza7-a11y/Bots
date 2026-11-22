import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { resolveApproval, runBotTurn } from './agent.js';
import { bus, store } from './store.js';
import type { Bot, BotEngine, ScreenApp } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const webDir = path.join(rootDir, 'web');
const webDistDir = path.join(webDir, 'dist');

const app = express();
app.use(express.json({ limit: '2mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'bot-hq',
    bots: store.state.bots.length,
    config: store.state.config,
  });
});

// Full workspace state
app.get('/api/state', (_req, res) => {
  res.json(store.state);
});

// Server-Sent Events for live updates
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(`data: ${JSON.stringify({ event: 'connected', timestamp: Date.now() })}\n\n`);

  const onUpdate = (payload: unknown) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  bus.on('update', onUpdate);

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 20_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    bus.off('update', onUpdate);
  });
});

// Auth / Dev login
app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email || '').trim();
  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }
  const allowed = (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length > 0 && !allowed.includes(email.toLowerCase())) {
    res.status(403).json({ error: 'Email is not in ALLOWED_EMAILS' });
    return;
  }
  store.state.session.authenticated = true;
  store.state.session.email = email;
  store.emitUpdate('session:updated');
  res.json(store.state.session);
});

app.post('/api/auth/logout', (_req, res) => {
  store.state.session.authenticated = false;
  store.emitUpdate('session:updated');
  res.json(store.state.session);
});

// Fixtures reset
app.post('/api/fixtures/reset', (_req, res) => {
  store.resetFixtures();
  res.json(store.state);
});

// Bots CRUD
app.post('/api/bots', (req, res) => {
  if (store.state.bots.length >= store.state.config.maxBots) {
    res.status(400).json({ error: `Orgo screen limit reached (max ${store.state.config.maxBots} bots)` });
    return;
  }
  const name = String(req.body?.name || '').trim() || `Bot ${store.state.bots.length + 1}`;
  const role = String(req.body?.role || '').trim() || 'Generalist Hermes Agent';
  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20) || crypto.randomUUID().slice(0, 6);

  const uniqueId = store.getBot(id) ? `${id}-${crypto.randomUUID().slice(0, 4)}` : id;
  const usedDisplays = new Set(store.state.bots.map((b) => b.screen.display));
  const nextDisplay = [':99', ':100', ':101', ':102'].find((d) => !usedDisplays.has(d)) || ':102';
  const accents = ['#fd690f', '#2563eb', '#059669', '#7c3aed'];

  const bot: Bot = {
    id: uniqueId,
    name,
    role,
    isPrimary: false,
    avatarVariant: store.state.bots.length % 4,
    accentColor: accents[store.state.bots.length % accents.length],
    status: 'idle',
    engine: {
      provider: req.body?.provider || 'anthropic',
      model: req.body?.model || 'claude-sonnet-4-5',
      subscriptionActive: false,
    },
    memory: [`Initialized Hermes home for ${name} on Orgo display ${nextDisplay}.`],
    screen: {
      display: nextDisplay,
      activeApp: 'home',
      url: 'chrome://newtab',
      pageTitle: `${name} — Home`,
      pageSummary: `Fresh Orgo desktop dressed for ${name}.`,
      terminalLines: [
        `${uniqueId}@orgo-hq:~$ hermes gateway start --display ${nextDisplay}`,
        `Gateway listening | MCP endpoint /mcp/${uniqueId} ready`,
      ],
      takeControl: false,
      lastUpdatedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  };

  store.state.bots.push(bot);
  store.state.messages[uniqueId] = [
    {
      id: `msg-welcome-${uniqueId}`,
      botId: uniqueId,
      role: 'assistant',
      content: `Hi! I’m **${name}** on display \`${nextDisplay}\`. Give me a task, connect apps, or open my live screen on the right.`,
      createdAt: new Date().toISOString(),
    },
  ];
  store.emitUpdate('bot:created', { botId: uniqueId });
  res.status(201).json(bot);
});

app.patch('/api/bots/:id', (req, res) => {
  const bot = store.getBot(req.params.id);
  if (!bot) {
    res.status(404).json({ error: 'Bot not found' });
    return;
  }
  if (typeof req.body?.name === 'string' && req.body.name.trim()) {
    bot.name = req.body.name.trim();
  }
  if (typeof req.body?.role === 'string') {
    bot.role = req.body.role.trim();
  }
  if (req.body?.engine) {
    const nextEngine = req.body.engine as Partial<BotEngine>;
    bot.engine = { ...bot.engine, ...nextEngine };
  }
  if (Array.isArray(req.body?.memory)) {
    bot.memory = req.body.memory.map(String);
  }
  store.emitUpdate('bot:updated', { botId: bot.id });
  res.json(bot);
});

app.delete('/api/bots/:id', (req, res) => {
  const bot = store.getBot(req.params.id);
  if (!bot) {
    res.status(404).json({ error: 'Bot not found' });
    return;
  }
  if (bot.isPrimary) {
    res.status(400).json({ error: 'Primary Hermes agent cannot be deleted' });
    return;
  }
  store.state.bots = store.state.bots.filter((b) => b.id !== bot.id);
  delete store.state.messages[bot.id];
  store.state.tasks = store.state.tasks.filter((t) => t.botId !== bot.id);
  store.state.routines = store.state.routines.filter((r) => r.botId !== bot.id);
  store.emitUpdate('bot:deleted', { botId: bot.id });
  res.json({ ok: true });
});

// Chat turn
app.post('/api/bots/:id/chat', (req, res) => {
  const bot = store.getBot(req.params.id);
  if (!bot) {
    res.status(404).json({ error: 'Bot not found' });
    return;
  }
  const prompt = String(req.body?.prompt || '').trim();
  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }
  void runBotTurn(bot.id, prompt);
  res.status(202).json({ ok: true });
});

// Screen interaction & Take Control
app.post('/api/bots/:id/screen/interact', (req, res) => {
  const bot = store.getBot(req.params.id);
  if (!bot) {
    res.status(404).json({ error: 'Bot not found' });
    return;
  }
  const { activeApp, url, command, takeControl } = req.body as {
    activeApp?: ScreenApp;
    url?: string;
    command?: string;
    takeControl?: boolean;
  };

  if (typeof takeControl === 'boolean') {
    bot.screen.takeControl = takeControl;
  }
  if (activeApp) {
    bot.screen.activeApp = activeApp;
  }
  if (typeof url === 'string' && url.trim()) {
    const cleanUrl = url.startsWith('http') || url.startsWith('chrome://') ? url : `https://${url}`;
    bot.screen.activeApp = 'chrome';
    bot.screen.url = cleanUrl;
    bot.screen.pageTitle =
      cleanUrl === 'chrome://newtab' ? `${bot.name} — Home` : `Browser — ${cleanUrl.replace(/^https?:\/\//, '')}`;
    bot.screen.pageSummary = `Live browser viewport on display ${bot.screen.display} viewing ${cleanUrl}`;
  }
  if (typeof command === 'string' && command.trim()) {
    bot.screen.activeApp = 'terminal';
    bot.screen.terminalLines.push(`${bot.id}@orgo-hq:~$ ${command.trim()}`);
    if (command.includes('status')) {
      bot.screen.terminalLines.push(`● ${bot.name} gateway active on ${bot.screen.display} (${bot.engine.model})`);
    } else if (command.includes('ls')) {
      bot.screen.terminalLines.push('config.yaml  memory.md  skills/  workspace/');
    } else {
      bot.screen.terminalLines.push(`[ok] executed in Hermes shell (${bot.screen.display})`);
    }
    if (bot.screen.terminalLines.length > 18) {
      bot.screen.terminalLines = bot.screen.terminalLines.slice(-18);
    }
  }
  bot.screen.lastUpdatedAt = new Date().toISOString();
  store.emitUpdate('screen:updated', { botId: bot.id });
  res.json(bot.screen);
});

// Subscription login flow on bot screen
app.post('/api/bots/:id/subscription-login', (req, res) => {
  const bot = store.getBot(req.params.id);
  if (!bot) {
    res.status(404).json({ error: 'Bot not found' });
    return;
  }
  const labelMap: Record<BotEngine['provider'], string> = {
    anthropic: 'Claude Pro/Max',
    openai: 'ChatGPT Plus',
    xai: 'SuperGrok',
    google: 'Google AI Pro',
  };
  bot.screen.activeApp = 'terminal';
  bot.screen.takeControl = true;
  bot.screen.terminalLines.push(
    `${bot.id}@orgo-hq:~$ hermes auth login --provider ${bot.engine.provider}`,
    `Opening ${labelMap[bot.engine.provider]} browser OAuth flow on ${bot.screen.display}...`,
    `✓ Subscription linked: ${labelMap[bot.engine.provider]} active for ${bot.name}`,
  );
  bot.engine.subscriptionActive = true;
  bot.engine.subscriptionLabel = labelMap[bot.engine.provider];
  bot.screen.lastUpdatedAt = new Date().toISOString();
  store.emitUpdate('bot:updated', { botId: bot.id });
  res.json(bot);
});

// Approval resolution
app.post('/api/approvals/:id/resolve', (req, res) => {
  const decision = req.body?.decision === 'approved' ? 'approved' : 'rejected';
  const ok = resolveApproval(req.params.id, decision);
  if (!ok) {
    res.status(404).json({ error: 'Pending approval not found' });
    return;
  }
  res.json({ ok: true, decision });
});

// Composio connected apps
app.post('/api/apps/:slug/toggle', (req, res) => {
  const target = store.state.apps.find((a) => a.slug === req.params.slug);
  if (!target) {
    res.status(404).json({ error: 'App not found' });
    return;
  }
  target.connected = !target.connected;
  if (target.connected && !target.accountLabel) {
    target.accountLabel = `connected@${target.slug}`;
  }
  store.emitUpdate('apps:updated');
  res.json(target);
});

// Tasks
app.post('/api/bots/:id/tasks', (req, res) => {
  const bot = store.getBot(req.params.id);
  if (!bot) {
    res.status(404).json({ error: 'Bot not found' });
    return;
  }
  const title = String(req.body?.title || '').trim();
  if (!title) {
    res.status(400).json({ error: 'Task title is required' });
    return;
  }
  const task = {
    id: `task-${crypto.randomUUID().slice(0, 8)}`,
    botId: bot.id,
    title,
    done: false,
    createdAt: new Date().toISOString(),
  };
  store.state.tasks.unshift(task);
  store.emitUpdate('tasks:updated');
  res.status(201).json(task);
});

app.patch('/api/tasks/:id', (req, res) => {
  const task = store.state.tasks.find((t) => t.id === req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  if (typeof req.body?.done === 'boolean') task.done = req.body.done;
  if (typeof req.body?.title === 'string' && req.body.title.trim()) task.title = req.body.title.trim();
  store.emitUpdate('tasks:updated');
  res.json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
  store.state.tasks = store.state.tasks.filter((t) => t.id !== req.params.id);
  store.emitUpdate('tasks:updated');
  res.json({ ok: true });
});

// Routines
app.post('/api/bots/:id/routines', (req, res) => {
  const bot = store.getBot(req.params.id);
  if (!bot) {
    res.status(404).json({ error: 'Bot not found' });
    return;
  }
  const name = String(req.body?.name || '').trim();
  const schedule = String(req.body?.schedule || '').trim() || 'Every day at 09:00';
  const prompt = String(req.body?.prompt || '').trim();
  if (!name || !prompt) {
    res.status(400).json({ error: 'Routine name and prompt are required' });
    return;
  }
  const routine = {
    id: `rtn-${crypto.randomUUID().slice(0, 8)}`,
    botId: bot.id,
    name,
    schedule,
    prompt,
    enabled: true,
  };
  store.state.routines.unshift(routine);
  store.emitUpdate('routines:updated');
  res.status(201).json(routine);
});

app.patch('/api/routines/:id', (req, res) => {
  const routine = store.state.routines.find((r) => r.id === req.params.id);
  if (!routine) {
    res.status(404).json({ error: 'Routine not found' });
    return;
  }
  if (typeof req.body?.enabled === 'boolean') routine.enabled = req.body.enabled;
  store.emitUpdate('routines:updated');
  res.json(routine);
});

app.post('/api/routines/:id/run', (req, res) => {
  const routine = store.state.routines.find((r) => r.id === req.params.id);
  if (!routine) {
    res.status(404).json({ error: 'Routine not found' });
    return;
  }
  routine.lastRunAt = new Date().toISOString();
  void runBotTurn(routine.botId, `[Routine: ${routine.name}] ${routine.prompt}`);
  store.emitUpdate('routines:updated');
  res.json(routine);
});

app.delete('/api/routines/:id', (req, res) => {
  store.state.routines = store.state.routines.filter((r) => r.id !== req.params.id);
  store.emitUpdate('routines:updated');
  res.json({ ok: true });
});

// Library
app.delete('/api/library/:id', (req, res) => {
  store.state.library = store.state.library.filter((l) => l.id !== req.params.id);
  store.emitUpdate('library:updated');
  res.json({ ok: true });
});

// Voice handoff
app.post('/api/voice/turn', (req, res) => {
  const botId = String(req.body?.botId || 'primary');
  const transcript = String(req.body?.transcript || '').trim();
  const bot = store.getBot(botId);
  if (!bot || !transcript) {
    res.status(400).json({ error: 'Valid botId and transcript required' });
    return;
  }
  const lower = transcript.toLowerCase();
  const needsRealWork =
    /\b(search|check|send|email|save|create|open|report|task|routine|ask)\b/.test(lower);
  if (needsRealWork) {
    void runBotTurn(bot.id, transcript);
    res.json({
      spokenReply: `On it — I’ve queued that work in ${bot.name}’s chat and am updating the screen now.`,
      handedToChat: true,
    });
    return;
  }
  res.json({
    spokenReply: `${bot.name} here on display ${bot.screen.display}. I’m ${bot.status.replace('_', ' ')} and ready whenever you want to run a task.`,
    handedToChat: false,
  });
});

// MCP endpoint per bot (as documented in README)
app.get('/mcp/:botId', (req, res) => {
  const bot = store.getBot(req.params.botId);
  if (!bot) {
    res.status(404).json({ error: 'Bot not found' });
    return;
  }
  const connectedApps = store.state.apps.filter((a) => a.connected).map((a) => a.slug);
  res.json({
    server: `bot-hq-mcp/${bot.id}`,
    bot: bot.name,
    display: bot.screen.display,
    tools: [
      'x_search',
      'send_to_bot',
      'tasks_list',
      'tasks_create',
      'routines_list',
      'library_save',
      ...connectedApps.map((slug) => `composio_${slug}`),
    ],
  });
});

async function start() {
  const port = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      root: webDir,
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(webDistDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(webDistDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[Bot HQ] Server listening on http://0.0.0.0:${port} (${isProd ? 'prod' : 'dev'})`);
  });
}

start().catch((err) => {
  console.error('[Bot HQ] Fatal startup error:', err);
  process.exit(1);
});
