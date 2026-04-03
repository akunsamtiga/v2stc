'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { UpdateConfigPayload } from '@/lib/api';
import type { ScheduleConfig, StockityAsset } from '@/types';

// ── Sistem Amount (identik Kotlin CurrencyModels) ─────────────────────
const CURRENCY_MIN_CENTS: Record<string, number> = {
  IDR: 1_400_000, JPY: 15_000, SGD: 135, MYR: 465, THB: 3_500,
  PHP: 5_600, VND: 2_450_000, KRW: 133_000, CNY: 725, HKD: 780,
  TWD: 3_150, INR: 8_300, PKR: 28_000, BDT: 11_000, LKR: 32_500,
  USD: 100, EUR: 95, GBP: 80, CHF: 90, AUD: 150, NZD: 165,
  CAD: 135, MXN: 1_700, BRL: 500, ARS: 35_000, CLP: 90_000,
  COP: 400_000, AED: 367, SAR: 375, TRY: 2_800, EGP: 3_100,
  ZAR: 1_850, NGN: 80_000, RUB: 9_200, PLN: 400, CZK: 2_300,
  HUF: 36_000, SEK: 1_050, NOK: 1_080, DKK: 700, KZT: 45_000,
};

const ZERO_DECIMAL_CURRENCIES = new Set([
  'IDR', 'JPY', 'VND', 'KRW', 'THB', 'CLP', 'COP', 'HUF',
]);

function centsToDisplay(cents: number): number {
  return cents / 100;
}

function displayToCents(display: number): number {
  return Math.round(display * 100);
}

function formatDisplay(cents: number, iso: string): string {
  const val = centsToDisplay(cents);
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(iso.toUpperCase());
  return isZeroDecimal
    ? val.toLocaleString('id-ID', { maximumFractionDigits: 0 })
    : val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Validate entire config before save ───────────────────────────────
function validateConfig(cfg: Record<string, unknown>): string | null {
  const asset = (cfg.asset as any) ?? {};
  const mg = (cfg.martingale as any) ?? {};
  const currencyIso = ((cfg.currencyIso as string) || 'IDR').toUpperCase();
  const minCents = CURRENCY_MIN_CENTS[currencyIso] ?? 100;
  const baseAmountCents: number = mg.baseAmount ?? 0;

  if (!asset.ric) return 'Pilih asset terlebih dahulu.';
  if (baseAmountCents < minCents) {
    return `Base amount (${formatDisplay(baseAmountCents, currencyIso)} ${currencyIso}) di bawah minimum Stockity (${formatDisplay(minCents, currencyIso)} ${currencyIso}). Bot tidak akan bisa mengeksekusi trade.`;
  }
  if (mg.isEnabled) {
    if (!mg.maxSteps || mg.maxSteps < 1) return 'Martingale max steps harus minimal 1.';
    if (mg.multiplierType === 'FIXED' && mg.multiplierValue < 1.1)
      return 'Fixed multiplier harus ≥ 1.1×.';
    if (mg.multiplierType === 'PERCENTAGE' && mg.multiplierValue < 1)
      return 'Percentage multiplier harus ≥ 1%.';
  }
  return null;
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
    baseAmount: 0,          // ← start at 0 so user is forced to set a valid amount
    multiplierValue: 2,
    multiplierType: 'FIXED',
    isAlwaysSignal: false,
  },
  isDemoAccount: true,
  currency: 'IDR',
  currencyIso: 'IDR',
  stopLoss: 0,
  stopProfit: 0,
};

// ── main component ────────────────────────────────────────────────────
export default function ConfigPage() {
  const [cfg,          setCfg]          = useState<ScheduleConfig>(DEFAULT_CONFIG as unknown as ScheduleConfig);
  const [assets,       setAssets]       = useState<StockityAsset[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [assetLoading, setAssetLoading] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [msg,          setMsg]          = useState('');
  const [msgType,      setMsgType]      = useState<'ok' | 'err'>('ok');
  const [assetSearch,  setAssetSearch]  = useState('');
  const [showAssetList,setShowAssetList]= useState(false);

  // typed accessors
  const asset       = (cfg as any).asset       ?? {};
  const mg          = (cfg as any).martingale  ?? {};
  const isDemo      = (cfg as any).isDemoAccount ?? true;
  const currencyIso = ((cfg as any).currencyIso ?? 'IDR') as string;
  const stopLoss    = (cfg as any).stopLoss    ?? 0;
  const stopProfit  = (cfg as any).stopProfit  ?? 0;

  const iso     = currencyIso.toUpperCase();
  const minCents = CURRENCY_MIN_CENTS[iso] ?? 100;
  const baseAmountCents: number = mg.baseAmount ?? 0;
  const isBelowMin = baseAmountCents < minCents;

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
      const [cfgRes, meRes] = await Promise.allSettled([api.getConfig(), api.me()]);
      const me = meRes.status === 'fulfilled' ? (meRes.value as any) : null;

      setCfg(prev => {
        const base: Record<string, unknown> =
          cfgRes.status === 'fulfilled' && cfgRes.value && Object.keys(cfgRes.value).length > 0
            ? { ...(cfgRes.value as object) }
            : { ...(prev as object) };
        if (me?.currency)    base['currency']    = me.currency;
        if (me?.currencyIso) base['currencyIso'] = me.currencyIso;
        if (base['stopLoss']   === undefined) base['stopLoss']   = 0;
        if (base['stopProfit'] === undefined) base['stopProfit'] = 0;

        // ── FIX: if saved baseAmount is below current currency minimum, reset to minimum
        const savedMg = (base['martingale'] as any) ?? {};
        const savedIso = ((base['currencyIso'] as string) || 'IDR').toUpperCase();
        const savedMin = CURRENCY_MIN_CENTS[savedIso] ?? 100;
        if (!savedMg.baseAmount || savedMg.baseAmount < savedMin) {
          base['martingale'] = { ...savedMg, baseAmount: savedMin };
        }

        return base as ScheduleConfig;
      });
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
    setMsg('');
    // ── Validate before sending ──────────────────────────────────────
    const err = validateConfig(cfg as unknown as Record<string, unknown>);
    if (err) {
      setMsg(`✗ ${err}`);
      setMsgType('err');
      return;
    }

    setSaving(true);
    try {
      await api.updateConfig(cfg as unknown as UpdateConfigPayload);
      setMsg('✓ Konfigurasi berhasil disimpan');
      setMsgType('ok');
    } catch (e: unknown) {
      setMsg(`✗ ${e instanceof Error ? e.message : 'Gagal menyimpan'}`);
      setMsgType('err');
    } finally { setSaving(false); }
  };

  const filteredAssets = assets.filter(a =>
    a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
    a.ric.toLowerCase().includes(assetSearch.toLowerCase())
  );

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
        <p className="text-sm text-gray-500 mt-0.5">Pengaturan asset, akun, amount, martingale, dan risk management</p>
      </div>

      {/* ── 1. Asset ── */}
      <Section title="Asset">
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
          </div>
        )}
      </Section>

      {/* ── 2. Akun & Currency ── */}
      <Section title="Akun & Mata Uang">
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

        <div className="flex items-center justify-between px-3.5 py-2.5 bg-gray-800/50 border border-gray-700 rounded-xl">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Mata Uang</p>
            <p className="text-xs text-gray-600 mt-0.5">Otomatis dari akun Stockity</p>
          </div>
          <span className="text-sm font-bold text-white bg-gray-700 px-3 py-1 rounded-lg">
            {currencyIso || '—'}
          </span>
        </div>
      </Section>

      {/* ── 3. Amount ── */}
      <Section title="Amount">
        {(() => {
          const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(iso);
          const displayVal = centsToDisplay(baseAmountCents);
          const minDisplay = centsToDisplay(minCents);

          return (
            <Field
              label="Base Amount"
              hint={`Minimum: ${formatDisplay(minCents, iso)} ${iso}`}
            >
              <div className="relative">
                <input
                  type="number"
                  min={minDisplay}
                  step={isZeroDecimal ? 1000 : 0.01}
                  value={displayVal || ''}
                  onChange={e => {
                    const display = Number(e.target.value);
                    setField(['martingale', 'baseAmount'], displayToCents(display));
                  }}
                  className={inputCls + ' pr-14' + (isBelowMin ? ' border-red-500 focus:border-red-500 focus:ring-red-500/20' : '')}
                  placeholder={`Min. ${formatDisplay(minCents, iso)}`}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">
                  {iso}
                </span>
              </div>

              {/* ── FIX: Block save with a prominent error banner, not just hint ── */}
              {isBelowMin && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 mt-2">
                  <span className="text-red-400 text-sm shrink-0">✗</span>
                  <div>
                    <p className="text-xs text-red-400 font-semibold">Amount di bawah minimum Stockity</p>
                    <p className="text-[11px] text-red-400/70 mt-0.5">
                      Set ke minimal <span className="font-mono font-bold">{formatDisplay(minCents, iso)} {iso}</span> agar trade bisa dieksekusi.
                    </p>
                    <button
                      type="button"
                      onClick={() => setField(['martingale', 'baseAmount'], minCents)}
                      className="mt-1.5 text-[11px] font-semibold text-red-300 underline underline-offset-2 hover:text-red-200 transition-colors"
                    >
                      Set ke minimum sekarang →
                    </button>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-gray-700 mt-1">
                Nilai internal: <span className="font-mono text-gray-600">{baseAmountCents.toLocaleString()}</span> cents
              </p>
            </Field>
          );
        })()}
      </Section>

      {/* ── 4. Risk Management ── */}
      <Section title="Risk Management">
        <div className="space-y-4">
          {/* Stop Loss */}
          {(() => {
            const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(iso);
            const displayVal = centsToDisplay(stopLoss || 0);
            const isEnabled = (stopLoss || 0) > 0;

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-200">Stop Loss</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Bot otomatis berhenti jika total kerugian mencapai nilai ini
                    </p>
                  </div>
                  <Toggle
                    checked={isEnabled}
                    onChange={v => setField(['stopLoss'], v ? minCents * 10 : 0)}
                    label="Stop Loss toggle"
                  />
                </div>
                {isEnabled && (
                  <div className="pl-4 border-l-2 border-red-500/30 space-y-2">
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        step={isZeroDecimal ? 1000 : 0.01}
                        value={displayVal}
                        onChange={e => setField(['stopLoss'], displayToCents(Number(e.target.value)))}
                        className={inputCls + ' pr-14'}
                        placeholder="0"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">
                        {iso}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600">
                      Bot berhenti saat PnL ≤ <span className="font-mono text-red-400">-{formatDisplay(stopLoss || 0, iso)}</span>
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          <div className="border-t border-gray-800" />

          {/* Stop Profit */}
          {(() => {
            const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(iso);
            const displayVal = centsToDisplay(stopProfit || 0);
            const isEnabled = (stopProfit || 0) > 0;

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-200">Stop Profit</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Bot otomatis berhenti jika total keuntungan mencapai nilai ini
                    </p>
                  </div>
                  <Toggle
                    checked={isEnabled}
                    onChange={v => setField(['stopProfit'], v ? minCents * 10 : 0)}
                    label="Stop Profit toggle"
                  />
                </div>
                {isEnabled && (
                  <div className="pl-4 border-l-2 border-green-500/30 space-y-2">
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        step={isZeroDecimal ? 1000 : 0.01}
                        value={displayVal}
                        onChange={e => setField(['stopProfit'], displayToCents(Number(e.target.value)))}
                        className={inputCls + ' pr-14'}
                        placeholder="0"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">
                        {iso}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600">
                      Bot berhenti saat PnL ≥ <span className="font-mono text-green-400">+{formatDisplay(stopProfit || 0, iso)}</span>
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
            <span className="text-blue-400 text-sm shrink-0">ℹ</span>
            <p className="text-xs text-blue-400 leading-relaxed">
              Risk management bekerja pada level sesi trading. Setiap kali bot di-start, counter PnL direset ke 0.
            </p>
          </div>
        </div>
      </Section>

      {/* ── 5. Martingale ── */}
      <Section title="Martingale">
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

            <Field
              label="Nilai Multiplier"
              hint={mg.multiplierType === 'PERCENTAGE'
                ? '(tambahan % dari amount sebelumnya)'
                : '(kelipatan dari base amount, min 1.1×)'}
            >
              <div className="relative">
                <input
                  type="number"
                  min={mg.multiplierType === 'PERCENTAGE' ? 1 : 1.1}
                  step={mg.multiplierType === 'PERCENTAGE' ? 1 : 0.1}
                  value={mg.multiplierValue ?? 2.5}
                  onChange={e => setField(['martingale', 'multiplierValue'], Number(e.target.value))}
                  className={inputCls + ' pr-10'}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">
                  {mg.multiplierType === 'PERCENTAGE' ? '%' : '×'}
                </span>
              </div>
            </Field>

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
          </div>
        )}
      </Section>

      {/* ── Save ── */}
      <div className="space-y-3">
        {/* Validation summary — shown only when there's a blocking error */}
        {isBelowMin && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30">
            <span className="text-red-400">✗</span>
            <p className="text-sm text-red-400">
              Konfigurasi tidak valid — perbaiki error di atas sebelum menyimpan
            </p>
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving || isBelowMin || !asset.ric}
            title={isBelowMin ? `Base amount harus minimal ${formatDisplay(minCents, iso)} ${iso}` : undefined}
            className="px-6 py-2.5 text-sm font-bold rounded-xl bg-green-500 hover:bg-green-400
                       disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Menyimpan...
              </span>
            ) : 'Simpan Konfigurasi'}
          </button>

          {msg && (
            <p className={`text-sm ${msgType === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>
          )}
        </div>
      </div>
    </div>
  );
}