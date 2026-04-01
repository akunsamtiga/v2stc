'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { ScheduleConfig, StockityAsset } from '@/types';

// ── helpers ──────────────────────────────────────────────────────────
function calcNextAmount(base: number, step: number, type: 'FIXED' | 'PERCENTAGE', value: number): number {
  if (step === 0) return base;
  if (type === 'FIXED') return base + value * step;
  let amt = base;
  for (let i = 0; i < step; i++) amt = amt * (1 + value / 100);
  return amt;
}

// ── sub-components ───────────────────────────────────────────────────
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
                  ${checked ? 'bg-green-500' : 'bg-gray-700'}`}
      aria-label={label}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                        ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      <p className="text-sm font-bold text-white tracking-tight">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</label>
        {hint && <span className="text-[10px] text-gray-600">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputCls = `w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm
                  text-white placeholder-gray-600 focus:outline-none focus:border-green-500
                  focus:ring-1 focus:ring-green-500/20 transition-all`;

// ── default config ────────────────────────────────────────────────────
const DEFAULT_CONFIG: ScheduleConfig = {
  asset: { ric: '', name: '', profitRate: undefined },
  martingale: {
    isEnabled: false,
    maxSteps: 3,
    baseAmount: 10000,
    multiplierValue: 2,
    multiplierType: 'FIXED',
    isAlwaysSignal: false,
  },
  isDemoAccount: true,
  currency: 'IDR',
  currencyIso: 'IDR',
};

// ── main component ────────────────────────────────────────────────────
export default function ConfigPage() {
  const [cfg,     setCfg]     = useState<ScheduleConfig>(DEFAULT_CONFIG as unknown as ScheduleConfig);
  const [assets,  setAssets]  = useState<StockityAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [assetLoading, setAssetLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [showAssetList, setShowAssetList] = useState(false);

  // typed accessors
  const asset      = (cfg as any).asset       ?? {};
  const mg         = (cfg as any).martingale  ?? {};
  const isDemo     = (cfg as any).isDemoAccount ?? true;
  const currency   = (cfg as any).currency    ?? 'IDR';
  const currencyIso = (cfg as any).currencyIso ?? 'IDR';

  const setField = (path: string[], value: unknown) => {
    setCfg(prev => {
      const next = structuredClone(prev) as Record<string, unknown>;
      let cur = next;
      for (let i = 0; i < path.length - 1; i++) {
        if (!cur[path[i]]) cur[path[i]] = {};
        cur = cur[path[i]] as Record<string, unknown>;
      }
      cur[path[path.length - 1]] = value;
      return next as ScheduleConfig;
    });
  };

  const load = useCallback(async () => {
    try {
      const data = await api.getConfig();
      if (data && Object.keys(data).length > 0) setCfg(data);
    } catch { /* use default */ }
    finally { setLoading(false); }
  }, []);

  const loadAssets = useCallback(async () => {
    setAssetLoading(true);
    try {
      const data = await api.getAssets();
      setAssets(Array.isArray(data) ? data : []);
    } catch { setAssets([]); }
    finally { setAssetLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!asset.ric) { setMsg('✗ Pilih asset terlebih dahulu'); return; }
    setSaving(true); setMsg('');
    try {
      await api.updateConfig(cfg);
      setMsg('✓ Konfigurasi berhasil disimpan');
    } catch (e: unknown) {
      setMsg(`✗ ${e instanceof Error ? e.message : 'Gagal menyimpan'}`);
    } finally { setSaving(false); }
  };

  const filteredAssets = assets.filter(a =>
    a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
    a.ric.toLowerCase().includes(assetSearch.toLowerCase())
  );

  // martingale preview
  const mgSteps = Array.from({ length: mg.maxSteps ?? 3 }, (_, i) => ({
    step: i + 1,
    amount: calcNextAmount(mg.baseAmount ?? 10000, i, mg.multiplierType ?? 'FIXED', mg.multiplierValue ?? 2),
  }));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-gray-600 text-sm">
        <span className="w-4 h-4 border-2 border-gray-700 border-t-gray-500 rounded-full animate-spin" />
        Memuat konfigurasi...
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Konfigurasi Trading</h2>
        <p className="text-sm text-gray-500 mt-0.5">Pengaturan asset, akun, amount, dan martingale</p>
      </div>

      {/* ── 1. Asset ── */}
      <Section title="Asset">
        {/* Current selection */}
        <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                         ${asset.ric ? 'bg-green-500/5 border-green-500/20' : 'bg-gray-800/50 border-gray-700'}`}>
          {asset.ric ? (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{asset.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {asset.ric}
                  {asset.typeName && <span className="ml-2 text-gray-600">· {asset.typeName}</span>}
                  {asset.profitRate != null && (
                    <span className="ml-2 text-green-400 font-semibold">· {asset.profitRate}% profit</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => { setShowAssetList(true); loadAssets(); }}
                className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-gray-700 shrink-0"
              >
                Ganti
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-600 flex-1">Belum ada asset dipilih</p>
          )}
          {!asset.ric && (
            <button
              onClick={() => { setShowAssetList(true); loadAssets(); }}
              className="px-3 py-1.5 text-sm font-semibold rounded-xl bg-green-500 hover:bg-green-400
                         text-white transition-colors shrink-0"
            >
              Pilih Asset
            </button>
          )}
        </div>

        {/* Asset List Panel */}
        {showAssetList && (
          <div className="border border-gray-700 rounded-xl overflow-hidden">
            <div className="p-3 border-b border-gray-700 bg-gray-800/50">
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={assetSearch}
                  onChange={e => setAssetSearch(e.target.value)}
                  placeholder="Cari nama atau RIC asset..."
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm
                             text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-all"
                />
                <button
                  onClick={() => { setShowAssetList(false); setAssetSearch(''); }}
                  className="text-gray-500 hover:text-white px-2 py-1.5 transition-colors text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-gray-800">
              {assetLoading ? (
                <div className="py-8 text-center text-gray-600 text-sm animate-pulse">Memuat assets...</div>
              ) : filteredAssets.length === 0 ? (
                <div className="py-8 text-center text-gray-600 text-sm">
                  {assets.length === 0 ? 'Gagal memuat assets' : 'Asset tidak ditemukan'}
                </div>
              ) : filteredAssets.map(a => (
                <button
                  key={a.ric}
                  onClick={() => {
                    setField(['asset'], { ric: a.ric, name: a.name, profitRate: a.profitRate, typeName: a.typeName, iconUrl: a.iconUrl });
                    setShowAssetList(false); setAssetSearch('');
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800/60 transition-colors
                              ${asset.ric === a.ric ? 'bg-green-500/5' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${asset.ric === a.ric ? 'text-green-400' : 'text-gray-200'}`}>
                      {a.name}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">{a.ric} · {a.typeName}</p>
                  </div>
                  <span className="text-xs font-bold text-green-400 shrink-0">{a.profitRate}%</span>
                  {asset.ric === a.ric && <span className="text-green-400 text-sm shrink-0">✓</span>}
                </button>
              ))}
            </div>

            {assets.length > 0 && !assetLoading && (
              <div className="px-4 py-2 border-t border-gray-700 bg-gray-800/30">
                <p className="text-xs text-gray-600">{filteredAssets.length} dari {assets.length} asset</p>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ── 2. Akun & Currency ── */}
      <Section title="Akun & Mata Uang">
        {/* Demo / Real toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-800/50 border border-gray-700">
          <div>
            <p className="text-sm font-medium text-gray-200">Tipe Akun</p>
            <p className="text-xs text-gray-600 mt-0.5">
              {isDemo ? 'Menggunakan saldo demo (tidak menggunakan uang nyata)' : 'Menggunakan saldo real'}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-xs font-bold ${!isDemo ? 'text-white' : 'text-gray-600'}`}>REAL</span>
            <Toggle
              checked={isDemo}
              onChange={v => setField(['isDemoAccount'], v)}
              label="Demo account toggle"
            />
            <span className={`text-xs font-bold ${isDemo ? 'text-green-400' : 'text-gray-600'}`}>DEMO</span>
          </div>
        </div>

        {!isDemo && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
            <span className="text-yellow-400 text-sm">⚠</span>
            <p className="text-xs text-yellow-400">Mode Real — Trading menggunakan saldo sesungguhnya</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Currency">
            <input
              value={currency}
              onChange={e => setField(['currency'], e.target.value)}
              placeholder="IDR"
              className={inputCls}
            />
          </Field>
          <Field label="Currency ISO">
            <input
              value={currencyIso}
              onChange={e => setField(['currencyIso'], e.target.value)}
              placeholder="IDR"
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      {/* ── 3. Amount ── */}
      <Section title="Amount">
        <Field label="Base Amount" hint="Jumlah taruhan awal (dalam mata uang akun)">
          <div className="relative">
            <input
              type="number"
              min={1}
              value={mg.baseAmount ?? 10000}
              onChange={e => setField(['martingale', 'baseAmount'], Number(e.target.value))}
              className={inputCls + ' pr-14'}
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">
              {currencyIso || 'IDR'}
            </span>
          </div>
        </Field>
      </Section>

      {/* ── 4. Martingale ── */}
      <Section title="Martingale">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-200">Aktifkan Martingale</p>
            <p className="text-xs text-gray-600 mt-0.5">Lipat jumlah taruhan saat loss</p>
          </div>
          <Toggle
            checked={mg.isEnabled ?? false}
            onChange={v => setField(['martingale', 'isEnabled'], v)}
          />
        </div>

        {mg.isEnabled && (
          <div className="space-y-4 pt-2 border-t border-gray-800">

            {/* Max Steps */}
            <Field label="Max Steps" hint={`${mg.maxSteps ?? 3} langkah`}>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1} max={10}
                  value={mg.maxSteps ?? 3}
                  onChange={e => setField(['martingale', 'maxSteps'], Number(e.target.value))}
                  className="flex-1 h-2 rounded-full accent-green-500 cursor-pointer"
                />
                <span className="text-sm font-bold text-white tabular-nums w-6 text-center">{mg.maxSteps ?? 3}</span>
              </div>
            </Field>

            {/* Multiplier Type */}
            <Field label="Tipe Multiplier">
              <div className="grid grid-cols-2 gap-2">
                {(['FIXED', 'PERCENTAGE'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setField(['martingale', 'multiplierType'], t)}
                    className={`py-2.5 text-sm font-semibold rounded-xl border transition-all
                                ${(mg.multiplierType ?? 'FIXED') === t
                                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                  : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300'}`}
                  >
                    {t === 'FIXED' ? '+ Fixed' : '% Percentage'}
                  </button>
                ))}
              </div>
            </Field>

            {/* Multiplier Value */}
            <Field
              label="Nilai Multiplier"
              hint={mg.multiplierType === 'PERCENTAGE' ? '(% dari amount sebelumnya)' : '(tambah nominal tetap)'}
            >
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  step={mg.multiplierType === 'PERCENTAGE' ? 1 : 1000}
                  value={mg.multiplierValue ?? 2}
                  onChange={e => setField(['martingale', 'multiplierValue'], Number(e.target.value))}
                  className={inputCls + ' pr-10'}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">
                  {mg.multiplierType === 'PERCENTAGE' ? '%' : currencyIso || 'IDR'}
                </span>
              </div>
            </Field>

            {/* Always Signal */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-800/50 border border-gray-700">
              <div>
                <p className="text-sm font-medium text-gray-200">Always Signal</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Lanjut martingale ke sinyal berikutnya meski berbeda order
                </p>
              </div>
              <Toggle
                checked={mg.isAlwaysSignal ?? false}
                onChange={v => setField(['martingale', 'isAlwaysSignal'], v)}
              />
            </div>

            {/* Preview Table */}
            <div>
              <p className="text-[11px] text-gray-600 uppercase tracking-wide font-semibold mb-2">
                Preview Martingale Steps
              </p>
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="px-3 py-2 text-[10px] font-semibold text-gray-600 uppercase tracking-wide text-left">Step</th>
                      <th className="px-3 py-2 text-[10px] font-semibold text-gray-600 uppercase tracking-wide text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-700/50">
                      <td className="px-3 py-2 text-gray-500 text-xs">Base</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-300 text-xs tabular-nums">
                        {(mg.baseAmount ?? 10000).toLocaleString('id-ID')}
                      </td>
                    </tr>
                    {mgSteps.map(({ step, amount }) => (
                      <tr key={step} className="border-b border-gray-700/50 last:border-0">
                        <td className="px-3 py-2 text-gray-500 text-xs">Step {step}</td>
                        <td className="px-3 py-2 text-right font-mono text-green-400 text-xs font-semibold tabular-nums">
                          {Math.round(amount).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* ── Save ── */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 text-sm font-bold rounded-xl bg-green-500 hover:bg-green-400
                     disabled:opacity-40 text-white transition-colors"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Menyimpan...
            </span>
          ) : 'Simpan Konfigurasi'}
        </button>

        {msg && (
          <p className={`text-sm ${msg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>
        )}
      </div>
    </div>
  );
}