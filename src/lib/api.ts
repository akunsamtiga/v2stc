import type {
  ScheduleStatus, Order, ExecutionLog, ScheduleConfig, ProfileBalance,
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
    req<{ data: { authtoken: string; user_id: string } }>('POST', '/auth/login', { email, password }),
  logout: () => req<void>('POST', '/auth/logout'),
  me: () => req<{ userId: string; email: string }>('GET', '/auth/me'),

  // Profile
  profile: () => req<Record<string, unknown>>('GET', '/profile'),
  balance: () => req<ProfileBalance>('GET', '/profile/balance'),

  // Schedule
  status:       () => req<ScheduleStatus>('GET', '/schedule/status'),
  getConfig:    () => req<ScheduleConfig>('GET', '/schedule/config'),
  updateConfig: (data: ScheduleConfig) => req<ScheduleConfig>('PUT', '/schedule/config', data),

  getOrders:   () => req<Order[]>('GET', '/schedule/orders'),
  addOrders:   (input: string) =>
    req<{ added: number; errors: string[] }>('POST', '/schedule/orders', { input }),
  deleteOrder: (id: string) => req<void>('DELETE', `/schedule/orders/${id}`),
  clearOrders: () => req<void>('DELETE', '/schedule/orders'),

  start:  () => req<{ message: string }>('POST', '/schedule/start'),
  stop:   () => req<{ message: string }>('POST', '/schedule/stop'),
  pause:  () => req<{ message: string }>('POST', '/schedule/pause'),
  resume: () => req<{ message: string }>('POST', '/schedule/resume'),

  getLogs:     (limit = 100) =>
    req<ExecutionLog[]>('GET', `/schedule/logs?limit=${limit}`),
  parseOrders: (input: string) =>
    req<{ orders: Order[]; errors: string[] }>('POST', '/schedule/parse', { input }),
};