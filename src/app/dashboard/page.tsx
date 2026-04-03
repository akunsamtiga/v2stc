'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  type StockityAsset, type ProfileBalance, type ScheduleStatus,
  type ScheduleConfig, type ScheduleOrder, type ExecutionLog,
  type FastradeStatus, type FastradeLog,
} from '@/lib/api';

// ═══════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════
const C = {
  bg:     '#0a0a0a',
  card:   '#111a14',
  card2:  '#0d1510',
  bdr:    'rgba(52,211,153,0.18)',
  bdrAct: 'rgba(52,211,153,0.50)',
  cyan:   '#34d399',
  cyand:  'rgba(52,211,153,0.12)',
  coral:  '#f87171',
  cord:   'rgba(248,113,113,0.10)',
  amber:  '#fbbf24',
  violet: '#a78bfa',
  text:   '#f0fdf4',
  sub:    'rgba(240,253,244,0.85)',
  muted:  'rgba(240,253,244,0.50)',
  faint:  'rgba(52,211,153,0.07)',
};

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
type TradingMode = 'schedule' | 'ftt' | 'ctc';
type BotState = 'RUNNING' | 'PAUSED' | 'STOPPED' | 'IDLE';

interface AssetConfig {
  ric: string;
  name: string;
  profitRate?: number;
  iconUrl?: string | null;
}

interface MartingaleConfig {
  isEnabled: boolean;
  maxSteps: number;
  baseAmount: number;
  multiplierValue: number;
  multiplierType: 'FIXED' | 'PERCENTAGE';
}

// ═══════════════════════════════════════════════════════════════
// UTILITY HOOKS
// ═══════════════════════════════════════════════════════════════
function useToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('stc_token') : null;
}

function useClock() {
  const [time, setTime] = useState<Date | null>(null);
  useEffect(() => {
    setTime(new Date());
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return time;
}

// ═══════════════════════════════════════════════════════════════
// PRIMITIVE COMPONENTS
// ═══════════════════════════════════════════════════════════════
const Card: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  glow?: string;
}> = ({ children, style, className = '', glow }) => (
  <div
    className={`rounded-2xl overflow-hidden ${className}`}
    style={{
      background: C.card,
      border: `1px solid ${C.bdr}`,
      boxShadow: glow
        ? `0 0 20px ${glow}20, 0 4px 24px rgba(0,0,0,0.4)`
        : '0 4px 24px rgba(0,0,0,0.3)',
      ...style,
    }}
  >
    {children}
  </div>
);

const Skeleton = ({ w = '100%', h = 18 }: { w?: string | number; h?: number }) => (
  <div
    className="animate-pulse rounded"
    style={{ width: w, height: h, background: C.faint }}
  />
);

const StatusDot: React.FC<{ color: string; pulse?: boolean; size?: number }> = ({
  color, pulse = false, size = 6,
}) => (
  <span className="relative inline-flex" style={{ width: size, height: size }}>
    {pulse && (
      <span
        className="animate-ping absolute inline-flex rounded-full opacity-60"
        style={{ width: size, height: size, background: color }}
      />
    )}
    <span
      className="relative inline-flex rounded-full"
      style={{ width: size, height: size, background: color }}
    />
  </span>
);

const Badge: React.FC<{
  label: string; color: string; pulse?: boolean;
}> = ({ label, color, pulse = false }) => (
  <span
    className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full"
    style={{
      color,
      background: `${color}12`,
      border: `1px solid ${color}30`,
    }}
  >
    <StatusDot color={color} pulse={pulse} size={5} />
    {label}
  </span>
);

const FL: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-[10px] font-bold mb-1.5 uppercase tracking-widest" style={{ color: C.muted }}>
    {children}
  </label>
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({
  checked, onChange, disabled = false,
}) => (
  <label className={`inline-flex items-center ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} disabled={disabled} className="sr-only" />
    <div
      className="relative w-10 h-5 rounded-full transition-all duration-200"
      style={{
        background: checked ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${checked ? 'rgba(52,211,153,0.5)' : 'rgba(255,255,255,0.1)'}`,
      }}
    >
      <div
        className="absolute top-0.5 w-[14px] h-[14px] rounded-full transition-all duration-200 shadow-sm"
        style={{
          left: checked ? 20 : 2,
          background: checked ? C.cyan : 'rgba(255,255,255,0.4)',
        }}
      />
    </div>
  </label>
);

const NumberInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  prefix?: string;
  disabled?: boolean;
}> = ({ value, onChange, min = 0, step = 1000, prefix, disabled }) => (
  <div className="relative">
    {prefix && (
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] pointer-events-none z-10" style={{ color: C.muted }}>
        {prefix}
      </span>
    )}
    <input
      type="number"
      value={value || ''}
      onChange={e => onChange(Number(e.target.value) || 0)}
      min={min}
      step={step}
      disabled={disabled}
      className="w-full rounded-xl px-3 py-2.5 text-[13px] font-medium outline-none transition-all"
      style={{
        paddingLeft: prefix ? 30 : 12,
        background: 'rgba(0,0,0,0.4)',
        border: `1px solid ${C.bdr}`,
        color: C.text,
        opacity: disabled ? 0.5 : 1,
      }}
      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(52,211,153,0.4)'; }}
      onBlur={e => { e.currentTarget.style.borderColor = C.bdr; }}
    />
  </div>
);

// ═══════════════════════════════════════════════════════════════
// ASSET PICKER MODAL
// ═══════════════════════════════════════════════════════════════
const AssetPickerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  assets: StockityAsset[];
  selected: string;
  onSelect: (a: StockityAsset) => void;
}> = ({ isOpen, onClose, assets, selected, onSelect }) => {
  const [q, setQ] = useState('');
  useEffect(() => { if (isOpen) setQ(''); }, [isOpen]);
  if (!isOpen) return null;

  const filtered = q.trim()
    ? assets.filter(a => a.name.toLowerCase().includes(q.toLowerCase()) || a.ric.toLowerCase().includes(q.toLowerCase()))
    : assets;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }} />
      <div style={{
        position: 'relative', width: '100%', maxWidth: 480,
        maxHeight: '80dvh', display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(160deg,#0d1f18 0%,#080f0b 100%)',
        borderRadius: '20px 20px 0 0',
        border: `1px solid ${C.bdr}`, borderBottom: 'none',
        boxShadow: '0 -12px 60px rgba(0,0,0,0.6)',
      }}>
        {/* Handle */}
        <div style={{ width: 32, height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.15)', margin: '12px auto 0', flexShrink: 0 }} />
        {/* Header */}
        <div style={{ padding: '14px 18px 10px', borderBottom: `1px solid ${C.bdr}`, flexShrink: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 }}>Pilih Aset</p>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.muted }}>🔍</span>
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Cari nama atau kode aset..."
              style={{
                width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
                background: 'rgba(0,0,0,0.5)', border: `1px solid ${C.bdr}`, borderRadius: 12,
                fontSize: 13, color: C.text, outline: 'none',
              }}
            />
          </div>
        </div>
        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.map((a, i) => {
            const isSelected = a.ric === selected;
            return (
              <button
                key={a.ric}
                onClick={() => { onSelect(a); onClose(); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 18px',
                  background: isSelected ? 'rgba(52,211,153,0.08)' : 'transparent',
                  borderLeft: `2px solid ${isSelected ? C.cyan : 'transparent'}`,
                  borderBottom: i < filtered.length - 1 ? `1px solid ${C.bdr}` : 'none',
                  borderTop: 'none', borderRight: 'none', cursor: 'pointer',
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: isSelected ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isSelected ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, overflow: 'hidden',
                }}>
                  {a.iconUrl ? (
                    <img src={a.iconUrl} alt={a.ric} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }}
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 800, color: isSelected ? C.cyan : C.muted }}>
                      {a.ric.slice(0, 3)}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <p style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: isSelected ? C.cyan : C.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.name}
                  </p>
                  <p style={{ fontSize: 11, color: C.muted }}>{a.ric} · {a.profitRate}%</p>
                </div>
                {isSelected && (
                  <span style={{ color: C.cyan, fontSize: 16 }}>✓</span>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
              Aset tidak ditemukan
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ORDER INPUT MODAL (Schedule)
// ═══════════════════════════════════════════════════════════════
const OrderInputModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAdd: (input: string) => Promise<void>;
  isLoading: boolean;
}> = ({ isOpen, onClose, onAdd, isLoading }) => {
  const [input, setInput] = useState('');
  if (!isOpen) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }} />
      <div style={{
        position: 'relative', width: '100%', maxWidth: 480,
        display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(160deg,#0d1f18 0%,#080f0b 100%)',
        borderRadius: '20px 20px 0 0',
        border: `1px solid ${C.bdr}`, borderBottom: 'none',
        padding: '0 0 24px',
      }}>
        <div style={{ width: 32, height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.15)', margin: '12px auto 8px', flexShrink: 0 }} />
        <div style={{ padding: '8px 18px 14px', borderBottom: `1px solid ${C.bdr}`, marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>Tambah Orders</p>
          <p style={{ fontSize: 11, color: C.muted }}>
            Format: <span style={{ color: C.cyan, fontFamily: 'monospace' }}>09:30 call</span> atau <span style={{ color: C.coral, fontFamily: 'monospace' }}>14:00 put</span> — satu per baris
          </p>
        </div>
        <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={'09:00 call\n09:30 put\n10:00 call'}
            rows={6}
            style={{
              width: '100%', padding: 12,
              background: 'rgba(0,0,0,0.5)', border: `1px solid ${C.bdr}`, borderRadius: 12,
              fontSize: 13, color: C.text, fontFamily: 'monospace', outline: 'none', resize: 'vertical',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(52,211,153,0.4)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = C.bdr; }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => onAdd(input).then(() => { setInput(''); onClose(); })}
              disabled={!input.trim() || isLoading}
              style={{
                flex: 1, padding: '12px 0', borderRadius: 12,
                background: input.trim() ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${input.trim() ? 'rgba(52,211,153,0.4)' : C.bdr}`,
                color: input.trim() ? C.cyan : C.muted,
                fontSize: 13, fontWeight: 700, cursor: input.trim() ? 'pointer' : 'not-allowed',
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? 'Menambahkan...' : '+ Tambah Orders'}
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '12px 20px', borderRadius: 12,
                background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.bdr}`,
                color: C.sub, fontSize: 13, cursor: 'pointer',
              }}
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MARTINGALE CONFIG PANEL (reusable)
// ═══════════════════════════════════════════════════════════════
const MartingalePanel: React.FC<{
  config: MartingaleConfig;
  onChange: (c: MartingaleConfig) => void;
  disabled?: boolean;
}> = ({ config, onChange, disabled = false }) => {
  const set = (k: keyof MartingaleConfig, v: any) => onChange({ ...config, [k]: v });
  const steps = [1, 2, 3, 4, 5];
  const mults = [1.5, 2, 2.5, 3];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 2 }}>Martingale</p>
          <p style={{ fontSize: 10, color: C.muted }}>Lipat gandakan amount setelah kalah</p>
        </div>
        <Toggle checked={config.isEnabled} onChange={v => set('isEnabled', v)} disabled={disabled} />
      </div>
      {config.isEnabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 10, borderTop: `1px solid ${C.bdr}` }}>
          <div>
            <FL>Max Step</FL>
            <div style={{ display: 'flex', gap: 6 }}>
              {steps.map(s => (
                <button
                  key={s}
                  onClick={() => set('maxSteps', s)}
                  disabled={disabled}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    background: config.maxSteps === s ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${config.maxSteps === s ? 'rgba(52,211,153,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    color: config.maxSteps === s ? C.cyan : 'rgba(255,255,255,0.45)',
                  }}
                >
                  K{s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <FL>Multiplier</FL>
            <div style={{ display: 'flex', gap: 6 }}>
              {mults.map(m => (
                <button
                  key={m}
                  onClick={() => set('multiplierValue', m)}
                  disabled={disabled}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    background: config.multiplierValue === m ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${config.multiplierValue === m ? 'rgba(52,211,153,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    color: config.multiplierValue === m ? C.cyan : 'rgba(255,255,255,0.45)',
                  }}
                >
                  {m}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SCHEDULE ORDER LIST
// ═══════════════════════════════════════════════════════════════
const OrderList: React.FC<{
  orders: ScheduleOrder[];
  logs: ExecutionLog[];
  onAdd: () => void;
  onDelete: (id: string) => void;
  isRunning: boolean;
  isLoading: boolean;
}> = ({ orders, logs, onAdd, onDelete, isRunning, isLoading }) => {
  const pending = orders.filter(o => !o.isExecuted && !o.isSkipped);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${C.bdr}` }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 2 }}>Orders Terjadwal</p>
          <p style={{ fontSize: 10, color: C.muted }}>{pending.length} pending · {orders.filter(o => o.isExecuted).length} executed</p>
        </div>
        {!isRunning && (
          <button
            onClick={onAdd}
            style={{
              padding: '6px 12px', borderRadius: 8,
              background: 'rgba(52,211,153,0.1)', border: `1px solid rgba(52,211,153,0.3)`,
              color: C.cyan, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}
          >
            + Tambah
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} h={36} />)}
          </div>
        ) : orders.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>Belum ada orders</p>
            <p style={{ fontSize: 11, color: C.muted }}>Tambah jadwal trading di atas</p>
          </div>
        ) : (
          orders.map((order, i) => {
            const isCall = order.trend === 'call';
            const log = logs.find(l => l.orderId === order.id);
            const result = log?.result || order.result;
            return (
              <div
                key={order.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px',
                  borderBottom: i < orders.length - 1 ? `1px solid ${C.bdr}` : 'none',
                  background: order.isExecuted ? 'rgba(52,211,153,0.03)' : 'transparent',
                }}
              >
                <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: C.sub, width: 44 }}>{order.time}</span>
                <span
                  style={{
                    fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                    color: isCall ? C.cyan : C.coral,
                    background: isCall ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                  }}
                >
                  {isCall ? '↑ CALL' : '↓ PUT'}
                </span>
                <div style={{ flex: 1 }} />
                {/* Status */}
                {order.isExecuted && result && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                    color: result === 'WIN' ? C.cyan : result === 'LOSE' || result === 'LOSS' ? C.coral : C.amber,
                    background: result === 'WIN' ? 'rgba(52,211,153,0.1)' : result === 'LOSE' || result === 'LOSS' ? 'rgba(248,113,113,0.1)' : 'rgba(251,191,36,0.1)',
                  }}>
                    {result}
                  </span>
                )}
                {order.isExecuted && !result && (
                  <span style={{ fontSize: 10, color: C.muted }}>✓ Done</span>
                )}
                {order.isSkipped && (
                  <span style={{ fontSize: 10, color: C.muted }}>⊘ Skip</span>
                )}
                {!order.isExecuted && !order.isSkipped && !isRunning && (
                  <button
                    onClick={() => onDelete(order.id)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(248,113,113,0.5)', fontSize: 14, padding: '2px 4px' }}
                  >
                    ×
                  </button>
                )}
                {!order.isExecuted && !order.isSkipped && isRunning && (
                  <span className="animate-pulse" style={{ fontSize: 10, color: C.amber }}>⏳</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// FASTRADE / CTC STATUS PANEL
// ═══════════════════════════════════════════════════════════════
const FastradeStatusPanel: React.FC<{
  status: FastradeStatus | null;
  logs: FastradeLog[];
  mode: 'ftt' | 'ctc';
  isLoading: boolean;
}> = ({ status, logs, mode, isLoading }) => {
  const accent = mode === 'ctc' ? C.violet : C.cyan;
  const isActive = status?.isRunning ?? false;
  const pnl = status?.sessionPnL ?? 0;
  const pnlPos = pnl >= 0;
  const wins = status?.totalWins ?? 0;
  const losses = status?.totalLosses ?? 0;
  const total = status?.totalTrades ?? 0;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : null;

  const phaseLabel = (() => {
    const phase = status?.phase ?? '';
    if (!isActive) return 'Standby';
    const map: Record<string, string> = {
      IDLE: 'Memulai...', WAITING_MINUTE_1: 'Menunggu candle 1',
      FETCHING_1: 'Membaca candle 1', WAITING_MINUTE_2: 'Menunggu candle 2',
      FETCHING_2: 'Membaca candle 2', ANALYZING: 'Menganalisis...',
      WAITING_EXEC_SYNC: 'Sinkronisasi waktu', EXECUTING: 'Memasang order',
      WAITING_RESULT: 'Menunggu hasil', WAITING_LOSS_DELAY: 'Jeda setelah kalah',
    };
    return map[phase] || phase || 'Running';
  })();

  const trendLabel = (t: string | null | undefined) => {
    if (!t) return null;
    return t.toLowerCase() === 'call' ? { label: '↑ CALL', col: C.cyan } : { label: '↓ PUT', col: C.coral };
  };

  const trendInfo = trendLabel(mode === 'ctc' ? (status?.activeTrend || status?.currentTrend) : status?.currentTrend);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.bdr}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 2 }}>
              {mode === 'ctc' ? 'CTC Bot' : 'FastTrade Bot'}
            </p>
            <p style={{ fontSize: 10, color: C.muted }}>
              {mode === 'ctc' ? 'Candle-to-Candle · 1 menit' : 'Follow the Trend · per candle'}
            </p>
          </div>
          {isActive && <Badge label="Aktif" color={accent} pulse />}
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2].map(i => <Skeleton key={i} h={48} />)}
        </div>
      ) : !isActive && !status ? (
        <div style={{ padding: '28px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>{mode === 'ctc' ? '🔄' : '⚡'}</p>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>
            {mode === 'ctc' ? 'Bot CTC belum aktif' : 'Bot FastTrade belum aktif'}
          </p>
          <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
            Konfigurasi aset & martingale, lalu tekan Mulai
          </p>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <div style={{ background: `${pnlPos ? C.cyan : C.coral}08`, border: `1px solid ${pnlPos ? C.cyan : C.coral}20`, borderRadius: 10, padding: '8px 10px' }}>
              <p style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>P&L Sesi</p>
              <p style={{ fontSize: 14, fontWeight: 800, color: pnlPos ? C.cyan : C.coral, fontFamily: 'monospace' }}>
                {pnlPos ? '+' : ''}{pnl.toLocaleString('id-ID')}
              </p>
            </div>
            <div style={{ background: 'rgba(52,211,153,0.05)', border: `1px solid rgba(52,211,153,0.12)`, borderRadius: 10, padding: '8px 10px' }}>
              <p style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>W / L</p>
              <p style={{ fontSize: 14, fontWeight: 800 }}>
                <span style={{ color: C.cyan }}>{wins}</span>
                <span style={{ color: C.muted, fontSize: 11 }}>/</span>
                <span style={{ color: C.coral }}>{losses}</span>
              </p>
            </div>
            <div style={{ background: 'rgba(52,211,153,0.05)', border: `1px solid rgba(52,211,153,0.12)`, borderRadius: 10, padding: '8px 10px' }}>
              <p style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Win%</p>
              <p style={{ fontSize: 14, fontWeight: 800, color: winRate !== null ? (winRate >= 50 ? C.cyan : C.coral) : C.muted }}>
                {winRate !== null ? `${winRate}%` : '—'}
              </p>
            </div>
          </div>

          {/* Phase + trend */}
          {isActive && (
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, background: `${accent}08`, border: `1px solid ${accent}20`, borderRadius: 10, padding: '8px 10px' }}>
                <p style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Status</p>
                <p style={{ fontSize: 11, fontWeight: 600, color: accent }}>{phaseLabel}</p>
              </div>
              {trendInfo && (
                <div style={{ background: `${trendInfo.col}08`, border: `1px solid ${trendInfo.col}25`, borderRadius: 10, padding: '8px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <p style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Trend</p>
                  <p style={{ fontSize: 13, fontWeight: 800, color: trendInfo.col, fontFamily: 'monospace' }}>{trendInfo.label}</p>
                </div>
              )}
              {(status?.martingaleStep ?? 0) > 0 && (
                <div style={{ background: 'rgba(251,191,36,0.08)', border: `1px solid rgba(251,191,36,0.2)`, borderRadius: 10, padding: '8px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <p style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>M. Step</p>
                  <p style={{ fontSize: 13, fontWeight: 800, color: C.amber }}>K{status?.martingaleStep}</p>
                </div>
              )}
            </div>
          )}

          {/* Cycle */}
          {isActive && (status?.cycleNumber ?? 0) > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.bdr}`, borderRadius: 8, padding: '7px 12px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: C.muted }}>Siklus ke</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.sub }}>{status?.cycleNumber}</span>
            </div>
          )}

          {/* Recent logs */}
          {logs.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.bdr}`, paddingTop: 10 }}>
              <p style={{ fontSize: 10, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Riwayat Terakhir</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {logs.slice(-4).reverse().map(log => {
                  const resultCol = log.result === 'WIN' ? C.cyan : log.result === 'LOSE' || log.result === 'LOSS' ? C.coral : C.amber;
                  const trendCol = log.trend === 'call' ? C.cyan : C.coral;
                  return (
                    <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: trendCol, fontWeight: 700, width: 40 }}>
                        {log.trend?.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 10, color: C.muted, flex: 1 }}>
                        {log.amount?.toLocaleString('id-ID')}
                      </span>
                      {log.result && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: resultCol }}>{log.result}</span>
                      )}
                      {log.profit !== undefined && (
                        <span style={{ fontSize: 10, color: (log.profit ?? 0) >= 0 ? C.cyan : C.coral, fontFamily: 'monospace' }}>
                          {(log.profit ?? 0) >= 0 ? '+' : ''}{log.profit?.toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SETTINGS PANEL (shared between modes)
// ═══════════════════════════════════════════════════════════════
const SettingsPanel: React.FC<{
  asset: AssetConfig | null;
  amount: number;
  isDemoAccount: boolean;
  duration: number;
  martingale: MartingaleConfig;
  stopLoss: number;
  stopProfit: number;
  mode: TradingMode;
  onOpenAssetPicker: () => void;
  onAmountChange: (v: number) => void;
  onDemoChange: (v: boolean) => void;
  onDurationChange: (v: number) => void;
  onMartingaleChange: (c: MartingaleConfig) => void;
  onStopLossChange: (v: number) => void;
  onStopProfitChange: (v: number) => void;
  disabled?: boolean;
}> = ({
  asset, amount, isDemoAccount, duration, martingale, stopLoss, stopProfit, mode,
  onOpenAssetPicker, onAmountChange, onDemoChange, onDurationChange,
  onMartingaleChange, onStopLossChange, onStopProfitChange, disabled = false,
}) => {
  const accent = mode === 'ctc' ? C.violet : C.cyan;

  const AMOUNTS = [10000, 25000, 50000, 100000, 250000, 500000];
  const DURATIONS = [{ v: 60, l: '1m' }, { v: 120, l: '2m' }, { v: 300, l: '5m' }, { v: 600, l: '10m' }, { v: 900, l: '15m' }];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '14px 16px', opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      {/* Asset */}
      <div>
        <FL>Aset Trading</FL>
        <button
          onClick={onOpenAssetPicker}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 12,
            background: asset ? `${accent}08` : 'rgba(0,0,0,0.4)',
            border: `1px solid ${asset ? `${accent}30` : C.bdr}`,
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          {asset ? (
            <>
              <div style={{ width: 28, height: 28, borderRadius: 8, overflow: 'hidden', background: `${accent}15`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {asset.iconUrl ? (
                  <img src={asset.iconUrl} alt={asset.ric} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <span style={{ fontSize: 10, fontWeight: 800, color: accent }}>{asset.ric.slice(0, 3)}</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</p>
                <p style={{ fontSize: 10, color: C.muted }}>{asset.ric} · {asset.profitRate}%</p>
              </div>
            </>
          ) : (
            <span style={{ fontSize: 13, color: C.muted }}>Pilih aset trading...</span>
          )}
          <span style={{ color: C.muted, fontSize: 12 }}>▾</span>
        </button>
      </div>

      {/* Account Type */}
      <div>
        <FL>Tipe Akun</FL>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ v: true, l: 'Demo', note: 'Virtual' }, { v: false, l: 'Real', note: 'Uang nyata' }].map(opt => (
            <button
              key={String(opt.v)}
              onClick={() => onDemoChange(opt.v)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
                background: isDemoAccount === opt.v ? (opt.v ? 'rgba(251,191,36,0.12)' : `${accent}12`) : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isDemoAccount === opt.v ? (opt.v ? 'rgba(251,191,36,0.4)' : `${accent}40`) : 'rgba(255,255,255,0.08)'}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: isDemoAccount === opt.v ? (opt.v ? C.amber : accent) : C.muted }}>{opt.l}</span>
              <span style={{ fontSize: 9, color: C.muted }}>{opt.note}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Duration (only for schedule) */}
      {mode === 'schedule' && (
        <div>
          <FL>Durasi Order</FL>
          <div style={{ display: 'flex', gap: 6 }}>
            {DURATIONS.map(d => (
              <button
                key={d.v}
                onClick={() => onDurationChange(d.v)}
                style={{
                  flex: 1, padding: '7px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  background: duration === d.v ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${duration === d.v ? 'rgba(52,211,153,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  color: duration === d.v ? C.cyan : 'rgba(255,255,255,0.45)',
                }}
              >
                {d.l}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Amount */}
      <div>
        <FL>Jumlah per Order</FL>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {AMOUNTS.map(a => (
            <button
              key={a}
              onClick={() => onAmountChange(a)}
              style={{
                flex: '1 1 60px', padding: '6px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 700,
                background: amount === a ? `${accent}15` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${amount === a ? `${accent}50` : 'rgba(255,255,255,0.08)'}`,
                color: amount === a ? accent : 'rgba(255,255,255,0.45)',
                whiteSpace: 'nowrap',
              }}
            >
              {a >= 1000000 ? `${a / 1000000}M` : `${a / 1000}K`}
            </button>
          ))}
        </div>
        <NumberInput value={amount} onChange={onAmountChange} min={10000} step={5000} prefix="Rp" />
      </div>

      {/* Martingale */}
      <div style={{ background: `${accent}05`, border: `1px solid ${accent}15`, borderRadius: 12, padding: 12 }}>
        <MartingalePanel config={martingale} onChange={onMartingaleChange} />
      </div>

      {/* Stop Loss / Profit */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(248,113,113,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Risk Management</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(248,113,113,0.15)' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <FL>Stop Loss</FL>
            <NumberInput value={stopLoss} onChange={onStopLossChange} prefix="Rp" step={50000} />
          </div>
          <div>
            <FL>Stop Profit</FL>
            <NumberInput value={stopProfit} onChange={onStopProfitChange} prefix="Rp" step={50000} />
          </div>
        </div>
        <p style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>0 = nonaktif. Bot berhenti otomatis jika batas tercapai.</p>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// CONTROL BAR
// ═══════════════════════════════════════════════════════════════
const ControlBar: React.FC<{
  mode: TradingMode;
  scheduleState: BotState;
  fastradeState: FastradeStatus | null;
  canStart: boolean;
  isLoading: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  error: string | null;
}> = ({ mode, scheduleState, fastradeState, canStart, isLoading, onStart, onStop, onPause, onResume, error }) => {
  const isSchedRunning = scheduleState === 'RUNNING';
  const isSchedPaused = scheduleState === 'PAUSED';
  const isFastradeRunning = fastradeState?.isRunning ?? false;
  const accent = mode === 'ctc' ? C.violet : C.cyan;

  const isRunning = mode === 'schedule' ? isSchedRunning : isFastradeRunning;
  const isPaused = mode === 'schedule' ? isSchedPaused : false;

  const Btn: React.FC<{
    label: string; icon?: string; color: string;
    onClick: () => void; disabled?: boolean; solid?: boolean;
  }> = ({ label, icon, color, onClick, disabled, solid }) => (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '11px 8px', borderRadius: 12,
        background: solid ? color : `${color}12`,
        border: `1px solid ${color}${solid ? '' : '35'}`,
        color: solid ? '#000' : color,
        fontSize: 12, fontWeight: 700, cursor: (disabled || isLoading) ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.3 : 1,
        transition: 'all 0.15s',
      }}
    >
      {isLoading ? '⟳' : icon}
      {isLoading ? 'Memproses...' : label}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: C.cord, border: `1px solid rgba(248,113,113,0.2)`, fontSize: 12, color: C.coral }}>
          ⚠ {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        {!isRunning && !isPaused && (
          <Btn label={mode === 'ctc' ? 'Mulai CTC' : mode === 'ftt' ? 'Mulai FTT' : 'Mulai Bot'} icon="▶" color={accent} onClick={onStart} disabled={!canStart} solid />
        )}
        {isRunning && mode === 'schedule' && (
          <Btn label="Jeda" icon="⏸" color={C.amber} onClick={onPause} />
        )}
        {isPaused && mode === 'schedule' && (
          <Btn label="Lanjutkan" icon="▶" color={C.cyan} onClick={onResume} />
        )}
        {(isRunning || isPaused) && (
          <Btn label="Stop" icon="⏹" color={C.coral} onClick={onStop} />
        )}
      </div>
      {!canStart && !isRunning && !isPaused && (
        <p style={{ fontSize: 10, textAlign: 'center', color: C.muted }}>
          {!canStart && mode === 'schedule'
            ? 'Pilih aset + tambah minimal 1 order'
            : 'Pilih aset untuk memulai'}
        </p>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MODE SELECTOR
// ═══════════════════════════════════════════════════════════════
const ModeSelector: React.FC<{
  mode: TradingMode;
  onChange: (m: TradingMode) => void;
  disabled: boolean;
  blockedModes: TradingMode[];
}> = ({ mode, onChange, disabled, blockedModes }) => {
  const MODES = [
    { v: 'schedule' as TradingMode, label: 'Signal', icon: '📅', desc: 'Jadwal waktu + trend', accent: C.cyan },
    { v: 'ftt' as TradingMode, label: 'FTT', icon: '⚡', desc: 'Follow the Trend', accent: C.cyan },
    { v: 'ctc' as TradingMode, label: 'CTC', icon: '🔄', desc: 'Candle-to-Candle', accent: C.violet },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
      {MODES.map(m => {
        const isActive = mode === m.v;
        const isBlocked = blockedModes.includes(m.v);
        return (
          <button
            key={m.v}
            onClick={() => !isBlocked && onChange(m.v)}
            style={{
              padding: '10px 6px', borderRadius: 12, cursor: isBlocked ? 'not-allowed' : 'pointer',
              background: isActive ? `${m.accent}12` : 'rgba(0,0,0,0.3)',
              border: `1.5px solid ${isActive ? `${m.accent}50` : 'rgba(255,255,255,0.07)'}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              opacity: isBlocked ? 0.4 : 1, transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 16 }}>{m.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? m.accent : C.muted }}>{m.label}</span>
            <span style={{ fontSize: 9, color: C.muted, lineHeight: 1.3, textAlign: 'center' }}>{m.desc}</span>
            {isBlocked && <span style={{ fontSize: 9, color: C.coral }}>🔒</span>}
          </button>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// CLOCK + BALANCE ROW
// ═══════════════════════════════════════════════════════════════
const TopBar: React.FC<{
  balance: ProfileBalance | null;
  isDemoAccount: boolean;
  scheduleState: BotState;
  fastradeStatus: FastradeStatus | null;
  mode: TradingMode;
}> = ({ balance, isDemoAccount, scheduleState, fastradeStatus, mode }) => {
  const time = useClock();
  const fmt = (d: Date) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const fmtDate = (d: Date) => d.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' });
  const tz = () => { if (!time) return ''; const o = -time.getTimezoneOffset() / 60; return `UTC${o >= 0 ? '+' : ''}${o}`; };

  const balVal = isDemoAccount
    ? (balance?.demo_balance ?? balance?.balance ?? 0)
    : (balance?.real_balance ?? balance?.balance ?? 0);

  const isActive = mode === 'schedule'
    ? scheduleState === 'RUNNING'
    : fastradeStatus?.isRunning ?? false;

  const sessionPnL = mode === 'schedule'
    ? 0 // schedule sessionPnL from status
    : fastradeStatus?.sessionPnL ?? 0;

  const accent = mode === 'ctc' ? C.violet : C.cyan;

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {/* Clock */}
      <Card style={{ flex: 1, padding: '10px 14px' }}>
        <div suppressHydrationWarning style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <p style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Waktu</p>
          <p suppressHydrationWarning style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: C.text, lineHeight: 1 }}>
            {time ? fmt(time) : '--:--:--'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span suppressHydrationWarning style={{ fontSize: 10, color: C.muted }}>{time ? fmtDate(time) : ''}</span>
            <span suppressHydrationWarning style={{ fontSize: 9, color: C.muted }}>{tz()}</span>
          </div>
        </div>
      </Card>

      {/* Balance */}
      <Card style={{ flex: 1, padding: '10px 14px' }}>
        <p style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
          Saldo {isDemoAccount ? '(Demo)' : '(Real)'}
        </p>
        <p style={{ fontSize: 16, fontWeight: 800, color: isDemoAccount ? C.amber : C.cyan, fontFamily: 'monospace' }}>
          {balVal.toLocaleString('id-ID')}
        </p>
        <p style={{ fontSize: 9, color: C.muted }}>{balance?.currency ?? 'IDR'}</p>
      </Card>

      {/* Session P&L */}
      <Card style={{ flex: 1, padding: '10px 14px' }} glow={isActive ? accent : undefined}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>P&L Sesi</p>
          {isActive && <StatusDot color={accent} pulse size={6} />}
        </div>
        <p style={{ fontSize: 16, fontWeight: 800, color: sessionPnL >= 0 ? C.cyan : C.coral, fontFamily: 'monospace' }}>
          {sessionPnL >= 0 ? '+' : ''}{sessionPnL.toLocaleString('id-ID')}
        </p>
        <p style={{ fontSize: 9, color: C.muted }}>{isActive ? 'Sesi aktif' : 'Tidak aktif'}</p>
      </Card>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const router = useRouter();
  const token = useToken();

  // ── Data State ──────────────────────────────────────────────
  const [assets, setAssets] = useState<StockityAsset[]>([]);
  const [balance, setBalance] = useState<ProfileBalance | null>(null);
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus | null>(null);
  const [scheduleOrders, setScheduleOrders] = useState<ScheduleOrder[]>([]);
  const [scheduleLogs, setScheduleLogs] = useState<ExecutionLog[]>([]);
  const [fastradeStatus, setFastradeStatus] = useState<FastradeStatus | null>(null);
  const [fastradeLogs, setFastradeLogs] = useState<FastradeLog[]>([]);

  // ── UI State ─────────────────────────────────────────────────
  const [mode, setMode] = useState<TradingMode>('schedule');
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [orderInputOpen, setOrderInputOpen] = useState(false);
  const [addOrderLoading, setAddOrderLoading] = useState(false);

  // ── Settings State (shared asset + per-mode settings) ────────
  const [selectedAsset, setSelectedAsset] = useState<AssetConfig | null>(null);
  const [isDemoAccount, setIsDemoAccount] = useState(true);
  const [duration, setDuration] = useState(60);
  const [amount, setAmount] = useState(50000);
  const [martingale, setMartingale] = useState<MartingaleConfig>({
    isEnabled: false, maxSteps: 3, baseAmount: 50000,
    multiplierValue: 2, multiplierType: 'FIXED',
  });
  const [stopLoss, setStopLoss] = useState(0);
  const [stopProfit, setStopProfit] = useState(0);

  // ── Refs ──────────────────────────────────────────────────────
  const isMounted = useRef(true);
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);

  // ── Auth check ────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    loadAll();
  }, []); // eslint-disable-line

  // ── Load all data ─────────────────────────────────────────────
  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [assetsRes, balRes, schStatusRes, ordersRes, schLogsRes, ftStatusRes, ftLogsRes] = await Promise.allSettled([
        api.getAssets(),
        api.balance(),
        api.scheduleStatus(),
        api.getOrders(),
        api.scheduleLogs(50),
        api.fastradeStatus(),
        api.fastradeLogs(30),
      ]);
      if (!isMounted.current) return;
      if (assetsRes.status === 'fulfilled') setAssets(assetsRes.value);
      if (balRes.status === 'fulfilled') setBalance(balRes.value);
      if (schStatusRes.status === 'fulfilled') setScheduleStatus(schStatusRes.value);
      if (ordersRes.status === 'fulfilled') setScheduleOrders(ordersRes.value);
      if (schLogsRes.status === 'fulfilled') setScheduleLogs(schLogsRes.value);
      if (ftStatusRes.status === 'fulfilled') setFastradeStatus(ftStatusRes.value);
      if (ftLogsRes.status === 'fulfilled') setFastradeLogs(ftLogsRes.value);
    } catch (e: any) {
      if (e?.status === 401) { router.push('/login'); return; }
    } finally {
      if (!silent && isMounted.current) setIsLoading(false);
    }
  }, []); // eslint-disable-line

  // ── Polling ───────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(async () => {
      const [schRes, ftRes] = await Promise.allSettled([
        api.scheduleStatus(),
        api.fastradeStatus(),
      ]);
      if (!isMounted.current) return;
      if (schRes.status === 'fulfilled') setScheduleStatus(schRes.value);
      if (ftRes.status === 'fulfilled') setFastradeStatus(ftRes.value);

      const currentMode = modeRef.current;
      if (currentMode === 'schedule') {
        const [ordRes, logRes] = await Promise.allSettled([api.getOrders(), api.scheduleLogs(50)]);
        if (!isMounted.current) return;
        if (ordRes.status === 'fulfilled') setScheduleOrders(ordRes.value);
        if (logRes.status === 'fulfilled') setScheduleLogs(logRes.value);
      } else {
        const logRes = await api.fastradeLogs(30).catch(() => null);
        if (!isMounted.current) return;
        if (logRes) setFastradeLogs(logRes);
      }
    }, 5000);
    return () => clearInterval(iv);
  }, []); // eslint-disable-line

  // ── Derived State ─────────────────────────────────────────────
  const scheduleState = (scheduleStatus?.botState as BotState) ?? 'IDLE';
  const isFastradeRunning = fastradeStatus?.isRunning ?? false;
  const isFastradeMode = fastradeStatus?.mode === 'FTT' || fastradeStatus?.mode === 'CTC';

  const blockedModes: TradingMode[] = (() => {
    const b: TradingMode[] = [];
    if (scheduleState === 'RUNNING' || scheduleState === 'PAUSED') { b.push('ftt'); b.push('ctc'); }
    if (isFastradeRunning && fastradeStatus?.mode === 'FTT') { b.push('schedule'); b.push('ctc'); }
    if (isFastradeRunning && fastradeStatus?.mode === 'CTC') { b.push('schedule'); b.push('ftt'); }
    return [...new Set(b)];
  })();

  const isCurrentModeActive = mode === 'schedule'
    ? scheduleState === 'RUNNING' || scheduleState === 'PAUSED'
    : isFastradeRunning && fastradeStatus?.mode === mode.toUpperCase();

  const canStart = mode === 'schedule'
    ? !!(selectedAsset && scheduleOrders.filter(o => !o.isExecuted && !o.isSkipped).length > 0)
    : !!(selectedAsset);

  // ── Actions ───────────────────────────────────────────────────
  const handleStart = async () => {
    if (!selectedAsset) return;
    setIsActionLoading(true); setError(null);
    try {
      if (mode === 'schedule') {
        await api.updateConfig({
          asset: { ric: selectedAsset.ric, name: selectedAsset.name, profitRate: selectedAsset.profitRate, iconUrl: selectedAsset.iconUrl },
          martingale: { ...martingale, isAlwaysSignal: false },
          isDemoAccount, currency: 'IDR', currencyIso: 'IDR',
          duration, stopLoss: stopLoss || undefined, stopProfit: stopProfit || undefined,
        });
        await api.scheduleStart();
      } else {
        await api.fastradeStart({
          mode: mode.toUpperCase() as 'FTT' | 'CTC',
          asset: { ric: selectedAsset.ric, name: selectedAsset.name, profitRate: selectedAsset.profitRate, iconUrl: selectedAsset.iconUrl },
          martingale: { ...martingale, isAlwaysSignal: false } as any,
          isDemoAccount, currency: 'IDR', currencyIso: 'IDR',
          stopLoss: stopLoss || undefined, stopProfit: stopProfit || undefined,
        });
      }
      await loadAll(true);
    } catch (e: any) {
      setError(e?.message ?? 'Gagal memulai bot');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleStop = async () => {
    if (!confirm('Yakin ingin menghentikan bot?')) return;
    setIsActionLoading(true); setError(null);
    try {
      if (mode === 'schedule') await api.scheduleStop();
      else await api.fastradeStop();
      await loadAll(true);
    } catch (e: any) {
      setError(e?.message ?? 'Gagal menghentikan bot');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handlePause = async () => {
    setIsActionLoading(true); setError(null);
    try { await api.schedulePause(); await loadAll(true); }
    catch (e: any) { setError(e?.message ?? 'Gagal menjeda'); }
    finally { setIsActionLoading(false); }
  };

  const handleResume = async () => {
    setIsActionLoading(true); setError(null);
    try { await api.scheduleResume(); await loadAll(true); }
    catch (e: any) { setError(e?.message ?? 'Gagal melanjutkan'); }
    finally { setIsActionLoading(false); }
  };

  const handleAddOrders = async (input: string) => {
    setAddOrderLoading(true);
    try {
      const res = await api.addOrders(input);
      await api.getOrders().then(setScheduleOrders);
      if (res.errors?.length) setError(`${res.added} ditambahkan, ${res.errors.length} error: ${res.errors.join(', ')}`);
    } catch (e: any) {
      setError(e?.message ?? 'Gagal menambah orders');
    } finally {
      setAddOrderLoading(false);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    try {
      await api.deleteOrder(id);
      setScheduleOrders(prev => prev.filter(o => o.id !== id));
    } catch (e: any) {
      setError(e?.message ?? 'Gagal menghapus order');
    }
  };

  const handleModeChange = (m: TradingMode) => {
    if (blockedModes.includes(m)) {
      setError('Hentikan mode yang aktif terlebih dahulu sebelum berpindah mode.');
      return;
    }
    setMode(m);
    setError(null);
  };

  // ═════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════
  if (!token) return null;

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, padding: '0 0 96px' }}>
      {/* Modals */}
      <AssetPickerModal
        isOpen={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        assets={assets}
        selected={selectedAsset?.ric ?? ''}
        onSelect={a => setSelectedAsset({ ric: a.ric, name: a.name, profitRate: a.profitRate, iconUrl: a.iconUrl })}
      />
      <OrderInputModal
        isOpen={orderInputOpen}
        onClose={() => setOrderInputOpen(false)}
        onAdd={handleAddOrders}
        isLoading={addOrderLoading}
      />

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 14px' }}>
        {/* Page Title */}
        <div style={{ padding: '20px 0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: '-0.03em', marginBottom: 2 }}>
              Trading Bot
            </h1>
            <p style={{ fontSize: 11, color: C.muted }}>Stockity Auto Trading Dashboard</p>
          </div>
          <button
            onClick={() => loadAll()}
            style={{ width: 32, height: 32, borderRadius: 10, background: C.faint, border: `1px solid ${C.bdr}`, color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}
          >
            ↻
          </button>
        </div>

        {/* Top bar: clock + balance + pnl */}
        <TopBar
          balance={balance}
          isDemoAccount={isDemoAccount}
          scheduleState={scheduleState}
          fastradeStatus={fastradeStatus}
          mode={mode}
        />

        {/* Mode Selector */}
        <Card style={{ padding: 12, marginBottom: 12 }}>
          <p style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, fontWeight: 700 }}>
            Mode Trading
          </p>
          <ModeSelector
            mode={mode}
            onChange={handleModeChange}
            disabled={isCurrentModeActive}
            blockedModes={blockedModes}
          />
        </Card>

        {/* Main Content: 2 columns on wider screens, stacked on mobile */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Session Status Panel */}
          <Card glow={isCurrentModeActive ? (mode === 'ctc' ? C.violet : C.cyan) : undefined}>
            {mode === 'schedule' ? (
              <OrderList
                orders={scheduleOrders}
                logs={scheduleLogs}
                onAdd={() => setOrderInputOpen(true)}
                onDelete={handleDeleteOrder}
                isRunning={scheduleState === 'RUNNING'}
                isLoading={isLoading}
              />
            ) : (
              <FastradeStatusPanel
                status={fastradeStatus?.mode === mode.toUpperCase() ? fastradeStatus : (isFastradeRunning ? null : fastradeStatus)}
                logs={fastradeLogs.filter(l => l.mode === mode.toUpperCase())}
                mode={mode as 'ftt' | 'ctc'}
                isLoading={isLoading}
              />
            )}
          </Card>

          {/* Settings */}
          <Card>
            <div style={{ padding: '12px 16px 0', borderBottom: `1px solid ${C.bdr}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Pengaturan</p>
              {isCurrentModeActive && (
                <span style={{ fontSize: 10, color: C.muted, background: C.faint, padding: '3px 8px', borderRadius: 6 }}>
                  🔒 Terkunci saat bot aktif
                </span>
              )}
            </div>
            <SettingsPanel
              asset={selectedAsset}
              amount={amount}
              isDemoAccount={isDemoAccount}
              duration={duration}
              martingale={martingale}
              stopLoss={stopLoss}
              stopProfit={stopProfit}
              mode={mode}
              onOpenAssetPicker={() => setAssetPickerOpen(true)}
              onAmountChange={v => { setAmount(v); setMartingale(prev => ({ ...prev, baseAmount: v })); }}
              onDemoChange={setIsDemoAccount}
              onDurationChange={setDuration}
              onMartingaleChange={setMartingale}
              onStopLossChange={setStopLoss}
              onStopProfitChange={setStopProfit}
              disabled={isCurrentModeActive}
            />
          </Card>

          {/* Control Bar */}
          <Card style={{ padding: 16 }}>
            <ControlBar
              mode={mode}
              scheduleState={scheduleState}
              fastradeStatus={fastradeStatus}
              canStart={canStart}
              isLoading={isActionLoading}
              onStart={handleStart}
              onStop={handleStop}
              onPause={handlePause}
              onResume={handleResume}
              error={error}
            />
          </Card>

          {/* CTC info panel */}
          {mode === 'ctc' && !isCurrentModeActive && (
            <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.18)', display: 'flex', gap: 10 }}>
              <span style={{ fontSize: 18 }}>🔄</span>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: C.violet, marginBottom: 4 }}>Cara Kerja CTC</p>
                <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                  Bot membaca 2 candle 1m berturut-turut → menentukan CALL/PUT dari perubahan harga.
                  WIN: lanjut arah sama tanpa tunggu candle baru.
                  LOSE dengan martingale: balik arah, naikkan amount.
                  LOSE tanpa martingale: lanjut arah sama.
                </p>
              </div>
            </div>
          )}

          {mode === 'ftt' && !isCurrentModeActive && (
            <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(52,211,153,0.04)', border: `1px solid ${C.bdr}`, display: 'flex', gap: 10 }}>
              <span style={{ fontSize: 18 }}>⚡</span>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: C.cyan, marginBottom: 4 }}>Cara Kerja FTT</p>
                <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                  Sama dengan CTC, tapi LOSE tanpa martingale akan menunggu 2 menit sebelum cycle baru dimulai.
                  WIN: lanjut arah sama langsung.
                  LOSE dengan martingale: arah sama, naikkan amount.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}