import type {
  ScheduleStatus, Order, ExecutionLog, ScheduleConfig, ProfileBalance, StockityAsset,
} from '@/types';

const getBase = () => process.env.NEXT_PUBLIC_API_URL ?? '';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('stc_token');
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${getBase()}${path}`, {
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

export const api = {
  // Auth
  login: (email: string, password: string) =>
    req<{ accessToken: string; userId: string; email: string; deviceId: string }>(
      'POST', '/api/v1/auth/login', { email, password }
    ),
  logout: () => req<void>('POST', '/api/v1/auth/logout'),
  me: () => req<{ userId: string; email: string }>('GET', '/api/v1/auth/me'),

  // Profile
  profile: () => req<Record<string, unknown>>('GET', '/api/v1/profile'),
  balance: () => req<ProfileBalance>('GET', '/api/v1/profile/balance'),

  // Assets — fetch langsung dari Stockity via backend
  getAssets: () => req<StockityAsset[]>('GET', '/api/v1/schedule/assets'),

  // Schedule Config
  status:       () => req<ScheduleStatus>('GET', '/api/v1/schedule/status'),
  getConfig:    () => req<ScheduleConfig>('GET', '/api/v1/schedule/config'),
  updateConfig: (data: ScheduleConfig) => req<ScheduleConfig>('PUT', '/api/v1/schedule/config', data),

  // Orders
  getOrders:   () => req<Order[]>('GET', '/api/v1/schedule/orders'),
  addOrders:   (input: string) =>
    req<{ added: number; errors: string[] }>('POST', '/api/v1/schedule/orders', { input }),
  deleteOrder: (id: string) => req<void>('DELETE', `/api/v1/schedule/orders/${id}`),
  clearOrders: () => req<void>('DELETE', '/api/v1/schedule/orders'),

  // Control
  start:  () => req<{ message: string }>('POST', '/api/v1/schedule/start'),
  stop:   () => req<{ message: string }>('POST', '/api/v1/schedule/stop'),
  pause:  () => req<{ message: string }>('POST', '/api/v1/schedule/pause'),
  resume: () => req<{ message: string }>('POST', '/api/v1/schedule/resume'),

  // Logs & Parse
  getLogs:     (limit = 100) =>
    req<ExecutionLog[]>('GET', `/api/v1/schedule/logs?limit=${limit}`),
  parseOrders: (input: string) =>
    req<{ orders: Order[]; errors: string[] }>('POST', '/api/v1/schedule/parse', { input }),
};