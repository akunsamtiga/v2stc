'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Order } from '@/types';

export default function OrdersPage() {
  const [orders,     setOrders]     = useState<Order[]>([]);
  const [input,      setInput]      = useState('');
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg,        setMsg]        = useState('');
  const [preview,    setPreview]    = useState<{ orders: Order[]; errors: string[] } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getOrders();
      setOrders(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePreview = async () => {
    if (!input.trim()) return;
    try {
      const res = await api.parseOrders(input.trim());
      setPreview(res);
    } catch (e: unknown) {
      setMsg(`✗ ${e instanceof Error ? e.message : 'Gagal parse'}`);
    }
  };

  const handleAdd = async () => {
    if (!input.trim()) return;
    setSubmitting(true); setMsg(''); setPreview(null);
    try {
      const res = await api.addOrders(input.trim());
      setMsg(`✓ ${res.added ?? 0} order ditambahkan${res.errors?.length ? ` | ⚠ ${res.errors.join(', ')}` : ''}`);
      setInput('');
      await load();
    } catch (e: unknown) {
      setMsg(`✗ ${e instanceof Error ? e.message : 'Gagal'}`);
    } finally { setSubmitting(false); }
  };

  const deleteOrder = async (id: string) => {
    try { await api.deleteOrder(id); await load(); }
    catch (e: unknown) { setMsg(`✗ ${e instanceof Error ? e.message : 'Gagal hapus'}`); }
  };

  const clearAll = async () => {
    if (!confirm('Hapus semua orders? Tindakan ini tidak bisa dibatalkan.')) return;
    try { await api.clearOrders(); await load(); setMsg('✓ Semua order dihapus'); }
    catch (e: unknown) { setMsg(`✗ ${e instanceof Error ? e.message : 'Gagal'}`); }
  };

  const pending  = orders.filter(o => !o.isExecuted && !o.isSkipped).length;
  const executed = orders.filter(o => o.isExecuted).length;
  const skipped  = orders.filter(o => o.isSkipped).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Orders</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {orders.length} total ·
            <span className="text-yellow-400"> {pending} pending</span> ·
            <span className="text-blue-400"> {executed} executed</span> ·
            <span className="text-gray-500"> {skipped} skipped</span>
          </p>
        </div>
        {orders.length > 0 && (
          <button
            onClick={clearAll}
            className="px-3 py-1.5 text-sm rounded-xl bg-red-500/10 text-red-400
                       border border-red-500/20 hover:bg-red-500/20 transition-colors shrink-0"
          >
            Hapus Semua
          </button>
        )}
      </div>

      {/* Add Orders */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-300 mb-1">Tambah Orders</p>
          <p className="text-xs text-gray-600">Format per baris: <code className="text-green-500 bg-gray-800 px-1 rounded">HH:MM UP</code> atau <code className="text-red-500 bg-gray-800 px-1 rounded">HH:MM DOWN</code></p>
        </div>
        <textarea
          value={input}
          onChange={e => { setInput(e.target.value); setPreview(null); }}
          placeholder={'09:00 UP\n09:30 DOWN\n10:00 UP\n10:30 DOWN'}
          rows={6}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-3 text-sm
                     text-white placeholder-gray-700 font-mono focus:outline-none
                     focus:border-green-500 focus:ring-1 focus:ring-green-500/20
                     resize-y transition-all"
        />

        {/* Preview */}
        {preview && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-xs space-y-1">
            <p className="text-gray-400 font-semibold">Preview ({preview.orders.length} orders):</p>
            {preview.orders.slice(0, 5).map((o, i) => (
              <p key={i} className="font-mono">
                <span className="text-gray-500">{o.time}</span>
                <span className={o.trend === 'UP' ? ' text-green-400' : ' text-red-400'}> {o.trend}</span>
              </p>
            ))}
            {preview.orders.length > 5 && <p className="text-gray-600">+ {preview.orders.length - 5} lainnya...</p>}
            {preview.errors.length > 0 && (
              <p className="text-yellow-500">⚠ Error: {preview.errors.join(', ')}</p>
            )}
          </div>
        )}

        {msg && (
          <p className={`text-sm ${msg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={handlePreview}
            disabled={!input.trim()}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-gray-700 hover:bg-gray-600
                       disabled:opacity-40 text-gray-300 transition-colors"
          >
            Preview
          </button>
          <button
            onClick={handleAdd}
            disabled={submitting || !input.trim()}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-green-500 hover:bg-green-400
                       disabled:opacity-40 text-white transition-colors"
          >
            {submitting ? 'Menambahkan...' : 'Tambah Orders'}
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {loading ? (
          <p className="text-center text-gray-600 text-sm py-10 animate-pulse">Memuat orders...</p>
        ) : orders.length === 0 ? (
          <p className="text-center text-gray-600 text-sm py-10">Belum ada orders</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/80">
                {['Waktu', 'Trend', 'Status', 'Martingale', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id} className="border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-gray-300 text-sm">{order.time}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold
                      ${order.trend === 'UP'
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                      {order.trend === 'UP' ? '↑ UP' : '↓ DOWN'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {order.isExecuted ? (
                      <span className="text-blue-400 text-xs font-medium">✓ Executed</span>
                    ) : order.isSkipped ? (
                      <span className="text-gray-500 text-xs">⊘ Skipped</span>
                    ) : (
                      <span className="text-yellow-400 text-xs font-medium">◎ Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {order.martingaleState?.isActive
                      ? `Step ${order.martingaleState.currentStep}/${order.martingaleState.maxSteps}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!order.isExecuted && (
                      <button
                        onClick={() => deleteOrder(order.id)}
                        className="text-gray-700 hover:text-red-400 transition-colors text-xs px-1"
                      >✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
