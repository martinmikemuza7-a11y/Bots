export type BotStatus = 'idle' | 'working' | 'waiting_approval';
export type ScreenApp = 'home' | 'chrome' | 'terminal' | 'files';

export interface BotEngine {
  provider: 'anthropic' | 'openai' | 'xai' | 'google';
  model: string;
  subscriptionActive: boolean;
  subscriptionLabel?: string;
}

export interface BotScreen {
  display: string;
  activeApp: ScreenApp;
  url: string;
  pageTitle: string;
  pageSummary: string;
  terminalLines: string[];
  takeControl: boolean;
  lastUpdatedAt: string;
}

export interface Bot {
  id: string;
  name: string;
  role: string;
  isPrimary: boolean;
  avatarVariant: number;
  accentColor: string;
  status: BotStatus;
  workingSince?: number;
  currentAction?: string;
  engine: BotEngine;
  memory: string[];
  screen: BotScreen;
  createdAt: string;
}

export interface ToolStep {
  id: string;
  tool: string;
  label: string;
  detail: string;
  status: 'running' | 'done' | 'waiting_approval' | 'rejected';
  durationMs: number;
}

export interface ApprovalRequest {
  id: string;
  botId: string;
  messageId: string;
  app: string;
  action: string;
  summary: string;
  payload: Record<string, string>;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ChatMessage {
  id: string;
  botId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  durationMs?: number;
  steps?: ToolStep[];
  approval?: ApprovalRequest;
  isStreaming?: boolean;
}

export interface ConnectedApp {
  slug: string;
  name: string;
  category: string;
  connected: boolean;
  accountLabel?: string;
  writeActionsRequireApproval: boolean;
  capabilities: string[];
}

export interface BotTask {
  id: string;
  botId: string;
  title: string;
  done: boolean;
  createdAt: string;
}

export interface BotRoutine {
  id: string;
  botId: string;
  name: string;
  schedule: string;
  prompt: string;
  enabled: boolean;
  lastRunAt?: string;
}

export interface LibraryItem {
  id: string;
  botId: string;
  botName: string;
  title: string;
  filename: string;
  mimeType: string;
  content: string;
  createdAt: string;
}

export interface WorkspaceState {
  session: {
    authenticated: boolean;
    email: string;
    devLoginEnabled: boolean;
  };
  config: {
    maxBots: number;
    hasOrgo: boolean;
    hasComposio: boolean;
    hasXai: boolean;
    hasHermes: boolean;
  };
  bots: Bot[];
  messages: Record<string, ChatMessage[]>;
  apps: ConnectedApp[];
  tasks: BotTask[];
  routines: BotRoutine[];
  library: LibraryItem[];
}
