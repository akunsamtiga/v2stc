'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, type ExecutionLog, type FastradeLog, type IndicatorLog, type MomentumLog, type ScheduleStatus, type FastradeStatus } from '@/lib/api';
import {
  ArrowLeft, Calendar, TrendingUp, TrendingDown, Filter,
  ChevronDown, History, RotateCcw, X,
  ArrowUpRight, ArrowDownRight, Minus, BarChart3
} from 'lucide-react';
import Link from 'next/link';

// ═══════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════
const C = {
  bg:    '#0f0f0f',
  card:  '#1e5c3c',
  card2: '#134529',
  bdr:   'rgba(52,211,153,0.28)',
  bdrAct:'rgba(52,211,153,0.60)',
  cyan:  '#34d399',
  cyand: 'rgba(52,211,153,0.15)',
  coral: '#f87171',
  cord:  'rgba(248,113,113,0.12)',
  amber: '#fbbf24',
  ambd:  'rgba(251,191,36,0.10)',
  violet:'#a78bfa',
  vltd:  'rgba(167,139,250,0.10)',
  text:  '#ffffff',
  sub:   'rgba(255,255,255,0.95)',
  muted: 'rgba(255,255,255,0.65)',
  faint: 'rgba(52,211,153,0.10)',
};

type LogType = 'all' | 'schedule' | 'fastrade' | 'ctc' | 'indicator' | 'momentum';
type ResultFilter = 'all' | 'win' | 'loss' | 'draw';

interface CombinedLog {
  id: string;
  type: 'schedule' | 'fastrade' | 'ctc' | 'indicator' | 'momentum';
  time: string;
  trend: 'call' | 'put';
  amount: number;
  result?: 'WIN' | 'LOSE' | 'DRAW' | 'LOSS';
  profit?: number;
  martingaleStep?: number;
  executedAt: number;
  note?: string;
}

// ═══════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════
const Card: React.FC<{children: React.ReactNode; style?: React.CSSProperties; className?: string}> =
({children, style, className = ''}) => (
  <div className={`ds-card overflow-hidden ${className}`} style={{
    boxShadow: '0 4px 18px rgba(52,211,153,0.05), 0 2px 8px rgba(0,0,0,0.3)',
    ...style,
  }}>{children}</div>
);

const StatusBadge: React.FC<{result?: string}> = ({result}) => {
  if (!result) return <span style={{fontSize: 11, color: C.muted}}>—</span>;
  
  const isWin = result === 'WIN';
  const isLoss = result === 'LOSE' || result === 'LOSS';
  const isDraw = result === 'DRAW';
  
  const col = isWin ? C.cyan : isLoss ? C.coral : C.amber;
  const bg = isWin ? 'rgba(52,211,153,0.12)' : isLoss ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)';
  
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
      color: col, background: bg, border: `1px solid ${col}30`,
      textTransform: 'uppercase', letterSpacing: '0.08em'
    }}>
      {isWin ? 'WIN' : isLoss ? 'LOSS' : 'DRAW'}
    </span>
  );
};

const TrendBadge: React.FC<{trend: string}> = ({trend}) => {
  const isCall = trend === 'call';
  const col = isCall ? C.cyan : C.coral;
  return (
    <span style={{
      display: 'flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, color: col,
    }}>
      {isCall ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {isCall ? 'CALL' : 'PUT'}
    </span>
  );
};

const TypeBadge: React.FC<{type: string}> = ({type}) => {
  const isCTC       = type === 'ctc';
  const isIndicator = type === 'indicator';
  const isMomentum  = type === 'momentum';
  const col = isCTC ? C.violet : isIndicator ? C.amber : isMomentum ? '#60a5fa' : C.cyan;
  const bg  = isCTC ? 'rgba(167,139,250,0.12)' : isIndicator ? 'rgba(251,191,36,0.12)' : isMomentum ? 'rgba(96,165,250,0.12)' : 'rgba(52,211,153,0.12)';
  const label = type === 'schedule' ? 'Signal' : isCTC ? 'CTC' : isIndicator ? 'Indicator' : isMomentum ? 'Momentum' : 'FastTrade';
  return (
    <span style={{
      display: 'flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 500, color: col,
      padding: '2px 8px', borderRadius: 6,
      background: bg, border: `1px solid ${col}25`,
    }}>
      {label}
    </span>
  );
};

const FilterChip: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
  accent?: string;
}> = ({label, active, onClick, accent = C.cyan}) => (
  <button
    onClick={onClick}
    style={{
      padding: '6px 14px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: active ? `${accent}18` : 'rgba(255,255,255,0.04)',
      border: `1px solid ${active ? accent : 'rgba(255,255,255,0.1)'}`,
      color: active ? accent : C.muted,
      cursor: 'pointer', transition: 'all 0.2s',
    }}
  >
    {label}
  </button>
);

const StatCard: React.FC<{
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
  icon?: React.ReactNode;
}> = ({label, value, subValue, color = C.cyan, icon}) => (
  <Card style={{padding: '14px 16px'}}>
    <div style={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between'}}>
      <div>
        <p style={{fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, marginBottom: 6}}>
          {label}
        </p>
        <p style={{fontSize: 20, fontWeight: 700, color: color, letterSpacing: '-0.02em'}}>
          {value}
        </p>
        {subValue && (
          <p style={{fontSize: 10, color: C.muted, marginTop: 4}}>{subValue}</p>
        )}
      </div>
      {icon && (
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}15`, border: `1px solid ${color}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: color,
        }}>
          {icon}
        </div>
      )}
    </div>
  </Card>
);

// ═══════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════
export default function HistoryPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<CombinedLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<CombinedLog[]>([]);
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<LogType>('all');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Stats
  const [stats, setStats] = useState({
    totalTrades: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    totalPnL: 0,
    winRate: 0,
  });

  // Check auth
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('stc_token') : null;
    if (!token) {
      router.push('/login');
      return;
    }
    loadHistory();
  }, []);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const [scheduleLogs, fastradeLogs, indicatorLogs, momentumLogs] = await Promise.all([
        api.scheduleLogs(200).catch(() => [] as ExecutionLog[]),
        api.fastradeLogs(200).catch(() => [] as FastradeLog[]),
        api.indicatorLogs(200).catch(() => [] as IndicatorLog[]),
        api.momentumLogs(200).catch(() => [] as MomentumLog[]),
      ]);

      // Combine and format logs
      const combined: CombinedLog[] = [
        ...scheduleLogs.map((log): CombinedLog => ({
          id: log.id,
          type: 'schedule',
          time: log.time || '--:--',
          trend: (log.trend as 'call' | 'put') || 'call',
          amount: log.amount || 0,
          result: log.result as 'WIN' | 'LOSE' | 'DRAW' | 'LOSS',
          profit: log.profit,
          martingaleStep: log.martingaleStep,
          executedAt: log.executedAt || Date.now(),
          note: log.note,
        })),
        ...fastradeLogs.map((log): CombinedLog => ({
          id: log.id,
          type: log.mode === 'CTC' ? 'ctc' : 'fastrade',
          time: new Date(log.executedAt).toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'}),
          trend: (log.trend as 'call' | 'put') || 'call',
          amount: log.amount || 0,
          result: log.result as 'WIN' | 'LOSE' | 'DRAW' | 'LOSS',
          profit: log.profit,
          martingaleStep: log.martingaleStep,
          executedAt: log.executedAt,
          note: log.note,
        })),
        ...indicatorLogs.map((log): CombinedLog => ({
          id: log.id,
          type: 'indicator',
          time: new Date(log.executedAt).toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'}),
          trend: (log.trend as 'call' | 'put') || 'call',
          amount: log.amount || 0,
          result: log.result as 'WIN' | 'LOSE' | 'DRAW' | 'LOSS',
          profit: log.profit,
          martingaleStep: log.martingaleStep,
          executedAt: log.executedAt,
          note: log.note ?? log.indicatorType,
        })),
        ...momentumLogs.map((log): CombinedLog => ({
          id: log.id,
          type: 'momentum',
          time: new Date(log.executedAt).toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'}),
          trend: (log.trend as 'call' | 'put') || 'call',
          amount: log.amount || 0,
          result: log.result as 'WIN' | 'LOSE' | 'DRAW' | 'LOSS',
          profit: log.profit,
          martingaleStep: log.martingaleStep,
          executedAt: log.executedAt,
          note: log.note ?? log.momentumType,
        })),
      ];

      // Deduplicate by id — safety net untuk log lama di Firebase yang mungkin masih duplikat.
      // Entry dengan result (WIN/LOSE/DRAW) diprioritaskan atas entry tanpa result ("—").
      const dedupMap = new Map<string, CombinedLog>();
      for (const log of combined) {
        const existing = dedupMap.get(log.id);
        if (!existing || (!existing.result && log.result)) {
          dedupMap.set(log.id, log);
        }
      }
      const deduped = Array.from(dedupMap.values());

      // Sort by executedAt descending
      deduped.sort((a, b) => b.executedAt - a.executedAt);
      
      setLogs(deduped);
      calculateStats(deduped);
    } catch (err: any) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const calculateStats = (allLogs: CombinedLog[]) => {
    const completed = allLogs.filter(l => l.result);
    const wins = completed.filter(l => l.result === 'WIN').length;
    const losses = completed.filter(l => l.result === 'LOSE' || l.result === 'LOSS').length;
    const draws = completed.filter(l => l.result === 'DRAW').length;
    // totalPnL langsung dari profit (sudah dalam IDR)
    const totalPnL = allLogs.reduce((sum, l) => sum + (l.profit || 0), 0);
    
    setStats({
      totalTrades: completed.length,
      wins,
      losses,
      draws,
      totalPnL,
      winRate: completed.length > 0 ? Math.round((wins / completed.length) * 100) : 0,
    });
  };

  // Apply filters
  useEffect(() => {
    let filtered = [...logs];
    
    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(l => l.type === typeFilter);
    }
    
    // Result filter
    if (resultFilter !== 'all') {
      if (resultFilter === 'win') {
        filtered = filtered.filter(l => l.result === 'WIN');
      } else if (resultFilter === 'loss') {
        filtered = filtered.filter(l => l.result === 'LOSE' || l.result === 'LOSS');
      } else if (resultFilter === 'draw') {
        filtered = filtered.filter(l => l.result === 'DRAW');
      }
    }
    
    // Date filter
    if (dateFilter !== 'all') {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      if (dateFilter === 'today') {
        filtered = filtered.filter(l => now - l.executedAt < dayMs);
      } else if (dateFilter === 'week') {
        filtered = filtered.filter(l => now - l.executedAt < 7 * dayMs);
      } else if (dateFilter === 'month') {
        filtered = filtered.filter(l => now - l.executedAt < 30 * dayMs);
      }
    }
    
    setFilteredLogs(filtered);
  }, [logs, typeFilter, resultFilter, dateFilter]);

  // Amount sudah dalam IDR langsung dari API (bukan cents)
  const formatAmount = (amount?: number) => {
    if (!amount) return '0';
    return Math.abs(amount).toLocaleString('id-ID');
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: '2-digit'});
  };

  return (
    <div style={{minHeight: '100dvh', background: C.bg, paddingBottom: 100}}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(15,15,15,0.95)', backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${C.bdr}`,
      }}>
        <div style={{maxWidth: 1280, margin: '0 auto', padding: '16px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <Link href="/dashboard" style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.bdr}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.muted,
            }}>
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 style={{fontSize: 18, fontWeight: 700, color: C.text}}>Riwayat Trading</h1>
              <p style={{fontSize: 11, color: C.muted}}>{filteredLogs.length} transaksi</p>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                marginLeft: 'auto',
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 99,
                background: showFilters ? `${C.cyan}15` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${showFilters ? C.cyan : C.bdr}`,
                color: showFilters ? C.cyan : C.muted,
                fontSize: 11, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Filter size={14} />
              Filter
              {(typeFilter !== 'all' || resultFilter !== 'all' || dateFilter !== 'all') && (
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: C.cyan,
                }} />
              )}
            </button>
          </div>
        </div>
      </div>

      <div style={{maxWidth: 1280, margin: '0 auto', padding: '16px'}}>
        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
          marginBottom: 20,
        }}>
          <StatCard
            label="Total Trade"
            value={stats.totalTrades}
            subValue={`${stats.wins}W / ${stats.losses}L${stats.draws > 0 ? ` / ${stats.draws}D` : ''}`}
            color={C.cyan}
            icon={<BarChart3 size={18} />}
          />
          <StatCard
            label="Win Rate"
            value={`${stats.winRate}%`}
            subValue={stats.totalPnL >= 0 ? `+${stats.totalPnL.toLocaleString('id-ID')}` : stats.totalPnL.toLocaleString('id-ID')}
            color={stats.winRate >= 50 ? C.cyan : C.coral}
            icon={stats.winRate >= 50 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
          />
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <Card style={{padding: 16, marginBottom: 16}}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
              <span style={{fontSize: 12, fontWeight: 600, color: C.sub}}>Filter</span>
              <button
                onClick={() => {
                  setTypeFilter('all');
                  setResultFilter('all');
                  setDateFilter('all');
                }}
                style={{
                  fontSize: 10, color: C.coral, background: 'transparent',
                  border: 'none', cursor: 'pointer',
                }}
              >
                Reset
              </button>
            </div>
            
            {/* Type Filter */}
            <div style={{marginBottom: 14}}>
              <p style={{fontSize: 10, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em'}}>
                Tipe
              </p>
              <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
                <FilterChip label="Semua" active={typeFilter === 'all'} onClick={() => setTypeFilter('all')} />
                <FilterChip label="Signal" active={typeFilter === 'schedule'} onClick={() => setTypeFilter('schedule')} accent={C.cyan} />
                <FilterChip label="FastTrade" active={typeFilter === 'fastrade'} onClick={() => setTypeFilter('fastrade')} accent={C.cyan} />
                <FilterChip label="CTC" active={typeFilter === 'ctc'} onClick={() => setTypeFilter('ctc')} accent={C.violet} />
                <FilterChip label="Indicator" active={typeFilter === 'indicator'} onClick={() => setTypeFilter('indicator')} accent={C.amber} />
                <FilterChip label="Momentum" active={typeFilter === 'momentum'} onClick={() => setTypeFilter('momentum')} accent="#60a5fa" />
              </div>
            </div>
            
            {/* Result Filter */}
            <div style={{marginBottom: 14}}>
              <p style={{fontSize: 10, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em'}}>
                Hasil
              </p>
              <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
                <FilterChip label="Semua" active={resultFilter === 'all'} onClick={() => setResultFilter('all')} />
                <FilterChip label="Win" active={resultFilter === 'win'} onClick={() => setResultFilter('win')} accent={C.cyan} />
                <FilterChip label="Loss" active={resultFilter === 'loss'} onClick={() => setResultFilter('loss')} accent={C.coral} />
                <FilterChip label="Draw" active={resultFilter === 'draw'} onClick={() => setResultFilter('draw')} accent={C.amber} />
              </div>
            </div>
            
            {/* Date Filter */}
            <div>
              <p style={{fontSize: 10, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em'}}>
                Periode
              </p>
              <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
                <FilterChip label="Semua" active={dateFilter === 'all'} onClick={() => setDateFilter('all')} />
                <FilterChip label="Hari Ini" active={dateFilter === 'today'} onClick={() => setDateFilter('today')} />
                <FilterChip label="7 Hari" active={dateFilter === 'week'} onClick={() => setDateFilter('week')} />
                <FilterChip label="30 Hari" active={dateFilter === 'month'} onClick={() => setDateFilter('month')} />
              </div>
            </div>
          </Card>
        )}

        {/* Logs List */}
        <Card>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', borderBottom: `1px solid ${C.bdr}`,
          }}>
            <span style={{fontSize: 12, fontWeight: 600, color: C.sub}}>Daftar Transaksi</span>
            <button
              onClick={loadHistory}
              disabled={isLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8,
                background: 'rgba(52,211,153,0.08)', border: `1px solid ${C.bdr}`,
                color: C.cyan, fontSize: 11, fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              <RotateCcw size={12} style={{animation: isLoading ? 'spin 1s linear infinite' : 'none'}} />
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div style={{padding: 40, textAlign: 'center'}}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                border: '2px solid rgba(52,211,153,0.2)',
                borderTopColor: C.cyan,
                margin: '0 auto 12px',
                animation: 'spin 1s linear infinite',
              }} />
              <p style={{fontSize: 12, color: C.muted}}>Memuat riwayat...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{padding: 50, textAlign: 'center'}}>
              <History size={40} style={{color: C.muted, opacity: 0.3, marginBottom: 12}} />
              <p style={{fontSize: 14, color: C.muted, marginBottom: 4}}>Tidak ada transaksi</p>
              <p style={{fontSize: 11, color: 'rgba(255,255,255,0.3)'}}>
                {logs.length > 0 ? 'Coba ubah filter' : 'Mulai trading untuk melihat riwayat'}
              </p>
            </div>
          ) : (
            <div>
              {filteredLogs.map((log, idx) => (
                <div
                  key={log.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px',
                    borderBottom: idx < filteredLogs.length - 1 ? `1px solid ${C.bdr}` : 'none',
                    background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                  }}
                >
                  {/* Time & Date */}
                  <div style={{minWidth: 55}}>
                    <p style={{fontSize: 13, fontWeight: 600, color: C.text, fontFamily: 'monospace'}}>
                      {log.time}
                    </p>
                    <p style={{fontSize: 9, color: C.muted, marginTop: 2}}>
                      {formatDate(log.executedAt)}
                    </p>
                  </div>

                  {/* Type */}
                  <TypeBadge type={log.type} />

                  {/* Trend */}
                  <TrendBadge trend={log.trend} />

                  {/* Amount */}
                  <div style={{flex: 1, textAlign: 'right'}}>
                    <p style={{fontSize: 12, fontWeight: 600, color: C.text}}>
                      Rp {formatAmount(log.amount)}
                    </p>
                    {log.martingaleStep !== undefined && log.martingaleStep > 0 && (
                      <p style={{fontSize: 9, color: C.amber, marginTop: 2}}>
                        Step {log.martingaleStep}
                      </p>
                    )}
                  </div>

                  {/* Result */}
                  <div style={{minWidth: 70, textAlign: 'right'}}>
                    <StatusBadge result={log.result} />
                    {log.profit !== undefined && log.result && (
                      <p style={{
                        fontSize: 10, fontWeight: 600, marginTop: 4,
                        // FIX: profit in cents → divide by 100
                        color: log.profit >= 0 ? C.cyan : C.coral,
                      }}>
                        {log.profit >= 0 ? '+' : ''}{formatAmount(log.profit)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}