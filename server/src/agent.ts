import crypto from 'node:crypto';
import { store } from './store.js';
import type { ApprovalRequest, Bot, ChatMessage, ToolStep } from './types.js';

const uid = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const pendingApprovals = new Map<
  string,
  {
    botId: string;
    messageId: string;
    stepId: string;
    app: string;
    action: string;
    summary: string;
    resolve: (decision: 'approved' | 'rejected') => void;
  }
>();

// Seed resolver for the pre-populated approval card so clicking Approve/Reject works immediately
pendingApprovals.set('apr-1', {
  botId: 'nova',
  messageId: 'msg-nova-2',
  stepId: 'ns3',
  app: 'Gmail',
  action: 'GMAIL_SEND_EMAIL',
  summary: 'Send weekly sprint digest email to engineering@acme.dev',
  resolve: () => {},
});

function detectIntent(prompt: string) {
  const lower = prompt.toLowerCase();
  return {
    wantsWriteAction:
      /\b(send|email|post|tweet|publish|delete|remove|slack|issue|comment|book|schedule meeting)\b/.test(
        lower,
      ),
    wantsXSearch: /\b(x|twitter|trend|research|search|news|posts|threads)\b/.test(lower),
    wantsLibrary: /\b(save|write|report|brief|doc|file|library|export|markdown|notes)\b/.test(
      lower,
    ),
    wantsCrossBot: /\b(ask|tell|message|coordinate|hermes|atlas|nova|other bot)\b/.test(lower),
    wantsTask: /\b(task|todo|remind|checklist)\b/.test(lower),
    wantsBrowser: /\b(open|browse|visit|site|url|chrome|screen|web)\b/.test(lower),
  };
}

function pickTargetApp(prompt: string): { app: string; action: string; payload: Record<string, string> } {
  const lower = prompt.toLowerCase();
  if (lower.includes('slack')) {
    return {
      app: 'Slack',
      action: 'SLACK_POST_MESSAGE',
      payload: { Channel: '#bot-hq', Message: prompt.slice(0, 140) },
    };
  }
  if (lower.includes('github') || lower.includes('issue')) {
    return {
      app: 'GitHub',
      action: 'GITHUB_CREATE_ISSUE',
      payload: { Repository: 'acme-labs/bot-hq', Title: prompt.slice(0, 80) },
    };
  }
  if (lower.includes('tweet') || lower.includes('post') || lower.includes(' x ')) {
    return {
      app: 'X (Twitter)',
      action: 'X_CREATE_POST',
      payload: { Account: '@acme_builders', Text: prompt.slice(0, 140) },
    };
  }
  return {
    app: 'Gmail',
    action: 'GMAIL_SEND_EMAIL',
    payload: {
      To: 'team@acme.dev',
      Subject: `Bot HQ Update: ${prompt.slice(0, 48)}`,
      Body: `Prepared automatically in response to: "${prompt.slice(0, 120)}"`,
    },
  };
}

async function tryExternalHermesOrXai(bot: Bot, prompt: string): Promise<string | null> {
  // Optional passthrough when real environment keys are provided
  if (process.env.HERMES_URL) {
    try {
      const res = await fetch(`${process.env.HERMES_URL.replace(/\/$/, '')}/v1/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: bot.engine.model, input: prompt }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = (await res.json()) as { output_text?: string };
        if (data.output_text) return data.output_text;
      }
    } catch {
      // Fall back to local simulation if gateway unreachable
    }
  }

  if (process.env.XAI_API_KEY && bot.engine.provider === 'xai') {
    try {
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.XAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.XAI_MODEL || bot.engine.model || 'grok-3',
          messages: [
            { role: 'system', content: `You are ${bot.name}, ${bot.role}. Keep replies crisp and actionable.` },
            { role: 'user', content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = data.choices?.[0]?.message?.content;
        if (text) return text;
      }
    } catch {
      // Fall back gracefully
    }
  }
  return null;
}

export async function runBotTurn(botId: string, prompt: string): Promise<void> {
  const bot = store.getBot(botId);
  if (!bot) return;

  const userMsg: ChatMessage = {
    id: uid('msg'),
    botId,
    role: 'user',
    content: prompt,
    createdAt: new Date().toISOString(),
  };

  if (!store.state.messages[botId]) store.state.messages[botId] = [];
  store.state.messages[botId].push(userMsg);

  const startedAt = Date.now();
  bot.status = 'working';
  bot.workingSince = startedAt;
  bot.currentAction = 'Thinking & planning tools...';

  const assistantMsg: ChatMessage = {
    id: uid('msg'),
    botId,
    role: 'assistant',
    content: '',
    createdAt: new Date().toISOString(),
    steps: [],
    isStreaming: true,
  };
  store.state.messages[botId].push(assistantMsg);
  store.emitUpdate('chat:updated', { botId });

  const intent = detectIntent(prompt);
  const steps = assistantMsg.steps!;

  const pushStep = async (step: Omit<ToolStep, 'id' | 'durationMs'>, delayMs = 650) => {
    const t0 = Date.now();
    const s: ToolStep = { ...step, id: uid('step'), durationMs: 0 };
    steps.push(s);
    bot.currentAction = step.label;
    store.emitUpdate('chat:updated', { botId });
    await sleep(delayMs);
    if (s.status === 'running') s.status = 'done';
    s.durationMs = Math.max(400, Date.now() - t0);
    store.emitUpdate('chat:updated', { botId });
  };

  // Step 1: Context & memory recall
  await pushStep(
    {
      tool: 'memory.recall',
      label: `Loaded ${bot.name} memory & MCP tools`,
      detail: `Engine: ${bot.engine.provider}/${bot.engine.model} · Display ${bot.screen.display}`,
      status: 'running',
    },
    550,
  );

  // Step 2: Optional X search
  if (intent.wantsXSearch) {
    bot.screen.activeApp = 'chrome';
    bot.screen.url = `https://x.com/search?q=${encodeURIComponent(prompt.slice(0, 48))}`;
    bot.screen.pageTitle = `X Search — ${prompt.slice(0, 40)}`;
    bot.screen.pageSummary = `Live x_search results for "${prompt.slice(0, 60)}" on display ${bot.screen.display}.`;
    bot.screen.lastUpdatedAt = new Date().toISOString();
    await pushStep(
      {
        tool: 'x_search',
        label: 'Searched live posts on X',
        detail: `query="${prompt.slice(0, 56)}" · 12 relevant posts ranked`,
        status: 'running',
      },
      750,
    );
  } else if (intent.wantsBrowser) {
    bot.screen.activeApp = 'chrome';
    bot.screen.url = 'https://docs.composio.dev/introduction';
    bot.screen.pageTitle = `${bot.name} Browser — Active Session`;
    bot.screen.pageSummary = `Inspecting web context for: "${prompt.slice(0, 72)}"`;
    bot.screen.lastUpdatedAt = new Date().toISOString();
    await pushStep(
      {
        tool: 'browser.navigate',
        label: `Updated Chrome on display ${bot.screen.display}`,
        detail: bot.screen.url,
        status: 'running',
      },
      650,
    );
  }

  // Step 3: Cross-bot coordination
  let crossBotNote = '';
  if (intent.wantsCrossBot) {
    const peer = store.state.bots.find((b) => b.id !== bot.id);
    if (peer) {
      await pushStep(
        {
          tool: 'send_to_bot',
          label: `Consulted ${peer.name} (${peer.screen.display})`,
          detail: `Sent coordination note via /mcp/${bot.id}`,
          status: 'running',
        },
        650,
      );
      if (!store.state.messages[peer.id]) store.state.messages[peer.id] = [];
      store.state.messages[peer.id].push({
        id: uid('msg'),
        botId: peer.id,
        role: 'system',
        content: `Message from **${bot.name}**: "${prompt.slice(0, 120)}"`,
        createdAt: new Date().toISOString(),
      });
      crossBotNote = `\n- Coordinated with **${peer.name}** on display \`${peer.screen.display}\`.`;
    }
  }

  // Step 4: Task creation
  if (intent.wantsTask) {
    const newTask = {
      id: uid('task'),
      botId,
      title: prompt.replace(/^(add task|create task|remind me to)\s*/i, '').slice(0, 90),
      done: false,
      createdAt: new Date().toISOString(),
    };
    store.state.tasks.unshift(newTask);
    await pushStep(
      {
        tool: 'tasks.create',
        label: 'Added item to bot task list',
        detail: newTask.title,
        status: 'running',
      },
      500,
    );
  }

  // Step 5: Library save
  let savedFileName = '';
  if (intent.wantsLibrary) {
    const slug = prompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 28) || 'bot-note';
    savedFileName = `${slug}.md`;
    store.state.library.unshift({
      id: uid('lib'),
      botId,
      botName: bot.name,
      title: prompt.slice(0, 48),
      filename: savedFileName,
      mimeType: 'text/markdown',
      content: `# ${prompt.slice(0, 64)}\n\nGenerated by **${bot.name}** (${bot.engine.provider}/${bot.engine.model}) on ${new Date().toUTCString()}.\n\n## Notes\n- Request: ${prompt}\n- Display: \`${bot.screen.display}\`\n- Status: Completed\n`,
      createdAt: new Date().toISOString(),
    });
    bot.screen.activeApp = 'files';
    bot.screen.lastUpdatedAt = new Date().toISOString();
    await pushStep(
      {
        tool: 'library.save',
        label: `Saved ${savedFileName} to Library`,
        detail: 'Available in Library tab',
        status: 'running',
      },
      600,
    );
  }

  // Step 6: Write action approval gating
  let approvalOutcome: 'approved' | 'rejected' | null = null;
  if (intent.wantsWriteAction) {
    const target = pickTargetApp(prompt);
    const approvalId = uid('apr');
    const stepId = uid('step');

    const approval: ApprovalRequest = {
      id: approvalId,
      botId,
      messageId: assistantMsg.id,
      app: target.app,
      action: target.action,
      summary: `${target.app}: ${prompt.slice(0, 96)}`,
      payload: target.payload,
      status: 'pending',
    };

    steps.push({
      id: stepId,
      tool: `composio.${target.action.toLowerCase()}`,
      label: `Waiting for approval on ${target.app}`,
      detail: `${target.action} paused until you approve or reject`,
      status: 'waiting_approval',
      durationMs: 0,
    });

    assistantMsg.approval = approval;
    assistantMsg.content = `I prepared the **${target.app}** write action. Review the details below and click **Approve** to execute it on my connected account.`;
    bot.status = 'waiting_approval';
    bot.currentAction = `Waiting on ${target.app} approval`;
    store.emitUpdate('chat:updated', { botId });

    approvalOutcome = await new Promise<'approved' | 'rejected'>((resolve) => {
      pendingApprovals.set(approvalId, {
        botId,
        messageId: assistantMsg.id,
        stepId,
        app: target.app,
        action: target.action,
        summary: approval.summary,
        resolve,
      });
    });

    bot.status = 'working';
    bot.currentAction =
      approvalOutcome === 'approved' ? `Executing ${target.app} action...` : 'Action cancelled';
    store.emitUpdate('chat:updated', { botId });
    await sleep(450);
  }

  // Final response synthesis
  const externalReply = await tryExternalHermesOrXai(bot, prompt);
  if (externalReply) {
    assistantMsg.content = externalReply;
  } else if (approvalOutcome === 'rejected') {
    assistantMsg.content =
      'Got it — I cancelled that write action and left your connected account untouched.';
  } else if (approvalOutcome === 'approved') {
    assistantMsg.content = `Approved and executed! Completed **${assistantMsg.approval?.action}** via Composio.${
      savedFileName ? ` Also saved \`${savedFileName}\` to the Library.` : ''
    }${crossBotNote}`;
  } else {
    const summaryBits: string[] = [];
    if (intent.wantsXSearch) {
      summaryBits.push(
        `I ran \`x_search\` and updated my live Chrome feed on display \`${bot.screen.display}\` with the latest posts.`,
      );
    }
    if (savedFileName) {
      summaryBits.push(`Saved \`${savedFileName}\` to the shared **Library**.`);
    }
    if (intent.wantsTask) {
      summaryBits.push('Added the item to my **Tasks** list.');
    }
    if (!summaryBits.length) {
      summaryBits.push(
        `Done on **${bot.name}** (\`${bot.screen.display}\` · \`${bot.engine.provider}/${bot.engine.model}\`).`,
      );
      summaryBits.push(
        `Processed: "${prompt}". You can ask me to search X, save a brief to the Library, manage tasks, or run a Composio write action with approval.`,
      );
    }
    assistantMsg.content = `${summaryBits.join('\n\n')}${crossBotNote}`;
  }

  assistantMsg.isStreaming = false;
  assistantMsg.durationMs = Math.max(1200, Date.now() - startedAt);
  bot.status = 'idle';
  bot.workingSince = undefined;
  bot.currentAction = undefined;
  bot.screen.lastUpdatedAt = new Date().toISOString();
  store.emitUpdate('chat:updated', { botId });
}

export function resolveApproval(approvalId: string, decision: 'approved' | 'rejected'): boolean {
  const entry = pendingApprovals.get(approvalId);
  const msgs = entry ? store.state.messages[entry.botId] : undefined;

  // Locate message even if seeded
  let targetMsg: ChatMessage | undefined;
  let targetBot: Bot | undefined;
  for (const bot of store.state.bots) {
    const found = (store.state.messages[bot.id] || []).find((m) => m.approval?.id === approvalId);
    if (found) {
      targetMsg = found;
      targetBot = bot;
      break;
    }
  }

  if (!targetMsg || !targetMsg.approval || !targetBot) return false;
  if (targetMsg.approval.status !== 'pending') return false;

  targetMsg.approval.status = decision;
  const step = targetMsg.steps?.find((s) => s.status === 'waiting_approval');
  if (step) {
    step.status = decision === 'approved' ? 'done' : 'rejected';
    step.label =
      decision === 'approved'
        ? `Executed ${targetMsg.approval.app} action`
        : `Rejected ${targetMsg.approval.app} action`;
    step.durationMs = 4500;
  }

  // Handle pre-seeded approval card cleanly
  if (approvalId === 'apr-1') {
    targetBot.status = 'idle';
    targetBot.currentAction = undefined;
    targetMsg.content =
      decision === 'approved'
        ? 'Sent the weekly sprint digest email to `engineering@acme.dev` via Gmail.'
        : 'Cancelled the email draft — nothing was sent to `engineering@acme.dev`.';
    targetBot.screen.terminalLines.push(
      `nova@orgo-hq:~$ composio ${decision} ${targetMsg.approval.action}`,
    );
    targetBot.screen.lastUpdatedAt = new Date().toISOString();
    pendingApprovals.delete(approvalId);
    store.emitUpdate('chat:updated', { botId: targetBot.id });
    return true;
  }

  if (entry) {
    pendingApprovals.delete(approvalId);
    entry.resolve(decision);
    return true;
  }

  return false;
}
