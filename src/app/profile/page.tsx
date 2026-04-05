'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, type ProfileBalance } from '@/lib/api';
import {
  ArrowLeft, User, Mail, Smartphone, Globe, Wallet,
  LogOut, ChevronRight, Shield, CircleDollarSign,
  Copy, Check, AlertCircle, ChevronDown, X, RefreshCw,
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
  text:  '#ffffff',
  sub:   'rgba(255,255,255,0.95)',
  muted: 'rgba(255,255,255,0.65)',
  faint: 'rgba(52,211,153,0.10)',
};

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

interface CurrencyOption {
  iso: string;
  name?: string;
  symbol?: string;
}

// ═══════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════
const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> =
  ({ children, style }) => (
    <div className="ds-card overflow-hidden" style={{
      boxShadow: '0 4px 18px rgba(52,211,153,0.05), 0 2px 8px rgba(0,0,0,0.3)',
      ...style,
    }}>{children}</div>
  );

const StatRow: React.FC<{
  label: string;
  value: string | number;
  color?: string;
  last?: boolean;
}> = ({ label, value, color = C.text, last }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '11px 0', borderBottom: last ? 'none' : `1px solid ${C.bdr}`,
  }}>
    <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 600, color, maxWidth: '60%', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
  </div>
);

// ═══════════════════════════════════════════
// CURRENCY PICKER MODAL
// ═══════════════════════════════════════════
const CurrencyModal: React.FC<{
  open: boolean;
  onClose: () => void;
  currencies: CurrencyOption[];
  current: string;
  onSelect: (iso: string) => Promise<void>;
  loading: boolean;
}> = ({ open, onClose, currencies, current, onSelect, loading }) => {
  const [q, setQ] = useState('');
  useEffect(() => { if (open) setQ(''); }, [open]);
  if (!open) return null;

  const filtered = q.trim()
    ? currencies.filter(c =>
        c.iso.toLowerCase().includes(q.toLowerCase()) ||
        (c.name || '').toLowerCase().includes(q.toLowerCase())
      )
    : currencies;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center',
    }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }} />
      <div style={{
        position: 'relative', width: '100%', maxWidth: 480,
        maxHeight: 'calc(100dvh - 80px)',
        display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(160deg,#0b1812 0%,#081310 100%)',
        borderRadius: '16px 16px 0 0', border: `1px solid ${C.bdr}`,
        borderBottom: 'none', overflow: 'hidden',
        animation: 'slide-up 0.25s cubic-bezier(0.32,0.72,0,1)',
      }}>
        <div style={{ width: 32, height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.12)', margin: '12px auto 0', flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px 12px', borderBottom: `1px solid ${C.bdr}`, flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Pilih Mata Uang</span>
          <button onClick={onClose} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: `1px solid rgba(255,255,255,0.08)`, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid rgba(255,255,255,0.05)`, flexShrink: 0 }}>
          <input
            autoFocus
            className="ds-input"
            style={{ fontSize: 13, borderRadius: 8 }}
            placeholder="Cari mata uang..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.map((cur, i) => {
            const isSel = cur.iso === current;
            return (
              <button
                key={cur.iso}
                onClick={() => onSelect(cur.iso).then(onClose)}
                disabled={loading}
                style={{
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px',
                  background: isSel ? 'rgba(52,211,153,0.08)' : 'transparent',
                  borderBottom: i < filtered.length - 1 ? `1px solid rgba(255,255,255,0.04)` : 'none',
                  borderLeft: isSel ? `2px solid ${C.cyan}` : '2px solid transparent',
                  borderTop: 'none', borderRight: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                <div style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: isSel ? 600 : 400, color: isSel ? C.cyan : C.text }}>
                    {cur.iso}
                  </span>
                  {cur.name && (
                    <span style={{ display: 'block', fontSize: 11, marginTop: 2, color: C.muted }}>{cur.name}</span>
                  )}
                </div>
                {cur.symbol && <span style={{ fontSize: 12, color: C.muted }}>{cur.symbol}</span>}
                {isSel && (
                  <span style={{ fontSize: 12, color: C.cyan }}>✓</span>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: C.muted, fontSize: 12 }}>
              Tidak ditemukan
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════
export default function ProfilePage() {
  const router = useRouter();
  const [isLoading, setIsLoading]             = useState(true);
  const [profile, setProfile]                 = useState<UserProfileData | null>(null);
  const [balance, setBalance]                 = useState<ProfileBalance | null>(null);
  const [currencies, setCurrencies]           = useState<CurrencyOption[]>([]);
  const [currencyModalOpen, setCurrencyModal] = useState(false);
  const [currencyLoading, setCurrencyLoading] = useState(false);
  const [copied, setCopied]                   = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('stc_token') : null;
    if (!token) { router.push('/login'); return; }
    loadProfile();
  }, []); // eslint-disable-line

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [prof, bal] = await Promise.all([
        api.getProfile(),
        api.balance().catch(() => null),
      ]);
      setProfile(prof);
      setBalance(bal);

      // Fetch currencies lazily (non-blocking)
      fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/profile/currencies`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('stc_token')}` },
      })
        .then(r => r.json())
        .then(data => {
          const list: any[] = Array.isArray(data) ? data : (data?.data ?? []);
          setCurrencies(list.map((c: any) => ({
            iso: c.iso ?? c.currency_iso ?? c.code ?? c,
            name: c.name ?? c.currency_name ?? '',
            symbol: c.symbol ?? '',
          })));
        })
        .catch(() => {});
    } catch (err: any) {
      if (err?.status === 401) { router.push('/login'); return; }
      setError('Gagal memuat profil.');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const handleUpdateCurrency = async (iso: string) => {
    setCurrencyLoading(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/profile/currency`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('stc_token')}`,
        },
        body: JSON.stringify({ currencyIso: iso }),
      });
      // Refresh balance to show updated currency
      const bal = await api.balance().catch(() => null);
      if (bal) setBalance(bal);
    } finally {
      setCurrencyLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('stc_token');
    localStorage.removeItem('stc_user');
    router.push('/login');
  };

  const copyUserId = () => {
    if (profile?.id) {
      navigator.clipboard.writeText(String(profile.id));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Balance dari API dalam satuan cent → bagi 100
  const formatCurrency = (amount?: number) => {
    if (amount == null) return '0';
    return (amount / 100).toLocaleString('id-ID');
  };

  const getUserInitials = () => {
    const f = profile?.firstName?.[0] || '';
    const l = profile?.lastName?.[0] || '';
    return (f + l).toUpperCase() || profile?.nickname?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U';
  };

  const getDisplayName = () => {
    const f = profile?.firstName?.trim() || '';
    const l = profile?.lastName?.trim() || '';
    if (f && l) return `${f} ${l}`;
    if (f) return f;
    if (l) return l;
    return profile?.nickname?.trim() || profile?.email?.split('@')[0] || `User ${profile?.id || ''}`;
  };

  const currentCurrency = balance?.currency || 'IDR';

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, paddingBottom: 100 }}>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(15,15,15,0.95)', backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${C.bdr}`,
      }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Link href="/dashboard" style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.bdr}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted,
              }}>
                <ArrowLeft size={18} />
              </Link>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Profil</h1>
            </div>
            <button
              onClick={() => loadProfile()}
              disabled={isLoading}
              style={{
                width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.bdr}`,
                background: C.faint, color: C.muted, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <RefreshCw style={{ width: 14, height: 14, animation: isLoading ? 'spin 0.7s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px' }}>

        {/* Error */}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10,
            background: C.cord, border: '1px solid rgba(248,113,113,0.25)', marginBottom: 14,
          }}>
            <AlertCircle size={14} color={C.coral} />
            <span style={{ fontSize: 12, color: C.coral, flex: 1 }}>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.coral }}>
              <X style={{ width: 13, height: 13 }} />
            </button>
          </div>
        )}

        {/* ── Profile Card ── */}
        <Card style={{ marginBottom: 14, padding: '24px 20px', textAlign: 'center' }}>
          {isLoading ? (
            <div style={{ padding: 20 }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', margin: '0 auto 16px', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ width: 120, height: 14, borderRadius: 4, background: 'rgba(255,255,255,0.05)', margin: '0 auto 8px' }} />
              <div style={{ width: 180, height: 11, borderRadius: 4, background: 'rgba(255,255,255,0.05)', margin: '0 auto' }} />
            </div>
          ) : (
            <>
              {/* Avatar */}
              <div style={{
                width: 88, height: 88, borderRadius: '50%',
                background: `linear-gradient(135deg,${C.cyan}30,${C.cyan}10)`,
                border: `2px solid ${C.cyan}50`,
                margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, fontWeight: 700, color: C.cyan,
                boxShadow: `0 0 30px ${C.cyan}20`,
              }}>
                {getUserInitials()}
              </div>

              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                {getDisplayName()}
              </h2>
              <p style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
                {profile?.email || '—'}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                {/* Copy ID */}
                {profile?.id && (
                  <button
                    onClick={copyUserId}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '5px 12px', borderRadius: 99,
                      background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.bdr}`,
                      color: C.muted, fontSize: 11, cursor: 'pointer',
                    }}
                  >
                    ID: {String(profile.id).slice(0, 10)}…
                    {copied ? <Check size={12} color={C.cyan} /> : <Copy size={12} />}
                  </button>
                )}

                {/* Verified badge */}
                {profile?.docsVerified && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '5px 12px', borderRadius: 99,
                    background: `${C.cyan}15`, border: `1px solid ${C.cyan}30`,
                    color: C.cyan, fontSize: 10, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    <Shield size={11} /> Terverifikasi
                  </span>
                )}
              </div>
            </>
          )}
        </Card>

        {/* ── Saldo ── */}
        <Card style={{ marginBottom: 14 }}>
          <div style={{ padding: '13px 16px', borderBottom: `1px solid ${C.bdr}` }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.sub }}>Saldo</span>
          </div>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Real */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: 14, borderRadius: 12,
              background: 'rgba(52,211,153,0.06)', border: `1px solid ${C.bdr}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(52,211,153,0.12)', border: `1px solid ${C.bdr}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.cyan,
                }}>
                  <Wallet size={20} />
                </div>
                <div>
                  <p style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Real Account</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: C.cyan, marginTop: 2 }}>
                    {isLoading ? '—' : `Rp ${formatCurrency(balance?.real_balance)}`}
                  </p>
                </div>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
                background: 'rgba(52,211,153,0.12)', border: `1px solid ${C.bdr}`,
                color: C.cyan, textTransform: 'uppercase',
              }}>
                {currentCurrency}
              </span>
            </div>

            {/* Demo */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: 14, borderRadius: 12,
              background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.amber,
                }}>
                  <CircleDollarSign size={20} />
                </div>
                <div>
                  <p style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Demo Account</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: C.amber, marginTop: 2 }}>
                    {isLoading ? '—' : `Rp ${formatCurrency(balance?.demo_balance)}`}
                  </p>
                </div>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
                background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)',
                color: C.amber, textTransform: 'uppercase',
              }}>
                DEMO
              </span>
            </div>
          </div>
        </Card>

        {/* ── Informasi Akun ── */}
        <Card style={{ marginBottom: 14 }}>
          <div style={{ padding: '13px 16px', borderBottom: `1px solid ${C.bdr}` }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.sub }}>Informasi Akun</span>
          </div>
          <div style={{ padding: '0 16px' }}>
            <StatRow label="Email" value={profile?.email || '—'} />
            <StatRow
              label="Verifikasi Email"
              value={profile?.emailVerified ? 'Terverifikasi ✓' : 'Belum Verifikasi'}
              color={profile?.emailVerified ? C.cyan : C.muted}
            />
            <StatRow
              label="Nomor Telepon"
              value={profile?.phone || 'Belum diatur'}
              color={profile?.phone ? C.text : C.muted}
            />
            <StatRow
              label="Verifikasi Telepon"
              value={profile?.phoneVerified ? 'Terverifikasi ✓' : 'Belum Verifikasi'}
              color={profile?.phoneVerified ? C.cyan : C.muted}
            />
            <StatRow
              label="Negara"
              value={profile?.country || profile?.registrationCountryIso || '—'}
            />
            {profile?.registeredAt && (
              <StatRow
                label="Terdaftar Sejak"
                value={new Date(profile.registeredAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
              />
            )}
            {profile?.birthday && (
              <StatRow
                label="Tanggal Lahir"
                value={new Date(profile.birthday).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                last
              />
            )}
          </div>
        </Card>

        {/* ── Mata Uang ── */}
        <Card style={{ marginBottom: 14 }}>
          <div style={{ padding: '13px 16px', borderBottom: `1px solid ${C.bdr}` }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.sub }}>Mata Uang</span>
          </div>
          <button
            onClick={() => currencies.length > 0 && setCurrencyModal(true)}
            disabled={currencies.length === 0 || currencyLoading}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px', background: 'transparent', border: 'none',
              cursor: currencies.length > 0 ? 'pointer' : 'default',
              opacity: currencyLoading ? 0.6 : 1,
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(52,211,153,0.08)', border: `1px solid ${C.bdr}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.cyan,
            }}>
              <Globe size={18} />
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Mata Uang Aktif</p>
              <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{currentCurrency}</p>
            </div>
            {currencies.length > 0 && (
              <ChevronDown size={16} color={C.muted} />
            )}
          </button>
        </Card>

        {/* ── Logout ── */}
        <Card>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px', background: 'transparent', border: 'none',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.coral,
            }}>
              <LogOut size={18} />
            </div>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: C.coral }}>Keluar</span>
          </button>
        </Card>

        <p style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 24 }}>
          Stockity Bot v1.0.0
        </p>
      </div>

      {/* ── Currency Modal ── */}
      <CurrencyModal
        open={currencyModalOpen}
        onClose={() => setCurrencyModal(false)}
        currencies={currencies}
        current={currentCurrency}
        onSelect={handleUpdateCurrency}
        loading={currencyLoading}
      />

      {/* ── Logout Confirm Modal ── */}
      {showLogoutConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <Card style={{ width: '100%', maxWidth: 320, padding: 24, animation: 'slide-up 0.2s ease' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', color: C.coral,
            }}>
              <AlertCircle size={28} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, textAlign: 'center', marginBottom: 8 }}>
              Keluar dari Aplikasi?
            </h3>
            <p style={{ fontSize: 12, color: C.muted, textAlign: 'center', marginBottom: 24 }}>
              Anda perlu login kembali untuk mengakses akun.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.bdr}`,
                  color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Batal
              </button>
              <button
                onClick={handleLogout}
                style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)',
                  color: C.coral, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Keluar
              </button>
            </div>
          </Card>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:1} }
        @keyframes slide-up { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}