'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { api, type ExecutionLog } from '@/lib/api';

function fmtTime(ms?: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', hour12: false,
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function LogsPage() {
  const [logs,        setLogs]        = useState<ExecutionLog[]>([]);
  const [limit,       setLimit]       = useState(50);
  const [loading,     setLoading]     = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.scheduleLogs(limit);
      setLogs(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (autoRefresh) { timerRef.current = setInterval(load, 5000); }
    else { if (timerRef.current) clearInterval(timerRef.current); }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, load]);

  const wins        = logs.filter(l => l.result === 'WIN').length;
  const losses      = logs.filter(l => l.result === 'LOSS').length;
  const totalProfit = logs.reduce((s, l) => s + (l.profit ?? 0), 0);
  const winRate     = (wins + losses) > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '—';

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Logs</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {logs.length} entries ·
            <span className="text-green-400"> {wins}W</span> /
            <span className="text-red-400"> {losses}L</span> ·
            WR: {winRate}% ·
            Profit: <span className={totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
              {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Limit */}
          <select
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-xl
                       px-3 py-1.5 focus:outline-none focus:border-gray-600 cursor-pointer"
          >
            {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n} entries</option>)}
          </select>

          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-xl border transition-all ${
              autoRefresh
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-gray-800 border-gray-700 text-gray-400'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
            Auto
          </button>

          {/* Manual refresh */}
          <button
            onClick={load}
            className="px-3 py-1.5 text-sm rounded-xl bg-gray-800 border border-gray-700
                       text-gray-400 hover:text-white transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {loading ? (
          <p className="text-center text-gray-600 text-sm py-12 animate-pulse">Memuat logs...</p>
        ) : logs.length === 0 ? (
          <p className="text-center text-gray-600 text-sm py-12">Belum ada log eksekusi</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/80">
                  {['Waktu Eksekusi', 'Jadwal', 'Trend', 'Amount', 'Result', 'Profit', 'Info'].map(h => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{fmtTime(log.executedAt)}</td>
                    <td className="px-4 py-3 font-mono text-gray-300">{log.time ?? '—'}</td>
                    <td className="px-4 py-3">
                      {log.trend ? (
                        <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                          log.trend === 'UP' || log.trend === 'call'
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {log.trend === 'UP' || log.trend === 'call' ? '↑' : '↓'} {log.trend.toUpperCase()}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-300 tabular-nums">{log.amount ?? '—'}</td>
                    <td className="px-4 py-3">
                      {log.result === 'WIN'     && <span className="text-green-400 font-semibold text-xs">✓ WIN</span>}
                      {log.result === 'LOSS'    && <span className="text-red-400 font-semibold text-xs">✗ LOSS</span>}
                      {log.result === 'PENDING' && <span className="text-yellow-400 text-xs">◎ PENDING</span>}
                      {!log.result              && '—'}
                    </td>
                    <td className={`px-4 py-3 text-sm font-semibold tabular-nums ${
                      (log.profit ?? 0) > 0 ? 'text-green-400'
                      : (log.profit ?? 0) < 0 ? 'text-red-400'
                      : 'text-gray-600'
                    }`}>
                      {log.profit !== undefined
                        ? `${log.profit > 0 ? '+' : ''}${log.profit.toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">{log.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}