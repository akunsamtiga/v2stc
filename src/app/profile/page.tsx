'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, type ProfileBalance } from '@/lib/api';
import {
  ArrowLeft, User, Mail, Smartphone, Globe, Wallet,
  TrendingUp, TrendingDown, LogOut, ChevronRight,
  Shield, Bell, Moon, CircleDollarSign, Building2,
  Copy, Check, AlertCircle
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
  text:  '#ffffff',
  sub:   'rgba(255,255,255,0.95)',
  muted: 'rgba(255,255,255,0.65)',
  faint: 'rgba(52,211,153,0.10)',
};

interface UserProfile {
  id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  country?: string;
  avatar?: string;
  user_status?: string;
  created_at?: string;
  [key: string]: unknown;
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

const MenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  showArrow?: boolean;
}> = ({icon, label, value, onClick, danger, disabled, showArrow = true}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 16px', background: 'transparent', border: 'none',
      borderBottom: `1px solid ${C.bdr}`,
      color: danger ? C.coral : C.text,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      textAlign: 'left',
    }}
  >
    <div style={{
      width: 36, height: 36, borderRadius: 10,
      background: danger ? 'rgba(248,113,113,0.12)' : 'rgba(52,211,153,0.08)',
      border: `1px solid ${danger ? 'rgba(248,113,113,0.25)' : C.bdr}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: danger ? C.coral : C.cyan,
    }}>
      {icon}
    </div>
    <div style={{flex: 1}}>
      <p style={{fontSize: 13, fontWeight: 500, color: danger ? C.coral : C.text}}>
        {label}
      </p>
      {value && (
        <p style={{fontSize: 11, color: C.muted, marginTop: 2}}>{value}</p>
      )}
    </div>
    {showArrow && <ChevronRight size={16} color={C.muted} />}
  </button>
);

const StatRow: React.FC<{
  label: string;
  value: string | number;
  color?: string;
}> = ({label, value, color = C.text}) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 0', borderBottom: `1px solid ${C.bdr}`,
  }}>
    <span style={{fontSize: 12, color: C.muted}}>{label}</span>
    <span style={{fontSize: 13, fontWeight: 600, color}}>{value}</span>
  </div>
);

// ═══════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════
export default function ProfilePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [balance, setBalance] = useState<ProfileBalance | null>(null);
  const [copied, setCopied] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Check auth and load data
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('stc_token') : null;
    if (!token) {
      router.push('/login');
      return;
    }
    loadProfile();
  }, []);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get user info from localStorage (stored at login)
      const userStr = typeof window !== 'undefined' ? localStorage.getItem('stc_user') : null;
      let userData: UserProfile = {};
      
      if (userStr) {
        try {
          userData = JSON.parse(userStr);
        } catch {}
      }

      // Get additional profile data from API
      let profileData: UserProfile = userData;
      try {
        const apiProfile = await api.getProfile();
        profileData = { ...userData, ...apiProfile };
      } catch {}

      setProfile(profileData);

      // Get balance
      const bal = await api.balance().catch(() => null);
      setBalance(bal);
    } catch (err: any) {
      console.error('Failed to load profile:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('stc_token');
      localStorage.removeItem('stc_user');
    }
    router.push('/login');
  };

  const copyUserId = () => {
    if (profile?.id) {
      navigator.clipboard.writeText(profile.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatCurrency = (amount?: number) => {
    if (amount === undefined) return '0';
    return amount.toLocaleString('id-ID');
  };

  const getUserInitials = () => {
    const first = profile?.first_name?.[0] || '';
    const last = profile?.last_name?.[0] || '';
    return (first + last).toUpperCase() || profile?.email?.[0].toUpperCase() || 'U';
  };

  const getDisplayName = () => {
    if (profile?.first_name || profile?.last_name) {
      return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    }
    return profile?.email?.split('@')[0] || 'User';
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
            <h1 style={{fontSize: 18, fontWeight: 700, color: C.text}}>Profil</h1>
          </div>
        </div>
      </div>

      <div style={{maxWidth: 1280, margin: '0 auto', padding: '16px'}}>
        {/* Profile Card */}
        <Card style={{marginBottom: 16, padding: '24px 20px', textAlign: 'center'}}>
          {isLoading ? (
            <div style={{padding: 20}}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)',
                margin: '0 auto 16px',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
              <div style={{
                width: 120, height: 16, borderRadius: 4,
                background: 'rgba(255,255,255,0.05)',
                margin: '0 auto 8px',
              }} />
              <div style={{
                width: 180, height: 12, borderRadius: 4,
                background: 'rgba(255,255,255,0.05)',
                margin: '0 auto',
              }} />
            </div>
          ) : (
            <>
              {/* Avatar */}
              <div style={{
                width: 90, height: 90, borderRadius: '50%',
                background: `linear-gradient(135deg, ${C.cyan}30, ${C.cyan}10)`,
                border: `2px solid ${C.cyan}50`,
                margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, fontWeight: 700, color: C.cyan,
                boxShadow: `0 0 30px ${C.cyan}20`,
              }}>
                {getUserInitials()}
              </div>

              {/* Name */}
              <h2 style={{fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4}}>
                {getDisplayName()}
              </h2>

              {/* Email */}
              <p style={{fontSize: 12, color: C.muted, marginBottom: 12}}>
                {profile?.email || 'user@example.com'}
              </p>

              {/* User ID */}
              {profile?.id && (
                <button
                  onClick={copyUserId}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 99,
                    background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.bdr}`,
                    color: C.muted, fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  ID: {profile.id.slice(0, 12)}...
                  {copied ? <Check size={12} color={C.cyan} /> : <Copy size={12} />}
                </button>
              )}

              {/* Status Badge */}
              {profile?.user_status && (
                <div style={{marginTop: 12}}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 12px', borderRadius: 99,
                    background: `${C.amber}15`, border: `1px solid ${C.amber}30`,
                    color: C.amber, fontSize: 10, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    <Shield size={12} />
                    {profile.user_status}
                  </span>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Balance Section */}
        <Card style={{marginBottom: 16}}>
          <div style={{padding: '14px 16px', borderBottom: `1px solid ${C.bdr}`}}>
            <span style={{fontSize: 12, fontWeight: 600, color: C.sub}}>Saldo</span>
          </div>
          
          <div style={{padding: 16}}>
            {/* Real Balance */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px', borderRadius: 12,
              background: 'rgba(52,211,153,0.06)', border: `1px solid ${C.bdr}`,
              marginBottom: 12,
            }}>
              <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(52,211,153,0.12)', border: `1px solid ${C.bdr}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: C.cyan,
                }}>
                  <Wallet size={20} />
                </div>
                <div>
                  <p style={{fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em'}}>
                    Real Account
                  </p>
                  <p style={{fontSize: 18, fontWeight: 700, color: C.cyan, marginTop: 2}}>
                    Rp {formatCurrency(balance?.real_balance)}
                  </p>
                </div>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 99,
                background: 'rgba(52,211,153,0.12)', border: `1px solid ${C.bdr}`,
                color: C.cyan, textTransform: 'uppercase',
              }}>
                {balance?.currency || 'IDR'}
              </span>
            </div>

            {/* Demo Balance */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px', borderRadius: 12,
              background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)',
            }}>
              <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: C.amber,
                }}>
                  <CircleDollarSign size={20} />
                </div>
                <div>
                  <p style={{fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em'}}>
                    Demo Account
                  </p>
                  <p style={{fontSize: 18, fontWeight: 700, color: C.amber, marginTop: 2}}>
                    Rp {formatCurrency(balance?.demo_balance)}
                  </p>
                </div>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 99,
                background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)',
                color: C.amber, textTransform: 'uppercase',
              }}>
                DEMO
              </span>
            </div>
          </div>
        </Card>

        {/* Account Info */}
        <Card style={{marginBottom: 16}}>
          <div style={{padding: '14px 16px', borderBottom: `1px solid ${C.bdr}`}}>
            <span style={{fontSize: 12, fontWeight: 600, color: C.sub}}>Informasi Akun</span>
          </div>
          
          <div style={{padding: '0 16px'}}>
            <StatRow
              label="Email"
              value={profile?.email || '-'}
            />
            <StatRow
              label="Nomor Telepon"
              value={profile?.phone || 'Belum diatur'}
              color={profile?.phone ? C.text : C.muted}
            />
            <StatRow
              label="Negara"
              value={profile?.country || 'Indonesia'}
            />
            <StatRow
              label="Status Akun"
              value={profile?.user_status || 'Active'}
              color={C.cyan}
            />
          </div>
        </Card>

        {/* Settings */}
        <Card style={{marginBottom: 16}}>
          <div style={{padding: '14px 16px', borderBottom: `1px solid ${C.bdr}`}}>
            <span style={{fontSize: 12, fontWeight: 600, color: C.sub}}>Pengaturan</span>
          </div>
          
          <MenuItem
            icon={<Bell size={18} />}
            label="Notifikasi"
            value="Aktif"
            onClick={() => {}}
          />
          <MenuItem
            icon={<Moon size={18} />}
            label="Tampilan"
            value="Dark Mode"
            onClick={() => {}}
          />
          <MenuItem
            icon={<Globe size={18} />}
            label="Bahasa"
            value="Indonesia"
            onClick={() => {}}
          />
          <MenuItem
            icon={<Building2 size={18} />}
            label="Mata Uang"
            value={balance?.currency || 'IDR'}
            onClick={() => {}}
          />
        </Card>

        {/* Security */}
        <Card style={{marginBottom: 16}}>
          <div style={{padding: '14px 16px', borderBottom: `1px solid ${C.bdr}`}}>
            <span style={{fontSize: 12, fontWeight: 600, color: C.sub}}>Keamanan</span>
          </div>
          
          <MenuItem
            icon={<Shield size={18} />}
            label="Ubah Password"
            onClick={() => {}}
          />
          <MenuItem
            icon={<Smartphone size={18} />}
            label="Verifikasi 2-Faktor"
            value="Nonaktif"
            onClick={() => {}}
          />
        </Card>

        {/* Logout */}
        <Card>
          <MenuItem
            icon={<LogOut size={18} />}
            label="Keluar"
            danger
            showArrow={false}
            onClick={() => setShowLogoutConfirm(true)}
          />
        </Card>

        {/* Version */}
        <p style={{
          textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.2)',
          marginTop: 24,
        }}>
          Stockity Bot v1.0.0
        </p>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <Card style={{
            width: '100%', maxWidth: 320, padding: 24,
            animation: 'slide-up 0.2s ease',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              color: C.coral,
            }}>
              <AlertCircle size={28} />
            </div>
            
            <h3 style={{
              fontSize: 16, fontWeight: 700, color: C.text,
              textAlign: 'center', marginBottom: 8,
            }}>
              Keluar dari Aplikasi?
            </h3>
            
            <p style={{
              fontSize: 12, color: C.muted, textAlign: 'center',
              marginBottom: 24,
            }}>
              Anda perlu login kembali untuk mengakses akun.
            </p>
            
            <div style={{display: 'flex', gap: 12}}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.bdr}`,
                  color: C.muted, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Batal
              </button>
              <button
                onClick={handleLogout}
                style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)',
                  color: C.coral, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Keluar
              </button>
            </div>
          </Card>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}