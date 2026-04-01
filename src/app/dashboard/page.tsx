'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { ScheduleStatus, ProfileBalance, BotState } from '@/types';

const STATE_CFG: Record<BotState, { color: string; bg: string; border: string; dot: string; label: string; pulse: boolean }> = {
  RUNNING: { color: 'text-green-400',  bg: 'bg-green-500/5',  border: 'border-green-500/20',  dot: 'bg-green-400',  label: 'RUNNING', pulse: true  },
  PAUSED:  { color: 'text-yellow-400', bg: 'bg-yellow-500/5', border: 'border-yellow-500/20', dot: 'bg-yellow-400', label: 'PAUSED',  pulse: false },
  STOPPED: { color: 'text-gray-400',   bg: 'bg-gray-800/30',  border: 'border-gray-700/50',   dot: 'bg-gray-600',   label: 'STOPPED', pulse: false },
  IDLE:    { color: 'text-gray-400',   bg: 'bg-gray-800/30',  border: 'border-gray-700/50',   dot: 'bg-gray-600',   label: 'IDLE',    pulse: false },
};

function Card({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-[11px] text-gray-500 uppercase tracking-wide font-semibold mb-1">{label}</p>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [status,  setStatus]  = useState<ScheduleStatus | null>(null);
  const [balance, setBalance] = useState<ProfileBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg,     setMsg]     = useState('');
  const [busy,    setBusy]    = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, b] = await Promise.allSettled([api.status(), api.balance()]);
      if (s.status === 'fulfilled') setStatus(s.value);
      if (b.status === 'fulfilled') setBalance(b.value);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const action = async (fn: () => Promise<{ message: string }>, label: string) => {
    setBusy(true); setMsg('');
    try {
      const res = await fn();
      setMsg(`✓ ${res.message || label + ' berhasil'}`);
      await load();
    } catch (e: unknown) {
      setMsg(`✗ ${e instanceof Error ? e.message : 'Gagal'}`);
    } finally { setBusy(false); }
  };

  const state   = (status?.botState ?? 'IDLE') as BotState;
  const cfg     = STATE_CFG[state] ?? STATE_CFG.IDLE;
  const balVal  = balance?.balance ?? balance?.real_balance ?? balance?.demo_balance;
  const balCur  = (balance?.currency as string) ?? '';

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Overview</h2>
        <p className="text-sm text-gray-500 mt-0.5">Status bot dan kontrol jadwal trading</p>
      </div>

      {/* Status Card */}
      <div className={`rounded-2xl border p-5 ${cfg.bg} ${cfg.border}`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* State */}
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              {cfg.pulse && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-60`} />
              )}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${cfg.dot}`} />
            </span>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide font-semibold">Bot Status</p>
              <p className={`text-2xl font-bold tracking-tight ${cfg.color}`}>{cfg.label}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: 'Start',  fn: api.start,  color: 'bg-green-500 hover:bg-green-400',  disabled: state === 'RUNNING' },
              { label: 'Pause',  fn: api.pause,  color: 'bg-yellow-500 hover:bg-yellow-400', disabled: state !== 'RUNNING' },
              { label: 'Resume', fn: api.resume, color: 'bg-blue-500 hover:bg-blue-400',    disabled: state !== 'PAUSED'  },
              { label: 'Stop',   fn: api.stop,   color: 'bg-red-500 hover:bg-red-400',      disabled: state === 'STOPPED' || state === 'IDLE' },
            ].map(({ label, fn, color, disabled }) => (
              <button
                key={label}
                onClick={() => action(fn, label)}
                disabled={busy || disabled}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-colors
                            disabled:opacity-30 disabled:cursor-not-allowed ${color}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {msg && (
          <p className={`mt-3 text-sm border-t border-gray-700/50 pt-3 ${msg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
            {msg}
          </p>
        )}
      </div>

      {/* Stats Grid */}
      {loading ? (
        <p className="text-gray-600 text-sm animate-pulse">Memuat data...</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {balVal !== undefined && (
            <Card label="Balance" value={Number(balVal).toFixed(2)} sub={balCur} />
          )}
          <Card label="Total Orders"    value={status?.totalOrders    ?? '-'} />
          <Card label="Executed"        value={status?.executedOrders ?? '-'} />
          <Card label="Active / Pending" value={status?.activeOrders  ?? '-'} />
        </div>
      )}

      {/* Footer hint */}
      <p className="text-xs text-gray-700 text-right">Auto-refresh setiap 5 detik</p>
    </div>
  );
}
