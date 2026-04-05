'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api, type ProfileBalance } from '@/lib/api';
import { storage } from '@/components/ClientLayout';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface UserProfileData {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  phone?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  gender?: string;
  country?: string;
  birthday?: string;
  registeredAt?: string;
  registrationCountryIso?: string;
  avatar?: string;
  personalDataLocked?: boolean;
  docsVerified?: boolean;
}
interface CurrencyOption { iso: string; name?: string; symbol?: string; }

// ─────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────
const Skel: React.FC<{ w?: number | string; h?: number; r?: number }> = ({ w = '100%', h = 16, r = 6 }) => (
  <div style={{ width: w, height: h, borderRadius: r, background: 'rgba(60,60,67,0.08)', animation: 'skel-pulse 1.6s ease-in-out infinite' }} />
);

// ─────────────────────────────────────────────
// CURRENCY SHEET
// ─────────────────────────────────────────────
const CurrencySheet: React.FC<{
  open: boolean; onClose: () => void;
  currencies: CurrencyOption[]; current: string;
  onSelect: (iso: string) => Promise<void>; loading: boolean;
}> = ({ open, onClose, currencies, current, onSelect, loading }) => {
  const [q, setQ] = useState('');
  const inputRef  = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) { setQ(''); setTimeout(() => inputRef.current?.focus(), 300); }
  }, [open]);
  if (!open) return null;
  const filtered = q.trim()
    ? currencies.filter(c => c.iso.toLowerCase().includes(q.toLowerCase()) || (c.name || '').toLowerCase().includes(q.toLowerCase()))
    : currencies;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', animation: 'bd-in 0.25s ease' }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, maxHeight: '70dvh', display: 'flex', flexDirection: 'column', background: '#f2f2f7', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', animation: 'pop-in 0.28s cubic-bezier(0.32,0.72,0,1)', overflow: 'hidden' }}>
        <div style={{ flexShrink: 0, padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid rgba(60,60,67,0.14)' }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: '#1c1c1e', letterSpacing: -0.4 }}>Pilih Mata Uang</span>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(116,116,128,0.12)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3c3c43' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div style={{ flexShrink: 0, padding: '10px 16px' }}>
          <div style={{ position: 'relative' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(60,60,67,0.4)" strokeWidth="2.2" strokeLinecap="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Cari"
              style={{ width: '100%', padding: '8px 10px 8px 34px', borderRadius: 10, background: 'rgba(116,116,128,0.12)', border: 'none', outline: 'none', fontSize: 15, color: '#1c1c1e', fontFamily: 'inherit' }} />
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, background: '#fff' }}>
          {filtered.length === 0
            ? <div style={{ padding: '48px 0', textAlign: 'center', color: '#aeaeb2', fontSize: 14 }}>Tidak ditemukan</div>
            : filtered.map((c, i) => {
                const sel = c.iso === current;
                return (
                  <button key={c.iso} onClick={() => onSelect(c.iso).then(onClose)} disabled={loading}
                    style={{ width: '100%', background: 'transparent', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', padding: '13px 20px', borderBottom: i < filtered.length - 1 ? '1px solid rgba(60,60,67,0.08)' : 'none', gap: 14, opacity: loading ? 0.6 : 1 }}>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <p style={{ fontSize: 16, color: '#1c1c1e', fontWeight: sel ? 600 : 400 }}>{c.iso}</p>
                      {c.name && <p style={{ fontSize: 13, color: '#6e6e73', marginTop: 1 }}>{c.name}</p>}
                    </div>
                    {c.symbol && <span style={{ fontSize: 14, color: '#aeaeb2' }}>{c.symbol}</span>}
                    {sel && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                  </button>
                );
              })}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// LOGOUT CONFIRM
// ─────────────────────────────────────────────
const LogoutAlert: React.FC<{ open: boolean; onCancel: () => void; onConfirm: () => void }> = ({ open, onCancel, onConfirm }) => {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', animation: 'bd-in 0.2s ease' }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 320, animation: 'pop-in 0.28s cubic-bezier(0.32,0.72,0,1)' }}>
        <div style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
          <div style={{ padding: '24px 20px 16px', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,59,48,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
            <p style={{ fontSize: 17, fontWeight: 600, color: '#1c1c1e', marginBottom: 6, letterSpacing: -0.3 }}>Keluar dari STC AutoTrade</p>
            <p style={{ fontSize: 14, color: '#6e6e73', lineHeight: 1.5 }}>Anda perlu login kembali untuk mengakses akun.</p>
          </div>
          <div style={{ borderTop: '1px solid rgba(60,60,67,0.10)', display: 'flex' }}>
            <button onClick={onCancel} style={{ flex: 1, padding: '16px', background: 'transparent', border: 'none', borderRight: '1px solid rgba(60,60,67,0.10)', cursor: 'pointer', fontSize: 17, fontWeight: 600, color: '#007aff', fontFamily: 'inherit' }}>Batal</button>
            <button onClick={onConfirm} style={{ flex: 1, padding: '16px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 17, fontWeight: 400, color: '#ff3b30', fontFamily: 'inherit' }}>Keluar</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();
  const [isLoading, setIsLoading]             = useState(true);
  const [profile, setProfile]                 = useState<UserProfileData | null>(null);
  const [balance, setBalance]                 = useState<ProfileBalance | null>(null);
  const [currencies, setCurrencies]           = useState<CurrencyOption[]>([]);
  const [sheetOpen, setSheetOpen]             = useState(false);
  const [currencyLoading, setCurrencyLoading] = useState(false);
  const [showLogout, setShowLogout]           = useState(false);
  const [copied, setCopied]                   = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [refreshing, setRefreshing]           = useState(false);

  useEffect(() => {
    const init = async () => {
      const token = await storage.get('stc_token');
      if (!token) { router.push('/login'); return; }
      loadProfile();
    };
    init();
  }, []); // eslint-disable-line

  const loadProfile = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const token = await storage.get('stc_token');
      const [prof, bal] = await Promise.all([api.getProfile(), api.balance().catch(() => null)]);
      setProfile(prof); setBalance(bal);

      fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/profile/currencies`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()).then(data => {
        const list: any[] = Array.isArray(data) ? data : (data?.data ?? []);
        setCurrencies(list.map((c: any) => ({ iso: c.iso ?? c.currency_iso ?? c.code ?? c, name: c.name ?? c.currency_name ?? '', symbol: c.symbol ?? '' })));
      }).catch(() => {});
    } catch (err: any) {
      if (err?.status === 401) { router.push('/login'); return; }
      setError('Gagal memuat profil. Coba lagi.');
    } finally {
      setIsLoading(false); setRefreshing(false);
    }
  }, [router]);

  const handleUpdateCurrency = async (iso: string) => {
    setCurrencyLoading(true);
    try {
      const token = await storage.get('stc_token');
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/profile/currency`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currencyIso: iso }),
      });
      const bal = await api.balance().catch(() => null);
      if (bal) setBalance(bal);
    } finally { setCurrencyLoading(false); }
  };

  const handleLogout = async () => {
    await storage.remove('stc_token');
    await storage.remove('stc_user');
    router.push('/login');
  };

  const copyId = () => {
    if (profile?.id) {
      navigator.clipboard.writeText(String(profile.id));
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  };

  const fmtBalance = (n?: number) => {
    if (n == null) return '0';
    const val = n / 100;
    return val.toLocaleString('id-ID', { maximumFractionDigits: 0 });
  };

  const getInitials = () => {
    const f = profile?.firstName?.[0] || '';
    const l = profile?.lastName?.[0] || '';
    return (f + l).toUpperCase() || profile?.nickname?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U';
  };

  const getDisplayName = () => {
    const f = profile?.firstName?.trim() || '';
    const l = profile?.lastName?.trim() || '';
    if (f && l) return `${f} ${l}`;
    return f || l || profile?.nickname?.trim() || profile?.email?.split('@')[0] || 'User';
  };

  const currency = balance?.currency || 'IDR';

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="pf-section-label">{children}</p>
  );

  const Card = ({ children, mb }: { children: React.ReactNode; mb?: number }) => (
    <div className="pf-card" style={{ marginBottom: mb ?? 0 }}>{children}</div>
  );

  const InfoRow = ({ label, value, verified, last }: { label: string; value?: string | null; verified?: boolean; last?: boolean }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: last ? 'none' : '1px solid rgba(60,60,67,0.07)', gap: 12 }}>
      <span style={{ fontSize: 14, color: '#3c3c43', flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {verified != null && (
          <span style={{ fontSize: 11, fontWeight: 600, color: verified ? '#34c759' : '#ff9500', background: verified ? 'rgba(52,199,89,0.10)' : 'rgba(255,149,0,0.10)', padding: '2px 7px', borderRadius: 99, flexShrink: 0 }}>
            {verified ? 'Terverifikasi' : 'Belum'}
          </span>
        )}
        <span style={{ fontSize: 14, color: value ? '#6e6e73' : '#c7c7cc', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{value || '—'}</span>
      </div>
    </div>
  );

  const TappableRow = ({ icon, iconBg, label, value, danger, onClick, last, chevron = true }: {
    icon: React.ReactNode; iconBg: string; label: string; value?: string;
    danger?: boolean; onClick: () => void; last?: boolean; chevron?: boolean;
  }) => (
    <button onClick={onClick} className="pf-tap-row" style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '10px 16px 10px 14px', borderBottom: last ? 'none' : '1px solid rgba(60,60,67,0.07)', gap: 12, textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}>
      <div style={{ width: 30, height: 30, borderRadius: 7, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <span style={{ flex: 1, fontSize: 15, color: danger ? '#ff3b30' : '#1c1c1e' }}>{label}</span>
      {value && <span style={{ fontSize: 14, color: '#aeaeb2', marginRight: 4 }}>{value}</span>}
      {chevron && <svg width="6" height="11" viewBox="0 0 7 12" fill="none"><path d="M1 1l5 5-5 5" stroke={danger ? '#ff3b30' : '#c7c7cc'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </button>
  );

  const AvatarBlock = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(145deg, #007aff, #5ac8fa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 700, color: '#fff', boxShadow: '0 4px 20px rgba(0,122,255,0.28)', marginBottom: 12, animation: 'pop-in 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.08s both', flexShrink: 0 }}>
        {isLoading ? '' : getInitials()}
      </div>
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, width: '100%' }}>
          <Skel w={130} h={18} r={6} /><Skel w={170} h={13} r={5} />
        </div>
      ) : (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c1c1e', letterSpacing: -0.4, marginBottom: 3, lineHeight: 1.2 }}>{getDisplayName()}</h2>
          <p style={{ fontSize: 13, color: '#6e6e73', marginBottom: 10, wordBreak: 'break-all', maxWidth: 220 }}>{profile?.email}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {profile?.docsVerified && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#34c759', background: 'rgba(52,199,89,0.12)', padding: '3px 10px', borderRadius: 99 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Terverifikasi
              </span>
            )}
            {profile?.id && (
              <button className="pf-copy-btn" onClick={copyId} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6e6e73', background: 'rgba(116,116,128,0.10)', padding: '3px 10px', borderRadius: 99, border: 'none', cursor: 'pointer', transition: 'opacity 0.15s' }}>
                ID: {String(profile.id).slice(0, 8)}…
                {copied
                  ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                }
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );

  const BalanceBlock = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[
        {
          label: 'Real', color: '#34c759', bgColor: 'rgba(52,199,89,0.12)', val: balance?.real_balance, sub: currency,
          icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>,
        },
        {
          label: 'Demo', color: '#ff9500', bgColor: 'rgba(255,149,0,0.10)', val: balance?.demo_balance, sub: 'Virtual',
          icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff9500" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>,
        },
      ].map(({ label, color, bgColor, val, sub, icon }) => (
        <div key={label} style={{ background: '#fff', borderRadius: 12, padding: '11px 14px', boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 2px 10px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color, textTransform: 'uppercase' as const, letterSpacing: '0.04em', display: 'block', marginBottom: 3 }}>{label}</span>
            {isLoading
              ? <Skel w="75%" h={16} r={4} />
              : <p className="balance-num" style={{ fontSize: 16, fontWeight: 700, color: '#1c1c1e', letterSpacing: -0.4, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmtBalance(val)}</p>
            }
            <p style={{ fontSize: 10, color: '#aeaeb2', marginTop: 2 }}>{sub}</p>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ height: '100dvh', background: '#f2f2f7', fontFamily: "-apple-system,'SF Pro Display',BlinkMacSystemFont,'Helvetica Neue',sans-serif", WebkitFontSmoothing: 'antialiased', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      <style>{`
        @keyframes skel-pulse { 0%,100%{opacity:.5} 50%{opacity:1} }
        @keyframes bd-in      { from{opacity:0} to{opacity:1} }
        @keyframes pop-in     { from{opacity:0;transform:scale(0.94)} to{opacity:1;transform:scale(1)} }
        @keyframes fade-up    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin       { to{transform:rotate(360deg)} }
        @keyframes number-in  { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }

        .pf-tap-row:hover  { background: rgba(0,0,0,0.03) !important; }
        .pf-tap-row:active { background: rgba(0,0,0,0.06) !important; }
        .pf-copy-btn:active { opacity: 0.6; }

        .pf-card {
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 0 rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.04);
        }

        .pf-section-label {
          font-size: 11.5px;
          font-weight: 500;
          color: #6e6e73;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 0 4px;
          margin-bottom: 6px;
        }

        .balance-num { animation: number-in 0.4s ease both; }

        .pf-body { flex: 1; overflow: hidden; display: flex; }
        .pf-mob-header { display: flex; }
        .pf-desk-header { display: none; }
        .pf-left { display: none; }
        .pf-right {
          flex: 1; overflow-y: auto;
          padding: 20px 16px 100px;
          display: flex; flex-direction: column; gap: 22px;
        }
        .pf-right::-webkit-scrollbar { width: 0; }
        .pf-mob-only { display: block; }

        @media (min-width: 768px) {
          .pf-mob-header { display: none; }
          .pf-desk-header { display: flex !important; align-items: center; justify-content: space-between; padding-bottom: 4px; }
          .pf-left {
            display: flex; flex-direction: column; gap: 20px;
            width: 272px; min-width: 272px;
            height: 100%; overflow-y: auto;
            padding: 24px 20px 100px;
            background: rgba(228,228,235,0.55);
            border-right: 0.5px solid rgba(60,60,67,0.11);
          }
          .pf-left::-webkit-scrollbar { width: 0; }
          .pf-right { padding: 24px 28px 100px; gap: 20px; }
          .pf-mob-only { display: none; }
          .pf-left > * { animation: fade-up 0.4s cubic-bezier(0.22,1,0.36,1) both; }
          .pf-left > *:nth-child(1) { animation-delay: 0.05s; }
          .pf-left > *:nth-child(2) { animation-delay: 0.10s; }
          .pf-left > *:nth-child(3) { animation-delay: 0.15s; }
          .pf-left > *:nth-child(4) { animation-delay: 0.20s; }
          .pf-right > * { animation: fade-up 0.4s cubic-bezier(0.22,1,0.36,1) both; }
          .pf-right > *:nth-child(1) { animation-delay: 0.06s; }
          .pf-right > *:nth-child(2) { animation-delay: 0.11s; }
          .pf-right > *:nth-child(3) { animation-delay: 0.16s; }
          .pf-right > *:nth-child(4) { animation-delay: 0.21s; }
          .pf-right > *:nth-child(5) { animation-delay: 0.26s; }
        }
      `}</style>

      {/* ── MOBILE HEADER ── */}
      <div className="pf-mob-header" style={{ position: 'sticky', top: 0, zIndex: 50, flexShrink: 0, background: 'rgba(242,242,247,0.92)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)', borderBottom: '0.5px solid rgba(60,60,67,0.16)' }}>
        <div style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ fontSize: 17, fontWeight: 600, color: '#1c1c1e', letterSpacing: -0.4 }}>Profil</h1>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="pf-body">

        {/* ══ LEFT SIDEBAR (desktop only) ══ */}
        <div className="pf-left">
          <AvatarBlock />
          <div style={{ height: '0.5px', background: 'rgba(60,60,67,0.10)', margin: '0 4px' }} />
          <div>
            <SectionLabel>Saldo</SectionLabel>
            <BalanceBlock />
          </div>
          <div style={{ marginTop: 'auto' }}>
            <Card>
              <TappableRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>}
                iconBg="#ff3b30" label="Keluar" danger onClick={() => setShowLogout(true)} last
              />
            </Card>
            <p style={{ textAlign: 'center', fontSize: 11.5, color: '#c7c7cc', marginTop: 14 }}>STC AutoTrade v2.0.0</p>
          </div>
        </div>

        {/* ══ RIGHT PANEL ══ */}
        <div className="pf-right">

          <div className="pf-desk-header">
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1c1c1e', letterSpacing: -0.5 }}>Profil</h1>
            <button onClick={() => loadProfile(true)} disabled={refreshing || isLoading}
              style={{ width: 32, height: 32, background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#007aff', opacity: (refreshing || isLoading) ? 0.4 : 1, transition: 'opacity 0.15s' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ animation: (refreshing || isLoading) ? 'spin 0.8s linear infinite' : 'none' }}>
                <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.16)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
              <span style={{ fontSize: 13, color: '#ff3b30', flex: 1 }}>{error}</span>
              <button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ff3b30', opacity: 0.6, padding: 4 }}>
                <svg width="11" height="11" viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              </button>
            </div>
          )}

          <div className="pf-mob-only">
            <div style={{ marginBottom: 22 }}><AvatarBlock /></div>
            <div>
              <SectionLabel>Saldo</SectionLabel>
              <BalanceBlock />
            </div>
          </div>

          <div>
            <SectionLabel>Informasi Akun</SectionLabel>
            <Card>
              {isLoading ? (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[1,2,3,4].map(i => <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}><Skel w={80} h={13} /><Skel w={130} h={13} /></div>)}
                </div>
              ) : (
                <>
                  <InfoRow label="Email" value={profile?.email} />
                  <InfoRow label="Verifikasi Email" verified={profile?.emailVerified} value={profile?.emailVerified ? 'Sudah' : 'Belum'} />
                  <InfoRow label="Telepon" value={profile?.phone || null} />
                  <InfoRow label="Verifikasi Telepon" verified={profile?.phoneVerified} value={profile?.phoneVerified ? 'Sudah' : 'Belum'} />
                  <InfoRow label="Negara" value={profile?.country || profile?.registrationCountryIso || null} />
                  {profile?.registeredAt && <InfoRow label="Bergabung" value={new Date(profile.registeredAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })} />}
                  <InfoRow label="Tgl. Lahir" value={profile?.birthday ? new Date(profile.birthday).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : null} last />
                </>
              )}
            </Card>
          </div>

          <div>
            <SectionLabel>Pengaturan</SectionLabel>
            <Card>
              <TappableRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>}
                iconBg="#007aff" label="Mata Uang" value={currencyLoading ? '…' : currency}
                onClick={() => currencies.length > 0 && setSheetOpen(true)} chevron={currencies.length > 0} last
              />
            </Card>
          </div>

          <div>
            <SectionLabel>Bantuan &amp; Legalitas</SectionLabel>
            <Card>
              <TappableRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3m.08 4h.01"/></svg>}
                iconBg="#5ac8fa" label="Ketentuan Layanan" onClick={() => {}}
              />
              <TappableRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
                iconBg="#34c759" label="Kebijakan Privasi" onClick={() => {}} last
              />
            </Card>
          </div>

          <div className="pf-mob-only">
            <Card>
              <TappableRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>}
                iconBg="#ff3b30" label="Keluar" danger onClick={() => setShowLogout(true)} last
              />
            </Card>
            <p style={{ textAlign: 'center', fontSize: 12, color: '#c7c7cc', marginTop: 14 }}>STC AutoTrade v2.0.0</p>
          </div>

        </div>
      </div>

      <CurrencySheet open={sheetOpen} onClose={() => setSheetOpen(false)} currencies={currencies} current={currency} onSelect={handleUpdateCurrency} loading={currencyLoading} />
      <LogoutAlert open={showLogout} onCancel={() => setShowLogout(false)} onConfirm={handleLogout} />
    </div>
  );
}