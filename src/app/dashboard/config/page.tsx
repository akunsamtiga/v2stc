'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { ScheduleConfig } from '@/types';

export default function ConfigPage() {
  const [raw,     setRaw]     = useState('');
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');
  const [valid,   setValid]   = useState(true);

  useEffect(() => {
    api.getConfig()
      .then(data  => { setRaw(JSON.stringify(data, null, 2)); })
      .catch(e    => setMsg(`✗ ${e.message}`))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (val: string) => {
    setRaw(val);
    try { JSON.parse(val); setValid(true); }
    catch { setValid(false); }
  };

  const save = async () => {
    if (!valid) { setMsg('✗ JSON tidak valid'); return; }
    setSaving(true); setMsg('');
    try {
      const parsed  = JSON.parse(raw) as ScheduleConfig;
      const updated = await api.updateConfig(parsed);
      setRaw(JSON.stringify(updated, null, 2));
      setMsg('✓ Config berhasil disimpan');
    } catch (e: unknown) {
      setMsg(`✗ ${e instanceof Error ? e.message : 'Gagal'}`);
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Config</h2>
        <p className="text-sm text-gray-500 mt-0.5">Konfigurasi parameter jadwal dan trading</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-300">Schedule Config</p>
          <div className="flex items-center gap-2">
            {!valid && <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md">✗ JSON invalid</span>}
            {valid  && raw && <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-md">✓ Valid JSON</span>}
          </div>
        </div>

        {loading ? (
          <div className="h-48 bg-gray-800/50 rounded-xl animate-pulse" />
        ) : (
          <textarea
            value={raw}
            onChange={e => handleChange(e.target.value)}
            rows={22}
            spellCheck={false}
            className={`w-full bg-gray-800/80 border rounded-xl px-3.5 py-3 text-sm
                        text-green-300 font-mono focus:outline-none resize-y transition-all
                        ${valid
                          ? 'border-gray-700 focus:border-green-500 focus:ring-1 focus:ring-green-500/20'
                          : 'border-red-500/50 focus:border-red-500'}`}
          />
        )}

        {msg && (
          <p className={`text-sm ${msg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>
        )}

        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saving || !valid || loading}
            className="px-5 py-2 bg-green-500 hover:bg-green-400 disabled:opacity-40
                       text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? 'Menyimpan...' : 'Simpan Config'}
          </button>
        </div>
      </div>
    </div>
  );
}
