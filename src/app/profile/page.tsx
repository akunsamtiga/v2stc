// src/app/profile/page.tsx
'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api, type ProfileBalance } from '@/lib/api';
import { resolveAvatarUrl } from '@/lib/userProfileApi';
import { storage, isSessionValid, sessionLogout, getAuthToken, saveCurrencyWithIso } from '@/lib/storage';
import { checkIsAdmin, checkIsSuperAdmin } from '@/lib/supabaseRepository';
import { LanguageProvider, useLanguage, formatCurrency, formatDate, Language } from '@/lib';
import { applyLanguageFromCountry } from '@/lib/LanguageContext';
import { SESSION_KEYS } from '@/lib/storage';
import { LanguageSheet } from '@/components/LanguageSelector';
// import { AppUpdateCard } from '@/components/AppUpdateCard';

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
// HARDCODED DARK-GREEN THEME (sama seperti login)
// ─────────────────────────────────────────────
const PROFILE_STYLES = `
  /* ── Hardcoded dark-green variables — tidak bergantung pada isDarkMode ── */
  .pf-root, .pf-root * { box-sizing: border-box; }
  .pf-root {
    --bg:           #07070f;
    --surface:      rgba(12, 12, 26, 0.90);
    --surface-2:    rgba(14, 14, 28, 0.70);
    --border:       rgba(110, 130, 120, 0.16);
    --border-focus: rgba(100, 220, 100, 0.50);
    --text-1:       #ffffff;
    --text-2:       rgba(255,255,255,0.55);
    --text-3:       rgba(255,255,255,0.30);
    --accent:       #4caf50;
    --accent-light: #66bb6a;
    --error:        #ff453a;
    --error-bg:     rgba(255,69,58,0.10);
    --success:      #30d158;
    --warn:         #ff9f0a;
    --font:         -apple-system, 'SF Pro Display', BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
  }

  /* ── Keyframes ── */
  @keyframes pf-skel-pulse  { 0%,100%{opacity:.35} 50%{opacity:.70} }
  @keyframes pf-bd-in       { from{opacity:0} to{opacity:1} }
  @keyframes pf-pop-in      { from{opacity:0;transform:scale(0.93)} to{opacity:1;transform:scale(1)} }
  @keyframes pf-fade-up     { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pf-spin        { to{transform:rotate(360deg)} }
  @keyframes pf-number-in   { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pf-drift       { 0%{transform:translate(0,0) scale(1)} 50%{transform:translate(3%,4%) scale(1.04)} 100%{transform:translate(-2%,2%) scale(0.97)} }

  /* Logout splash keyframes */
  @keyframes lo-fade-in  { from{opacity:0} to{opacity:1} }
  @keyframes lo-icon-in  { from{opacity:0;transform:scale(0.6)} 70%{transform:scale(1.08)} to{opacity:1;transform:scale(1)} }
  @keyframes lo-msg-in   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes lo-ring-anim{ 0%,100%{transform:scale(1);opacity:0.8} 50%{transform:scale(1.06);opacity:0.35} }
  @keyframes lo-orb-1    { from{transform:translate(0,0)} to{transform:translate(30px,22px)} }
  @keyframes lo-orb-2    { from{transform:translate(0,0)} to{transform:translate(-25px,-18px)} }
  @keyframes lo-bar-anim { from{width:0%} to{width:100%} }

  /* ── Ambient orbs ── */
  .pf-orb {
    position: fixed; border-radius: 50%; pointer-events: none;
    animation: pf-drift 22s ease-in-out infinite alternate;
  }
  .pf-orb-1 {
    width: clamp(280px,70vw,520px); height: clamp(280px,70vw,520px);
    background: radial-gradient(circle, rgba(20,80,45,0.16) 0%, transparent 65%);
    bottom: -12%; right: -10%; filter: blur(90px);
  }
  .pf-orb-2 {
    width: clamp(220px,55vw,420px); height: clamp(220px,55vw,420px);
    background: radial-gradient(circle, rgba(15,30,80,0.18) 0%, transparent 65%);
    top: -15%; left: -8%; filter: blur(75px); animation-delay: -11s;
  }

  /* ── Skeleton ── */
  .pf-skel {
    border-radius: 6px;
    background: rgba(120,120,160,0.12);
    animation: pf-skel-pulse 1.6s ease-in-out infinite;
  }

  /* ── Cards ── */
  .pf-card {
    background: var(--surface);
    border: 1px solid rgba(76, 175, 80, 0.18);
    border-top: 1px solid rgba(76, 175, 80, 0.28);
    border-radius: 14px;
    overflow: hidden;
    backdrop-filter: saturate(110%) blur(24px);
    -webkit-backdrop-filter: saturate(110%) blur(24px);
    box-shadow:
      0 8px 32px rgba(0,0,0,0.45),
      0 0 0 0.5px rgba(76,175,80,0.08),
      inset 0 1px 0 rgba(76,175,80,0.10);
  }

  /* ── Section label ── */
  .pf-section-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--accent-light);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0 2px 0 8px;
    margin-bottom: 7px;
    border-left: 2px solid rgba(76, 175, 80, 0.55);
  }

  /* ── Info row divider ── */
  .pf-info-row { border-bottom: 1px solid rgba(255,255,255,0.07); }
  .pf-info-row:last-child { border-bottom: none; }

  /* ── Tappable rows ── */
  .pf-tap-row {
    width: 100%; background: transparent; border: none; cursor: pointer;
    display: flex; align-items: center;
    padding: 11px 16px 11px 14px;
    gap: 12px; text-align: left;
    -webkit-tap-highlight-color: transparent;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    transition: background 0.12s;
  }
  .pf-tap-row:last-child { border-bottom: none; }
  @media (hover: hover) { .pf-tap-row:hover { background: rgba(255,255,255,0.05) !important; } }
  .pf-tap-row:active { background: rgba(255,255,255,0.08) !important; }

  /* ── Copy btn ── */
  .pf-copy-btn:active { opacity: 0.6; }

  /* ── Balance cards ── */
  .pf-balance-num { animation: pf-number-in 0.4s ease both; }

  /* ── Layout skeleton ── */
  .pf-body         { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
  .pf-mob-header   { display: flex; flex-shrink: 0; }
  .pf-desk-header  { display: none; }
  .pf-left         { display: none; }
  .pf-mob-only     { display: block; }
  .pf-right {
    flex: 1; overflow-y: auto;
    overscroll-behavior-y: contain;
    -webkit-overflow-scrolling: touch;
    padding: 20px 16px calc(56px + env(safe-area-inset-bottom, 0px) + 24px);
    display: flex; flex-direction: column; gap: 20px;
    min-height: 0;
  }
  .pf-right::-webkit-scrollbar { width: 0; }

  @media (min-width: 768px) {
    .pf-body        { flex-direction: row; }
    .pf-mob-header  { display: none; }
    .pf-desk-header { display: flex !important; align-items: center; justify-content: space-between; padding-bottom: 4px; }
    .pf-left {
      display: flex; flex-direction: column; gap: 20px;
      width: 272px; min-width: 272px;
      height: 100%; overflow-y: auto;
      padding: 24px 20px 100px;
      background: rgba(8,8,18,0.60);
      border-right: 0.5px solid rgba(76, 175, 80, 0.14);
    }
    .pf-left::-webkit-scrollbar { width: 0; }
    .pf-right {
      padding: 24px 28px 100px;
      gap: 20px;
      overscroll-behavior-y: auto;
    }
    .pf-mob-only { display: none; }
    .pf-left > *  { animation: pf-fade-up 0.4s cubic-bezier(0.22,1,0.36,1) both; }
    .pf-left > *:nth-child(1) { animation-delay: 0.05s; }
    .pf-left > *:nth-child(2) { animation-delay: 0.10s; }
    .pf-left > *:nth-child(3) { animation-delay: 0.15s; }
    .pf-right > * { animation: pf-fade-up 0.4s cubic-bezier(0.22,1,0.36,1) both; }
    .pf-right > *:nth-child(1) { animation-delay: 0.06s; }
    .pf-right > *:nth-child(2) { animation-delay: 0.11s; }
    .pf-right > *:nth-child(3) { animation-delay: 0.16s; }
    .pf-right > *:nth-child(4) { animation-delay: 0.21s; }
    .pf-right > *:nth-child(5) { animation-delay: 0.26s; }
  }

  /* ── Logout splash ── */
  .lo-splash {
    position: fixed; inset: 0; z-index: 9999;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    font-family: var(--font);
    -webkit-font-smoothing: antialiased;
    background: linear-gradient(160deg, #07070f 0%, #0b0b1a 60%, #0e0e22 100%);
    overflow: hidden;
    animation: lo-fade-in 0.32s cubic-bezier(0.22,1,0.36,1) forwards;
  }
  .lo-orb {
    position: absolute; border-radius: 50%; pointer-events: none;
  }
  .lo-orb-1 { width:380px;height:380px;background:radial-gradient(circle,rgba(20,80,45,0.18) 0%,transparent 70%);filter:blur(80px);top:-100px;right:-100px;animation:lo-orb-1 7s ease-in-out infinite alternate; }
  .lo-orb-2 { width:340px;height:340px;background:radial-gradient(circle,rgba(15,30,80,0.18) 0%,transparent 70%);filter:blur(75px);bottom:-80px;left:-80px;animation:lo-orb-2 6s ease-in-out infinite alternate; }
  .lo-orb-3 { width:260px;height:260px;background:radial-gradient(circle,rgba(50,50,100,0.12) 0%,transparent 70%);filter:blur(70px);top:40%;left:-60px;animation:lo-orb-1 5s ease-in-out infinite alternate; }

  .lo-icon-wrap { position:relative;width:110px;height:110px;display:flex;align-items:center;justify-content:center;margin-bottom:28px; }
  .lo-ring       { position:absolute;inset:0;border-radius:50%;border:2px solid rgba(100,100,160,0.22);animation:lo-ring-anim 2.2s ease-in-out infinite; }
  .lo-ring-2     { inset:-12px;border-color:rgba(100,100,160,0.13);animation-delay:0.4s; }
  .lo-ring-3     { inset:-24px;border-color:rgba(100,100,160,0.06);animation-delay:0.8s; }
  .lo-icon       { width:90px;height:90px;border-radius:28px;background:rgba(10,10,22,0.97);border:1px solid rgba(100,100,160,0.22);box-shadow:0 8px 36px rgba(80,80,130,0.18),0 2px 8px rgba(0,0,0,0.30);display:flex;align-items:center;justify-content:center;position:relative;z-index:1;animation:lo-icon-in 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.12s both;font-size:40px;line-height:1; }

  .lo-text   { text-align:center;padding:0 32px;animation:lo-msg-in 0.5s cubic-bezier(0.22,1,0.36,1) 0.24s both; }
  .lo-title  { font-size:clamp(26px,8vw,32px);font-weight:800;letter-spacing:-1px;line-height:1.1;margin-bottom:8px;color:#fff; }
  .lo-sub    { font-size:14.5px;color:rgba(255,255,255,0.50);font-weight:400;line-height:1.6; }

  .lo-bar-wrap { margin-top:36px;width:120px;height:3px;background:rgba(100,100,160,0.15);border-radius:99px;overflow:hidden;animation:lo-msg-in 0.5s cubic-bezier(0.22,1,0.36,1) 0.35s both; }
  .lo-bar      { height:100%;border-radius:99px;background:linear-gradient(90deg,#4caf50,#66bb6a);animation:lo-bar-anim 1.65s cubic-bezier(0.4,0,0.2,1) 0.4s forwards; }

  /* ── Modals ── */
  .pf-modal-overlay {
    position: fixed; inset: 0; zIndex: 9999;
    display: flex; align-items: center; justify-content: center;
    touch-action: none;
  }
  .pf-modal-backdrop {
    position: absolute; inset: 0;
    background: rgba(0,0,0,0.65);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    animation: pf-bd-in 0.22s ease;
  }
  .pf-modal-sheet {
    position: relative; z-index: 1;
    background: rgba(10,10,22,0.97);
    border: 1px solid rgba(100,100,160,0.18);
    border-radius: 20px;
    box-shadow: 0 24px 80px rgba(0,0,0,0.60), 0 4px 16px rgba(0,0,0,0.20);
    overflow: hidden;
    animation: pf-pop-in 0.28s cubic-bezier(0.22,1,0.36,1);
  }
  .pf-modal-close-btn {
    width: 28px; height: 28px; border-radius: 50%;
    background: rgba(255,255,255,0.08); border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: rgba(255,255,255,0.55); transition: background 0.15s; flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
  }
  .pf-modal-close-btn:hover { background: rgba(255,255,255,0.14); }

  /* Currency sheet list item */
  .pf-curr-item {
    width: 100%; background: transparent; border: none; cursor: pointer;
    display: flex; align-items: center; padding: 13px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    gap: 14px; -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }
  .pf-curr-item:last-child { border-bottom: none; }
  .pf-curr-item:hover { background: rgba(255,255,255,0.05); }

  /* Search input inside currency sheet */
  .pf-search-input {
    width: 100%; padding: 9px 10px 9px 34px;
    border-radius: 10px; border: 1px solid rgba(120,120,160,0.22);
    background: rgba(0,0,0,0.30); outline: none;
    font-size: 15px; color: #fff; font-family: var(--font);
    -webkit-appearance: none; appearance: none;
  }
  .pf-search-input::placeholder { color: rgba(255,255,255,0.30); }
  .pf-search-input:focus { border-color: rgba(100,220,100,0.50); }
`;

// ─────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────
const Skel: React.FC<{ w?: number | string; h?: number; r?: number }> = ({ w = '100%', h = 16, r = 6 }) => (
  <div className="pf-skel" style={{ width: w, height: h, borderRadius: r }} />
);

// ─────────────────────────────────────────────
// CURRENCY SHEET (dark green)
// ─────────────────────────────────────────────
const CurrencySheet: React.FC<{
  open: boolean; onClose: () => void;
  currencies: CurrencyOption[]; current: string;
  onSelect: (iso: string) => Promise<void>; loading: boolean;
}> = ({ open, onClose, currencies, current, onSelect, loading }) => {
  const { t } = useLanguage();
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const prevOverflow = document.body.style.overflow;
      const prevTouch = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      return () => { document.body.style.overflow = prevOverflow; document.body.style.touchAction = prevTouch; };
    }
  }, [open]);

  useEffect(() => {
    if (open) { setQ(''); setTimeout(() => inputRef.current?.focus(), 300); }
  }, [open]);
  if (!open) return null;

  const filtered = q.trim()
    ? currencies.filter(c => c.iso.toLowerCase().includes(q.toLowerCase()) || (c.name || '').toLowerCase().includes(q.toLowerCase()))
    : currencies;

  return (
    <div className="pf-root" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, touchAction: 'none' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', animation: 'pf-bd-in 0.25s ease' }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, maxHeight: '70dvh', display: 'flex', flexDirection: 'column', background: 'rgba(10,10,22,0.97)', border: '1px solid rgba(100,100,160,0.22)', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.55)', animation: 'pf-pop-in 0.28s cubic-bezier(0.32,0.72,0,1)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ flexShrink: 0, padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: '#fff', letterSpacing: -0.4 }}>{t('profile.selectCurrency')}</span>
          <button onClick={onClose} className="pf-modal-close-btn" aria-label="Tutup">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        </div>
        {/* Search */}
        <div style={{ flexShrink: 0, padding: '10px 16px' }}>
          <div style={{ position: 'relative' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.30)" strokeWidth="2.2" strokeLinecap="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder={t('common.search')} className="pf-search-input" />
          </div>
        </div>
        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1, overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch' }}>
          {filtered.length === 0
            ? <div style={{ padding: '48px 0', textAlign: 'center', color: 'rgba(255,255,255,0.30)', fontSize: 14 }}>{t('common.notFound')}</div>
            : filtered.map((c, i) => {
                const sel = c.iso === current;
                return (
                  <button key={c.iso} onClick={() => onSelect(c.iso).then(onClose)} disabled={loading} className="pf-curr-item" style={{ opacity: loading ? 0.6 : 1 }}>
                    <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                      <p style={{ fontSize: 16, color: sel ? '#66bb6a' : '#fff', fontWeight: sel ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.iso}</p>
                      {c.name && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>}
                    </div>
                    {c.symbol && <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>{c.symbol}</span>}
                    {sel && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#66bb6a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M20 6L9 17l-5-5"/></svg>}
                  </button>
                );
              })}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// LOGOUT CONFIRM (dark green)
// ─────────────────────────────────────────────
const LogoutAlert: React.FC<{ open: boolean; onCancel: () => void; onConfirm: () => void }> = ({ open, onCancel, onConfirm }) => {
  const { t } = useLanguage();

  useEffect(() => {
    if (open) {
      const prevOverflow = document.body.style.overflow;
      const prevTouch = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      return () => { document.body.style.overflow = prevOverflow; document.body.style.touchAction = prevTouch; };
    }
  }, [open]);

  if (!open) return null;
  return (
    <div className="pf-root" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', touchAction: 'none' }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', animation: 'pf-bd-in 0.2s ease' }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 320, animation: 'pf-pop-in 0.28s cubic-bezier(0.32,0.72,0,1)' }}>
        <div style={{ background: 'rgba(10,10,22,0.97)', border: '1px solid rgba(100,100,160,0.22)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.55)' }}>
          <div style={{ padding: '24px 20px 16px', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff453a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
            <p style={{ fontSize: 17, fontWeight: 600, color: '#fff', marginBottom: 6, letterSpacing: -0.3 }}>{t('profile.logoutConfirm')}</p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.50)', lineHeight: 1.5 }}>{t('profile.logoutMessage')}</p>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.09)', display: 'flex' }}>
            <button onClick={onCancel} style={{ flex: 1, padding: '16px', background: 'transparent', border: 'none', borderRight: '1px solid rgba(255,255,255,0.09)', cursor: 'pointer', fontSize: 17, fontWeight: 600, color: '#66bb6a', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent' }}>{t('common.cancel')}</button>
            <button onClick={onConfirm} style={{ flex: 1, padding: '16px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 17, fontWeight: 400, color: '#ff453a', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent' }}>{t('profile.logout')}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// MAIN PAGE CONTENT
// ─────────────────────────────────────────────
function ProfilePageContent() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const [isLoading, setIsLoading]             = useState(true);
  const [profile, setProfile]                 = useState<UserProfileData | null>(null);
  const [balance, setBalance]                 = useState<ProfileBalance | null>(null);
  const [currencies, setCurrencies]           = useState<CurrencyOption[]>([]);
  const [sheetOpen, setSheetOpen]             = useState(false);
  const [langSheetOpen, setLangSheetOpen]     = useState(false);
  const [currencyLoading, setCurrencyLoading] = useState(false);
  const [showLogout, setShowLogout]           = useState(false);
  const [logoutSplash, setLogoutSplash]       = useState(false);
  const [copied, setCopied]                   = useState(false);
  const [isAdminUser, setIsAdminUser]         = useState(false);
  const [isSuperAdminUser, setIsSuperAdminUser] = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [profileCurrencyUnit, setProfileCurrencyUnit] = useState<string>('');
  const [refreshing, setRefreshing]           = useState(false);

  useEffect(() => {
    const init = async () => {
      const sessionValid = await isSessionValid();
      if (!sessionValid) { router.push('/login'); return; }
      loadProfile();
      try {
        const email = await storage.get('stc_email') ?? '';
        if (email) {
          const [adm, sup] = await Promise.all([checkIsAdmin(email), checkIsSuperAdmin(email)]);
          setIsAdminUser(adm || sup);
          setIsSuperAdminUser(sup);
        }
      } catch { /* ignore */ }
    };
    init();
  }, []); // eslint-disable-line

  const loadProfile = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) { router.push('/login'); return; }
      const [prof, bal] = await Promise.all([api.getProfile(), api.balance().catch(() => null)]);
      setProfile(prof); setBalance(bal);
      // ── Sync bahasa & currency dari data akun ──────────────────────────────
      // Pastikan bahasa UI mengikuti country akun (override default/manual jika perlu)
      const accountCountry = prof.country || prof.registrationCountryIso;
      if (accountCountry) {
        applyLanguageFromCountry(accountCountry, setLanguage);
      }
      // Sync currency unit dari session storage (dari login flow)
      try {
        const sessionCurrencyUnit = await storage.get(SESSION_KEYS.CURRENCY_ISO);
        if (sessionCurrencyUnit) { setProfileCurrencyUnit(sessionCurrencyUnit); }
      } catch { /* ignore */ }
      // ─────────────────────────────────────────────────────────────────────────
      fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/profile/currencies`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()).then(data => {
        const list: any[] = Array.isArray(data) ? data : (data?.data ?? []);
        setCurrencies(list.map((c: any) => ({ iso: c.iso ?? c.currency_iso ?? c.code ?? c, name: c.name ?? c.currency_name ?? '', symbol: c.symbol ?? '' })));
      }).catch(() => {});
    } catch (err: any) {
      if (err?.status === 401) { router.push('/login'); return; }
      setError(t('profile.loadError'));
    } finally {
      setIsLoading(false); setRefreshing(false);
    }
  }, [router, t]);

  const handleUpdateCurrency = async (iso: string) => {
    setCurrencyLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) return;
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/profile/currency`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currencyIso: iso }),
      });
      const bal = await api.balance().catch(() => null);
      if (bal) setBalance(bal);

      // ✅ FIX: Simpan currency baru ke session storage agar Dashboard
      // membaca nilai yang benar saat user kembali dari halaman ini.
      const ISO_TO_UNIT: Record<string, string> = {
        IDR: 'Rp',    USD: '$',    EUR: '€',    GBP: '£',    BRL: 'R$',
        COP: 'Col$',  MXN: 'MX$', ARS: 'AR$',  PEN: 'S/',   CLP: 'CL$',
        NGN: '₦',     KES: 'KSh', GHS: 'GH₵',  ZAR: 'R',
        INR: '₹',     PKR: '₨',   BDT: '৳',    LKR: 'Rs',
        PHP: '₱',     VND: '₫',   THB: '฿',    MYR: 'RM',   SGD: 'S$',
        TRY: '₺',     UAH: '₴',   KZT: '₸',    UZS: "so'm",
        RUB: '₽',     AMD: '֏',   AZN: '₼',    GEL: '₾',
        EGP: 'E£',    MAD: 'MAD', TND: 'DT',   DZD: 'DA',
        SAR: '﷼',     AED: 'AED', KWD: 'KD',   QAR: 'QR',   OMR: 'OMR',
      };
      const unit = ISO_TO_UNIT[iso] ?? iso;
      await saveCurrencyWithIso(iso, unit);
      // Update tampilan di halaman profile secara langsung
      setProfileCurrencyUnit(unit);
    } finally { setCurrencyLoading(false); }
  };

  const handleLogout = async () => {
    setShowLogout(false);
    window.dispatchEvent(new CustomEvent('stc:hidenav'));
    setLogoutSplash(true);
    await new Promise(res => setTimeout(res, 1800));
    try {
      const { stcWebView } = await import('@/plugins/StcWebViewPlugin');
      await stcWebView.clearSession();
    } catch (e) { console.warn('[Logout] clearSession WebView error (non-fatal):', e); }
    await sessionLogout();
    const rememberEmail = localStorage.getItem('stc_remember_email');
    const rememberPass  = localStorage.getItem('stc_remember_password');
    localStorage.clear();
    if (rememberEmail) localStorage.setItem('stc_remember_email', rememberEmail);
    if (rememberPass)  localStorage.setItem('stc_remember_password', rememberPass);
    sessionStorage.clear();
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch { /* ignore */ }
    try {
      const dbs = await indexedDB.databases?.() ?? [];
      await Promise.all(dbs.map(db => db.name ? indexedDB.deleteDatabase(db.name) : Promise.resolve()));
    } catch { /* ignore */ }
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
    const localeMap: Record<string, string> = { en: 'en-US', id: 'id-ID', ru: 'ru-RU', es: 'es-ES', ms: 'ms-MY', hi: 'hi-IN', th: 'th-TH', tr: 'tr-TR' };
    return val.toLocaleString(localeMap[language] ?? 'en-US', { maximumFractionDigits: 0 });
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
  const currencyUnit = profileCurrencyUnit || (currency === 'IDR' ? 'Rp' : currency);

  // ── Sub-components ─────────────────────────────────────
  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="pf-section-label">{children}</p>
  );

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="pf-card">{children}</div>
  );

  const InfoRow = ({ label, value, verified, last }: { label: string; value?: string | null; verified?: boolean; last?: boolean }) => (
    <div className={last ? '' : 'pf-info-row'} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {verified != null && (
          <span style={{ fontSize: 11, fontWeight: 600, color: verified ? '#30d158' : '#ff9f0a', background: verified ? 'rgba(48,209,88,0.12)' : 'rgba(255,159,10,0.12)', padding: '2px 7px', borderRadius: 99, flexShrink: 0 }}>
            {verified ? t('profile.verified') : t('profile.notVerified')}
          </span>
        )}
        <span style={{ fontSize: 14, color: value ? 'rgba(255,255,255,0.40)' : 'rgba(255,255,255,0.20)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 'min(180px, 50vw)' }}>{value || '—'}</span>
      </div>
    </div>
  );

  const TappableRow = ({ icon, iconBg, label, value, danger, onClick, last, chevron = true }: {
    icon: React.ReactNode; iconBg: string; label: string; value?: string;
    danger?: boolean; onClick: () => void; last?: boolean; chevron?: boolean;
  }) => (
    <button onClick={onClick} className="pf-tap-row" style={{ borderBottom: last ? 'none' : undefined }}>
      <div style={{ width: 30, height: 30, borderRadius: 7, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <span style={{ flex: 1, fontSize: 15, color: danger ? '#ff453a' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {value && <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.40)', marginRight: 4, flexShrink: 0, maxWidth: '40vw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>}
      {chevron && <svg width="6" height="11" viewBox="0 0 7 12" fill="none" style={{ flexShrink: 0 }}><path d="M1 1l5 5-5 5" stroke={danger ? '#ff453a' : 'rgba(255,255,255,0.30)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </button>
  );

  const AvatarBlock = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      {/* Avatar circle */}
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(145deg, #4caf50, #66bb6a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 700, color: '#fff', boxShadow: '0 4px 20px rgba(76,175,80,0.25), 0 0 0 3px rgba(76,175,80,0.12)', marginBottom: 12, animation: 'pf-pop-in 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.08s both', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
        {isLoading ? '' : profile?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveAvatarUrl(profile.avatar) ?? profile.avatar}
            alt={getDisplayName()}
            width={80}
            height={80}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          getInitials()
        )}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, width: '100%' }}>
          <Skel w="60%" h={18} r={6} /><Skel w="75%" h={13} r={5} />
        </div>
      ) : (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: -0.4, marginBottom: 3, lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 12px' }}>{getDisplayName()}</h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 10, wordBreak: 'break-all', maxWidth: 'min(220px, 80vw)', lineHeight: 1.4 }}>{profile?.email}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {profile?.docsVerified && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#30d158', background: 'rgba(48,209,88,0.12)', border: '1px solid rgba(48,209,88,0.20)', padding: '3px 10px', borderRadius: 99 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                {t('profile.verified')}
              </span>
            )}
            {profile?.id && (
              <button className="pf-copy-btn" onClick={copyId} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', padding: '3px 10px', borderRadius: 99, cursor: 'pointer', transition: 'opacity 0.15s', WebkitTapHighlightColor: 'transparent' }}>
                ID: {String(profile.id).slice(0, 8)}…
                {copied
                  ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#30d158" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
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
    <div style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
      {[
        {
          label: t('profile.balanceReal'), color: '#30d158', bgColor: 'rgba(48,209,88,0.12)', val: balance?.real_balance, sub: currencyUnit,
          icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#30d158" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>,
        },
        {
          label: t('profile.balanceDemo'), color: '#ff9f0a', bgColor: 'rgba(255,159,10,0.12)', val: balance?.demo_balance, sub: t('common.virtual'),
          icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff9f0a" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>,
        },
      ].map(({ label, color, bgColor, val, sub, icon }) => (
        <div key={label} style={{ flex: 1, minWidth: 0, background: 'rgba(10,10,22,0.75)', border: '1px solid rgba(120,120,160,0.16)', borderRadius: 12, padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: 8, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
            <span style={{ fontSize: 10, fontWeight: 600, color, textTransform: 'uppercase' as const, letterSpacing: '0.04em', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            {isLoading
              ? <Skel w="85%" h={16} r={4} />
              : <p className="pf-balance-num" style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: -0.4, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmtBalance(val)}</p>
            }
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.30)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</p>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div
      className="pf-root"
      style={{
        height: '100dvh',
        background: 'var(--bg)',
        fontFamily: 'var(--font)',
        WebkitFontSmoothing: 'antialiased',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: PROFILE_STYLES }} />

      {/* ── Ambient orbs ── */}
      <div className="pf-orb pf-orb-1" />
      <div className="pf-orb pf-orb-2" />

      {/* ── LOGOUT SPLASH ── */}
      {logoutSplash && (
        <div className="lo-splash">
          <div className="lo-orb lo-orb-1" />
          <div className="lo-orb lo-orb-2" />
          <div className="lo-orb lo-orb-3" />
          <div className="lo-icon-wrap">
            <div className="lo-ring" />
            <div className="lo-ring lo-ring-2" />
            <div className="lo-ring lo-ring-3" />
            <div className="lo-icon">👋</div>
          </div>
          <div className="lo-text">
            <p className="lo-title">Sampai jumpa!</p>
            <p className="lo-sub">Anda berhasil keluar.<br/>Sampai bertemu kembali.</p>
          </div>
          <div className="lo-bar-wrap">
            <div className="lo-bar" />
          </div>
        </div>
      )}

      {/* ── MOBILE HEADER ── */}
      <div className="pf-mob-header" style={{ width: '100%', zIndex: 50, background: 'rgba(8,8,18,0.88)', backdropFilter: 'saturate(140%) blur(22px)', WebkitBackdropFilter: 'saturate(140%) blur(22px)', borderBottom: '0.5px solid rgba(76,175,80,0.18)', position: 'relative' }}>
        <div style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ fontSize: 17, fontWeight: 600, color: '#fff', letterSpacing: -0.4 }}>{t('profile.title')}</h1>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="pf-body">

        {/* ══ LEFT SIDEBAR (desktop) ══ */}
        <div className="pf-left">
          <AvatarBlock />
          <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.09)', margin: '0 4px' }} />
          <div>
            <SectionLabel>{t('common.balance')}</SectionLabel>
            <BalanceBlock />
          </div>
          <div style={{ marginTop: 'auto' }}>
            {isAdminUser && (
              <div style={{ marginBottom: 12 }}>
                <Card>
                  <TappableRow
                    icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
                    iconBg="linear-gradient(135deg, #F59E0B, #D97706)"
                    label="Admin Panel"
                    value={isSuperAdminUser ? 'Super Admin' : 'Admin'}
                    onClick={() => router.push('/admin')}
                    last
                  />
                </Card>
              </div>
            )}
            <Card>
              <TappableRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>}
                iconBg="#ff453a" label={t('profile.logout')} danger onClick={() => setShowLogout(true)} last
              />
            </Card>
            <p style={{ textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,0.25)', marginTop: 14 }}>STC AutoTrade v2.0.0</p>
          </div>
        </div>

        {/* ══ RIGHT PANEL ══ */}
        <div className="pf-right">

          {/* Desktop header */}
          <div className="pf-desk-header">
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: -0.5 }}>{t('profile.title')}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => setLangSheetOpen(true)}
                style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}
                title={t('language.title')}
              >
                🌐
              </button>
              <button onClick={() => loadProfile(true)} disabled={refreshing || isLoading}
                style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#66bb6a', opacity: (refreshing || isLoading) ? 0.4 : 1, transition: 'opacity 0.15s' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ animation: (refreshing || isLoading) ? 'pf-spin 0.8s linear infinite' : 'none' }}>
                  <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, background: 'rgba(255,69,58,0.10)', border: '1px solid rgba(255,69,58,0.22)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ff453a" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
              <span style={{ fontSize: 13, color: '#ff453a', flex: 1 }}>{error}</span>
              <button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ff453a', opacity: 0.6, padding: 4, flexShrink: 0 }}>
                <svg width="11" height="11" viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              </button>
            </div>
          )}

          {/* Mobile-only: avatar + balance */}
          <div className="pf-mob-only">
            <div style={{ marginBottom: 22 }}><AvatarBlock /></div>
            <div>
              <SectionLabel>{t('common.balance')}</SectionLabel>
              <BalanceBlock />
            </div>
          </div>

          {/* Account info */}
          <div>
            <SectionLabel>{t('profile.accountInfo')}</SectionLabel>
            <Card>
              {isLoading ? (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[1,2,3,4].map(i => <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}><Skel w={80} h={13} /><Skel w={130} h={13} /></div>)}
                </div>
              ) : (
                <>
                  <InfoRow label={t('profile.email')} value={profile?.email} />
                  <InfoRow label={t('profile.emailVerified')} verified={profile?.emailVerified} value={profile?.emailVerified ? t('common.yes') : t('common.no')} />
                  <InfoRow label={t('profile.phone')} value={profile?.phone || null} />
                  <InfoRow label={t('profile.phoneVerified')} verified={profile?.phoneVerified} value={profile?.phoneVerified ? t('common.yes') : t('common.no')} />
                  <InfoRow label={t('profile.country')} value={profile?.country || profile?.registrationCountryIso || null} />
                  {profile?.registeredAt && <InfoRow label={t('profile.joined')} value={formatDate(new Date(profile.registeredAt), language, { day: '2-digit', month: 'long', year: 'numeric' })} />}
                  <InfoRow label={t('profile.birthday')} value={profile?.birthday ? formatDate(new Date(profile.birthday), language, { day: '2-digit', month: 'long', year: 'numeric' }) : null} last />
                </>
              )}
            </Card>
          </div>

          {/* Settings */}
          <div>
            <SectionLabel>{t('profile.settings')}</SectionLabel>
            <Card>
              <TappableRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>}
                iconBg="linear-gradient(135deg, #10B981, #34D399)"
                label={t('language.title')}
                value={t(`language.${{ en: 'english', id: 'indonesian', ru: 'russian', es: 'spanish', ms: 'malay', hi: 'hindi', th: 'thai', tr: 'turkish' }[language] ?? 'english'}`).toLowerCase()}
                onClick={() => setLangSheetOpen(true)}
              />
              <TappableRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>}
                iconBg="#10B981" label={t('common.currency')} value={currencyLoading ? '…' : `${currency} (${currencyUnit})`}
                onClick={() => currencies.length > 0 && setSheetOpen(true)} chevron={currencies.length > 0} last
              />
            </Card>
          </div>

          {/* Admin */}
          {isAdminUser && (
            <div>
              <SectionLabel>Admin</SectionLabel>
              <Card>
                <TappableRow
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
                  iconBg="linear-gradient(135deg, #F59E0B, #D97706)"
                  label="Admin Panel"
                  value={isSuperAdminUser ? 'Super Admin' : 'Admin'}
                  onClick={() => router.push('/admin')}
                  last
                />
              </Card>
            </div>
          )}

          {/* Help */}
          <div>
            <SectionLabel>{t('profile.help')}</SectionLabel>
            {/* <AppUpdateCard /> */}
            <Card>
              <TappableRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3m.08 4h.01"/></svg>}
                iconBg="#5ac8fa" label={t('profile.termsOfService')} onClick={() => window.open('https://stockity.id/information/agreement', '_blank')}
              />
              <TappableRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
                iconBg="#34c759" label={t('profile.privacyPolicy')} onClick={() => window.open('https://stockity.id/information/privacy', '_blank')} last
              />
            </Card>
          </div>

          {/* Mobile-only: logout */}
          <div className="pf-mob-only">
            <Card>
              <TappableRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>}
                iconBg="#ff453a" label={t('profile.logout')} danger onClick={() => setShowLogout(true)} last
              />
            </Card>
            <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 14 }}>STC AutoTrade v2.0.0</p>
          </div>

        </div>
      </div>

      <CurrencySheet open={sheetOpen} onClose={() => setSheetOpen(false)} currencies={currencies} current={currency} onSelect={handleUpdateCurrency} loading={currencyLoading} />
      <LanguageSheet open={langSheetOpen} onClose={() => setLangSheetOpen(false)} />
      <LogoutAlert open={showLogout} onCancel={() => setShowLogout(false)} onConfirm={handleLogout} />
    </div>
  );
}

// ─────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────
export default function ProfilePage() {
  return <ProfilePageContent />;
}