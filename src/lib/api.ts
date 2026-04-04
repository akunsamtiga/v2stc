// lib/api.ts  — maps to actual NestJS backend routes
const getBase = () => process.env.NEXT_PUBLIC_API_URL ?? '';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('stc_token');
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${getBase()}/api/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('stc_token');
      window.location.href = '/login';
    }
    throw new Error('Sesi habis, silakan login kembali.');
  }

  let data: unknown;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw new Error((data as any)?.message ?? res.statusText);
  return data as T;
}

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
export interface StockityAsset {
  ric: string;
  name: string;
  type: number;
  typeName: string;
  profitRate: number;
  iconUrl: string | null;
}

export interface ProfileBalance {
  balance?: number;
  real_balance?: number;
  demo_balance?: number;
  currency?: string;
  [key: string]: unknown;
}

export interface ScheduleStatus {
  botState?: 'RUNNING' | 'PAUSED' | 'STOPPED' | 'IDLE';
  totalOrders?: number;
  executedOrders?: number;
  skippedOrders?: number;
  activeOrders?: number;
  sessionPnL?: number;
  nextExecutionTime?: string;   // ← add this line
  startedAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ScheduleConfig {
  asset?: { ric: string; name: string; profitRate?: number; iconUrl?: string | null };
  martingale?: {
    isEnabled: boolean;
    maxSteps: number;
    baseAmount: number;
    multiplierValue: number;
    multiplierType: 'FIXED' | 'PERCENTAGE';
    isAlwaysSignal: boolean;
  };
  isDemoAccount?: boolean;
  currency?: string;
  currencyIso?: string;
  duration?: number;
  stopLoss?: number;
  stopProfit?: number;
  [key: string]: unknown;
}

export interface ScheduleOrder {
  id: string;
  time: string;
  trend: 'call' | 'put';
  timeInMillis: number;
  isExecuted: boolean;
  isSkipped: boolean;
  skipReason?: string;
  result?: string;
  martingaleState?: {
    isActive: boolean;
    currentStep: number;
    maxSteps: number;
    isCompleted: boolean;
    totalLoss: number;
    totalRecovered: number;
  };
}

export interface ExecutionLog {
  id: string;
  orderId?: string;
  time?: string;
  trend?: string;
  amount?: number;
  result?: string;
  profit?: number;
  sessionPnL?: number;
  executedAt?: number;
  note?: string;
  martingaleStep?: number;
}

export interface FastradeStatus {
  mode?: 'FTT' | 'CTC' | null;
  isRunning?: boolean;
  cycleNumber?: number;
  currentTrend?: string | null;
  martingaleStep?: number;
  isMartingaleActive?: boolean;
  sessionPnL?: number;
  totalTrades?: number;
  totalWins?: number;
  totalLosses?: number;
  activeOrderId?: string | null;
  wsConnected?: boolean;
  phase?: string;
  activeTrend?: string | null;
}

export interface FastradeLog {
  id: string;
  orderId: string;
  trend: string;
  amount: number;
  martingaleStep: number;
  dealId?: string;
  result?: string;
  profit?: number;
  sessionPnL?: number;
  executedAt: number;
  note?: string;
  cycleNumber: number;
  mode?: 'FTT' | 'CTC';
}

export interface StartFastradePayload {
  mode: 'FTT' | 'CTC';
  asset: { ric: string; name: string; profitRate?: number; iconUrl?: string | null };
  martingale: {
    isEnabled: boolean;
    maxSteps: number;
    baseAmount: number;
    multiplierValue: number;
    multiplierType: 'FIXED' | 'PERCENTAGE';
  };
  isDemoAccount: boolean;
  currency: string;
  currencyIso: string;
  stopLoss?: number;
  stopProfit?: number;
}

export interface UpdateConfigPayload {
  asset: { ric: string; name: string; profitRate?: number; iconUrl?: string | null };
  martingale: {
    isEnabled: boolean;
    maxSteps: number;
    baseAmount: number;
    multiplierValue: number;
    multiplierType: 'FIXED' | 'PERCENTAGE';
    isAlwaysSignal: boolean;
  };
  isDemoAccount: boolean;
  currency: string;
  currencyIso: string;
  duration?: number;
  stopLoss?: number;
  stopProfit?: number;
}

// ─────────────────────────────────────────────
// API OBJECT
// ─────────────────────────────────────────────
export const api = {
  // ── Auth ──────────────────────────────────
  login: (email: string, password: string) =>
    req<{ accessToken: string; userId: string; email: string; deviceId: string }>(
      'POST', '/auth/login', { email, password }
    ),
  logout: () => req<void>('POST', '/auth/logout'),
  me: () => req<{ userId: string; email: string }>('GET', '/auth/me'),

  // ── Profile ───────────────────────────────
  balance: () => req<ProfileBalance>('GET', '/profile/balance'),
  getProfile: () => req<{
    id: number;
    email: string;
    firstName?: string;
    lastName?: string;
    nickname?: string;
    phone?: string;
    emailVerified?: boolean;
    phoneVerified?: boolean;
    gender?: string;
    country?: string;
    birthday?: string;
    registeredAt?: string;
    registrationCountryIso?: string;
    avatar?: string;
    personalDataLocked?: boolean;
    docsVerified?: boolean;
  }>('GET', '/profile'),

  // ── Assets ───────────────────────────────
  getAssets: () => req<StockityAsset[]>('GET', '/schedule/assets'),

  // ── Schedule Config ───────────────────────
  getConfig:    () => req<ScheduleConfig>('GET', '/schedule/config'),
  updateConfig: (data: UpdateConfigPayload) =>
    req<ScheduleConfig>('PUT', '/schedule/config', data),

  // ── Schedule Orders ───────────────────────
  getOrders:   () => req<ScheduleOrder[]>('GET', '/schedule/orders'),
  addOrders:   (input: string) =>
    req<{ added: number; errors: string[] }>('POST', '/schedule/orders', { input }),
  deleteOrder: (id: string) => req<void>('DELETE', `/schedule/orders/${id}`),
  clearOrders: () => req<void>('DELETE', '/schedule/orders'),
  parseOrders: (input: string) =>
    req<{ orders: ScheduleOrder[]; errors: string[] }>('POST', '/schedule/parse', { input }),

  // ── Schedule Control ──────────────────────
  scheduleStatus: () => req<ScheduleStatus>('GET', '/schedule/status'),
  scheduleStart:  () => req<{ message: string }>('POST', '/schedule/start'),
  scheduleStop:   () => req<{ message: string }>('POST', '/schedule/stop'),
  schedulePause:  () => req<{ message: string }>('POST', '/schedule/pause'),
  scheduleResume: () => req<{ message: string }>('POST', '/schedule/resume'),
  scheduleLogs:   (limit = 100) =>
    req<ExecutionLog[]>('GET', `/schedule/logs?limit=${limit}`),

  // ── Fastrade (FTT + CTC) ──────────────────
  fastradeStart:  (data: StartFastradePayload) =>
    req<{ message: string; mode: string; status: FastradeStatus }>('POST', '/fastrade/start', data),
  fastradeStop:   () => req<{ message: string }>('POST', '/fastrade/stop'),
  fastradeStatus: () => req<FastradeStatus>('GET', '/fastrade/status'),
  fastradeLogs:   (limit = 100) =>
    req<FastradeLog[]>('GET', `/fastrade/logs?limit=${limit}`),
};  