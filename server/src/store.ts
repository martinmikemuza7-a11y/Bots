import { EventEmitter } from 'node:events';
import type {
  ApprovalRequest,
  Bot,
  BotRoutine,
  BotTask,
  ChatMessage,
  ConnectedApp,
  LibraryItem,
  WorkspaceState,
} from './types.js';

export const bus = new EventEmitter();
bus.setMaxListeners(50);

const nowIso = (offsetMinutes = 0) =>
  new Date(Date.now() - offsetMinutes * 60_000).toISOString();

function createSeedBots(): Bot[] {
  return [
    {
      id: 'primary',
      name: 'Hermes Prime',
      role: 'Primary Hermes agent on main screen · Skills, memory & messaging channels',
      isPrimary: true,
      avatarVariant: 0,
      accentColor: '#fd690f',
      status: 'idle',
      engine: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        subscriptionActive: true,
        subscriptionLabel: 'Claude Pro/Max',
      },
      memory: [
        'Primary Hermes gateway running on display :99 — config.yaml preserved.',
        'User prefers concise executive summaries with cited sources.',
        'All Composio write actions require explicit chat card approval.',
      ],
      screen: {
        display: ':99',
        activeApp: 'home',
        url: 'chrome://newtab',
        pageTitle: 'Hermes Prime — Home',
        pageSummary: 'Primary Orgo screen dressed with Bot HQ dock and Chrome new tab home screen.',
        terminalLines: [
          'hermes@orgo-hq:~$ hermes gateway status',
          '● hermes-gateway.service - Hermes Agent Primary (:99)',
          '  MCP server: connected -> /mcp/primary',
          '  CDP browser: http://127.0.0.1:9333 (ready)',
        ],
        takeControl: false,
        lastUpdatedAt: nowIso(4),
      },
      createdAt: nowIso(240),
    },
    {
      id: 'atlas',
      name: 'Atlas',
      role: 'X Research & Competitive Intelligence Analyst',
      isPrimary: false,
      avatarVariant: 1,
      accentColor: '#2563eb',
      status: 'idle',
      engine: {
        provider: 'xai',
        model: 'grok-3',
        subscriptionActive: false,
      },
      memory: [
        'Tracks AI agent frameworks, Hermes releases, and developer sentiment on X.',
        'Saves weekly research briefs into the shared Bot HQ Library.',
      ],
      screen: {
        display: ':100',
        activeApp: 'chrome',
        url: 'https://x.com/search?q=autonomous%20desktop%20agents',
        pageTitle: 'X / Research Feed — autonomous desktop agents',
        pageSummary: 'Tracking top threads on browser-use, MCP tool servers, and multi-agent desktops.',
        terminalLines: [
          'atlas@orgo-hq:~$ hermes status --profile atlas',
          'Gateway listening on :18790 | Display :100 | x_search ready',
        ],
        takeControl: false,
        lastUpdatedAt: nowIso(12),
      },
      createdAt: nowIso(180),
    },
    {
      id: 'nova',
      name: 'Nova',
      role: 'Inbox Triage, GitHub & Team Ops Coordinator',
      isPrimary: false,
      avatarVariant: 2,
      accentColor: '#059669',
      status: 'waiting_approval',
      engine: {
        provider: 'openai',
        model: 'gpt-4o',
        subscriptionActive: true,
        subscriptionLabel: 'ChatGPT Plus',
      },
      memory: [
        'Summarizes morning Gmail threads and drafts Slack updates.',
        'Flags urgent GitHub PR reviews before 10:00 AM.',
      ],
      screen: {
        display: ':101',
        activeApp: 'chrome',
        url: 'https://mail.google.com/mail/u/0/#inbox',
        pageTitle: 'Inbox (3) — Nova Ops Drafts',
        pageSummary: 'Prepared weekly release status email draft; waiting for approval in chat.',
        terminalLines: [
          'nova@orgo-hq:~$ hermes status --profile nova',
          'Gateway listening on :18791 | Display :101 | Waiting on approval #apr-1',
        ],
        takeControl: false,
        lastUpdatedAt: nowIso(2),
      },
      createdAt: nowIso(120),
    },
  ];
}

function createSeedMessages(): Record<string, ChatMessage[]> {
  const approval: ApprovalRequest = {
    id: 'apr-1',
    botId: 'nova',
    messageId: 'msg-nova-2',
    app: 'Gmail',
    action: 'GMAIL_SEND_EMAIL',
    summary: 'Send weekly sprint digest email to engineering@acme.dev',
    payload: {
      To: 'engineering@acme.dev',
      Subject: 'Bot HQ Sprint Digest — Orgo Screens & MCP Tools',
      Preview: '3 bots active on shared Orgo host, X research brief saved to Library, 2 PRs ready for review.',
    },
    status: 'pending',
  };

  return {
    primary: [
      {
        id: 'msg-p-1',
        botId: 'primary',
        role: 'user',
        content: 'Check our active screen setup, ask Atlas for the latest X agent trends, and save a short brief to the Library.',
        createdAt: nowIso(18),
      },
      {
        id: 'msg-p-2',
        botId: 'primary',
        role: 'assistant',
        durationMs: 92_000,
        steps: [
          {
            id: 's1',
            tool: 'screen.inspect',
            label: 'Checked Orgo displays',
            detail: 'Verified displays :99 (Hermes Prime), :100 (Atlas), :101 (Nova)',
            status: 'done',
            durationMs: 14_000,
          },
          {
            id: 's2',
            tool: 'send_to_bot',
            label: 'Messaged Atlas for X research',
            detail: 'Requested top 3 agent workflow signals from Atlas via /mcp/primary',
            status: 'done',
            durationMs: 28_000,
          },
          {
            id: 's3',
            tool: 'x_search',
            label: 'Cross-checked X threads',
            detail: 'Queried "MCP desktop agents" and "Hermes gateway" (14 posts)',
            status: 'done',
            durationMs: 24_000,
          },
          {
            id: 's4',
            tool: 'library.save',
            label: 'Saved brief to Library',
            detail: 'Wrote x-ai-agents-brief.md (1.8 KB)',
            status: 'done',
            durationMs: 26_000,
          },
        ],
        content:
          'All three displays on the Orgo host are healthy, and I coordinated with Atlas to compile the latest X threads.\n\n**Key takeaways:**\n- Teams are converging on **one MCP server per bot profile** so tools stay scoped cleanly.\n- Live desktop viewers with **human takeover** remain the top UX pattern for browser auth and 2FA.\n- Write actions gated by **chat approval cards** prevent accidental sends.\n\nI saved the full summary to the Library as `x-ai-agents-brief.md`.',
        createdAt: nowIso(16),
      },
    ],
    atlas: [
      {
        id: 'msg-a-1',
        botId: 'atlas',
        role: 'user',
        content: 'Scan X for what builders are saying about computer-use agents this week.',
        createdAt: nowIso(35),
      },
      {
        id: 'msg-a-2',
        botId: 'atlas',
        role: 'assistant',
        durationMs: 64_000,
        steps: [
          {
            id: 'as1',
            tool: 'x_search',
            label: 'Searched X posts',
            detail: 'query="computer use agents OR browser agents" lang:en',
            status: 'done',
            durationMs: 29_000,
          },
          {
            id: 'as2',
            tool: 'browser.open',
            label: 'Opened top threads on display :100',
            detail: 'Navigated Chrome to x.com/search?q=autonomous+desktop+agents',
            status: 'done',
            durationMs: 35_000,
          },
        ],
        content:
          'Scanned recent builder discussions on X and opened the live feed on my screen (`:100`).\n\n1. **Shared host, isolated screens** beats spinning up heavy separate VMs for 2–4 bot teams.\n2. **Voice-to-task handoff** is taking off: quick voice check-ins trigger background tool runs with persistent memory.\n3. **Subscription sign-in inside the viewer** lets agents reuse existing Claude/ChatGPT accounts without juggling extra keys.',
        createdAt: nowIso(34),
      },
    ],
    nova: [
      {
        id: 'msg-n-1',
        botId: 'nova',
        role: 'user',
        content: 'Draft our weekly sprint digest and send it to engineering@acme.dev.',
        createdAt: nowIso(3),
      },
      {
        id: 'msg-n-2',
        botId: 'nova',
        role: 'assistant',
        durationMs: 31_000,
        steps: [
          {
            id: 'ns1',
            tool: 'library.list',
            label: 'Read recent Library artifacts',
            detail: 'Included x-ai-agents-brief.md and weekly-inbox-triage.json',
            status: 'done',
            durationMs: 11_000,
          },
          {
            id: 'ns2',
            tool: 'composio.gmail_draft',
            label: 'Prepared Gmail message',
            detail: 'To: engineering@acme.dev · Subject: Bot HQ Sprint Digest',
            status: 'done',
            durationMs: 14_000,
          },
          {
            id: 'ns3',
            tool: 'composio.gmail_send',
            label: 'Awaiting your approval to send email',
            detail: 'Write action paused on Gmail',
            status: 'waiting_approval',
            durationMs: 6_000,
          },
        ],
        content: 'I drafted the sprint digest email from today’s Library notes. Approve the card below when you are ready for me to send it.',
        approval,
        createdAt: nowIso(2),
      },
    ],
  };
}

function createSeedApps(): ConnectedApp[] {
  return [
    {
      slug: 'gmail',
      name: 'Gmail',
      category: 'Communication',
      connected: true,
      accountLabel: 'ops@acme.dev',
      writeActionsRequireApproval: true,
      capabilities: ['Read threads', 'Search inbox', 'Send email (approval)'],
    },
    {
      slug: 'x',
      name: 'X (Twitter)',
      category: 'Social & Research',
      connected: true,
      accountLabel: '@acme_builders',
      writeActionsRequireApproval: true,
      capabilities: ['x_search live research', 'Read timelines', 'Post update (approval)'],
    },
    {
      slug: 'github',
      name: 'GitHub',
      category: 'Engineering',
      connected: true,
      accountLabel: 'acme-labs',
      writeActionsRequireApproval: true,
      capabilities: ['List PRs & issues', 'Read diffs', 'Create issue / comment (approval)'],
    },
    {
      slug: 'slack',
      name: 'Slack',
      category: 'Communication',
      connected: true,
      accountLabel: '#bot-hq',
      writeActionsRequireApproval: true,
      capabilities: ['Read channels', 'Post message (approval)'],
    },
    {
      slug: 'notion',
      name: 'Notion',
      category: 'Knowledge',
      connected: false,
      writeActionsRequireApproval: true,
      capabilities: ['Search pages', 'Create doc (approval)'],
    },
    {
      slug: 'gcal',
      name: 'Google Calendar',
      category: 'Scheduling',
      connected: false,
      writeActionsRequireApproval: true,
      capabilities: ['Read agenda', 'Book meeting (approval)'],
    },
  ];
}

function createSeedTasks(): BotTask[] {
  return [
    {
      id: 'task-1',
      botId: 'primary',
      title: 'Verify MCP server bindings across all active bot displays',
      done: true,
      createdAt: nowIso(90),
    },
    {
      id: 'task-2',
      botId: 'primary',
      title: 'Publish daily executive summary to Library before 5 PM',
      done: false,
      createdAt: nowIso(25),
    },
    {
      id: 'task-3',
      botId: 'atlas',
      title: 'Track Hermes Agent & Orgo computer discussions on X',
      done: false,
      createdAt: nowIso(40),
    },
    {
      id: 'task-4',
      botId: 'nova',
      title: 'Send weekly sprint digest email once approved',
      done: false,
      createdAt: nowIso(5),
    },
  ];
}

function createSeedRoutines(): BotRoutine[] {
  return [
    {
      id: 'rtn-1',
      botId: 'atlas',
      name: 'Morning X Signal Sweep',
      schedule: 'Every day at 08:30',
      prompt: 'Run x_search for AI agent UX and MCP server patterns, then save a concise brief to the Library.',
      enabled: true,
      lastRunAt: nowIso(120),
    },
    {
      id: 'rtn-2',
      botId: 'nova',
      name: 'Inbox & PR Triage',
      schedule: 'Weekdays at 09:15',
      prompt: 'Check unread Gmail threads and open GitHub PRs, then prepare a digest draft for approval.',
      enabled: true,
      lastRunAt: nowIso(65),
    },
    {
      id: 'rtn-3',
      botId: 'primary',
      name: 'End-of-Day Team Rollup',
      schedule: 'Every day at 17:30',
      prompt: 'Ask Atlas and Nova for today’s highlights via send_to_bot and save an overview to the Library.',
      enabled: false,
    },
  ];
}

function createSeedLibrary(): LibraryItem[] {
  return [
    {
      id: 'lib-1',
      botId: 'primary',
      botName: 'Hermes Prime',
      title: 'X AI Agents Brief',
      filename: 'x-ai-agents-brief.md',
      mimeType: 'text/markdown',
      content: `# X AI Agents Brief\n\nCompiled by **Hermes Prime** with input from **Atlas**.\n\n## Highlights\n- **Per-bot screens on one host**: Keeps latency low and makes human takeover instant.\n- **Scoped MCP endpoints**: Each bot exposes \`/mcp/<bot>\` with tasks, routines, Library, and \`send_to_bot\`.\n- **Write-action gating**: Composio read actions run automatically; send/post/delete actions pause for an approval card in chat.\n`,
      createdAt: nowIso(16),
    },
    {
      id: 'lib-2',
      botId: 'nova',
      botName: 'Nova',
      title: 'Weekly Inbox Triage',
      filename: 'weekly-inbox-triage.json',
      mimeType: 'application/json',
      content: JSON.stringify(
        {
          generatedBy: 'Nova',
          urgentThreads: 2,
          openPullRequests: 3,
          draftReady: true,
          recipient: 'engineering@acme.dev',
        },
        null,
        2,
      ),
      createdAt: nowIso(8),
    },
  ];
}

class MemoryStore {
  state: WorkspaceState;

  constructor() {
    this.state = this.buildInitialState();
  }

  private buildInitialState(): WorkspaceState {
    const allowedEmails = (process.env.ALLOWED_EMAILS || '').trim();
    const devLoginEnabled = process.env.DEV_LOGIN === '1' || !allowedEmails;
    const maxBots = Math.min(4, Math.max(1, Number(process.env.MAX_BOTS) || 4));

    return {
      session: {
        authenticated: true,
        email: allowedEmails ? allowedEmails.split(',')[0].trim() : 'operator@bot-hq.local',
        devLoginEnabled,
      },
      config: {
        maxBots,
        hasOrgo: Boolean(process.env.ORGO_API_KEY && process.env.ORGO_COMPUTER_ID),
        hasComposio: Boolean(process.env.COMPOSIO_API_KEY),
        hasXai: Boolean(process.env.XAI_API_KEY),
        hasHermes: Boolean(process.env.HERMES_URL || process.env.HERMES_BIN),
      },
      bots: createSeedBots(),
      messages: createSeedMessages(),
      apps: createSeedApps(),
      tasks: createSeedTasks(),
      routines: createSeedRoutines(),
      library: createSeedLibrary(),
    };
  }

  resetFixtures() {
    this.state = this.buildInitialState();
    this.emitUpdate('state:reset');
  }

  emitUpdate(event = 'state:update', payload?: unknown) {
    bus.emit('update', { event, payload, timestamp: Date.now() });
  }

  getBot(botId: string): Bot | undefined {
    return this.state.bots.find((b) => b.id === botId);
  }
}

export const store = new MemoryStore();
