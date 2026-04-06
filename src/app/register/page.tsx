// src/app/register/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { storage, saveUserSession, saveCurrencyWithIso } from '@/lib/storage';
import {
  fetchUserProfile,
  fetchUserCurrency,
  getFullName,
} from '@/lib/userProfileApi';
import {
  getWhitelistUserByEmail,
  getWhitelistUserByUserId,
  updateLastLogin,
  addWhitelistUser,
  getRegistrationConfig,
} from '@/lib/firebaseRepository';
import { stcWebView } from '@/plugins/StcWebViewPlugin';

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_REGISTRATION_URL = 'https://stockity.id/registered?a=25db72fbbc00';
const DEFAULT_WHATSAPP_URL     = 'https://wa.me/6285959860015';
const LOADING_DURATION         = 9_000;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function getOrCreateDeviceId(): Promise<string> {
  const stored = await storage.get('stc_device_id');
  if (stored) return stored;
  try {
    const { Device } = await import('@capacitor/device');
    const info = await Device.getId();
    const id   = (info as any).identifier ?? (info as any).uuid ?? crypto.randomUUID();
    await storage.set('stc_device_id', id);
    return id;
  } catch {
    const id = crypto.randomUUID();
    await storage.set('stc_device_id', id);
    return id;
  }
}

// ─── WhitelistResult — return type dari saveUserToWhitelistAndLogin ───────────
interface WhitelistResult {
  success:   boolean;
  error?:    string;
  isBlocked?: boolean;
  userId?:   string;
  email?:    string;
}

// ─── saveUserToWhitelistAndLogin ──────────────────────────────────────────────
async function saveUserToWhitelistAndLogin(
  authToken: string,
  deviceId:  string,
): Promise<WhitelistResult> {
  // ── STEP 0: Fetch user profile ──────────────────────────────────────────────
  let userProfile;
  try {
    userProfile = await fetchUserProfile(authToken, deviceId);
  } catch (e: unknown) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Terjadi kesalahan saat memproses akun',
    };
  }

  const userId = String(userProfile.id);

  // ── STEP 1: Check by email ──────────────────────────────────────────────────
  const byEmail = await getWhitelistUserByEmail(userProfile.email);
  if (byEmail) {
    if (!byEmail.isActive) {
      return {
        success:   false,
        isBlocked: true,
        error:     'Akun kamu belum aktif. Silahkan hubungi admin untuk aktivasi STC Autotrade.',
      };
    }
    await updateLastLogin(byEmail.userId);
    return { success: true, userId: byEmail.userId, email: userProfile.email };
  }

  // ── STEP 2: Check by userId ─────────────────────────────────────────────────
  const byUserId = await getWhitelistUserByUserId(userId);
  if (byUserId) {
    if (!byUserId.isActive) {
      return {
        success:   false,
        isBlocked: true,
        error:     'Akun Anda saat ini belum terhubung ke sistem STC AutoTrade. Hubungi admin untuk proses aktivasi.',
      };
    }
    await updateLastLogin(byUserId.userId);
    return { success: true, userId: byUserId.userId, email: userProfile.email };
  }

  // ── STEP 3: Create new user ─────────────────────────────────────────────────
  await addWhitelistUser({
    email:             userProfile.email,
    name:              getFullName(userProfile),
    userId,
    deviceId,
    isActive:          true,
    createdAt:         Date.now(),
    lastLogin:         Date.now(),
    addedBy:           'web_registration',
    addedAt:           Date.now(),
    fcmToken:          '',
    fcmTokenUpdatedAt: 0,
  });

  return { success: true, userId, email: userProfile.email };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SimpleLoadingDots() {
  return (
    <>
      <style>{`
        @keyframes dot-bounce {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-16px); }
        }
        .ld { width: 10px; height: 10px; border-radius: 50%; }
        .ld-1 { background:#87CEEB; animation: dot-bounce .6s ease-in-out infinite; animation-delay:   0ms; }
        .ld-2 { background:#9BB4D6; animation: dot-bounce .6s ease-in-out infinite; animation-delay: 150ms; }
        .ld-3 { background:#B0C4DE; animation: dot-bounce .6s ease-in-out infinite; animation-delay: 300ms; }
        .ld-4 { background:#ADD8E6; animation: dot-bounce .6s ease-in-out infinite; animation-delay: 450ms; }
      `}</style>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div className="ld ld-1" /><div className="ld ld-2" />
        <div className="ld ld-3" /><div className="ld ld-4" />
      </div>
    </>
  );
}

function LoadingOverlay({ progress, visible }: { progress: number; visible: boolean }) {
  if (!visible) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: '#ffffff',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 32,
      fontFamily: "-apple-system,'SF Pro Display',BlinkMacSystemFont,sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>
      <SimpleLoadingDots />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16, color: '#5F6368', fontWeight: 400 }}>Loading</span>
        <span style={{
          fontSize: 32, fontWeight: 700, color: '#000', letterSpacing: -1,
          transition: 'all 0.3s linear',
        }}>
          {Math.round(progress * 100)}%
        </span>
      </div>
    </div>
  );
}

function SavingDialog({ message = 'Mohon tunggu sebentar...' }: { message?: string }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "-apple-system,'SF Pro Display',BlinkMacSystemFont,sans-serif",
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: 32,
        width: 280, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 24,
        boxShadow: '0 16px 48px rgba(0,0,0,0.20)',
      }}>
        <style>{`@keyframes sv-spin { to { transform:rotate(360deg); } }`}</style>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: '4px solid rgba(66,133,244,0.15)', borderTopColor: '#4285F4',
          animation: 'sv-spin 0.7s linear infinite',
        }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#202124', marginBottom: 8 }}>
            Menghubungkan
          </div>
          <div style={{ fontSize: 14, color: '#5F6368' }}>{message}</div>
        </div>
      </div>
    </div>
  );
}

function ModernSuccessDialog({
  onLoginClick,
  onContinueClick,
}: {
  onLoginClick: () => void;
  onContinueClick: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  return (
    <>
      <style>{`
        @keyframes msd-scale {
          from { opacity:0; transform:scale(0.8); }
          to   { opacity:1; transform:scale(1);   }
        }
        @keyframes icon-pulse-scale { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }
        @keyframes icon-pulse-rot   { 0%,100%{transform:rotate(-5deg)} 50%{transform:rotate(5deg)} }
      `}</style>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: `rgba(0,0,0,${visible ? 0.6 : 0})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 20px',
        transition: 'background 0.4s ease',
        fontFamily: "-apple-system,'SF Pro Display',BlinkMacSystemFont,sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}>
        <div style={{
          background: '#fff', borderRadius: 32, padding: 32,
          width: '100%', maxWidth: 360,
          animation: visible ? 'msd-scale 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
          boxShadow: '0 24px 64px rgba(0,0,0,0.24)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
        }}>
          <div style={{ width: 120, height: 120, position: 'relative', marginBottom: 24 }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(52,168,83,0.20) 0%, rgba(52,168,83,0.05) 50%, transparent 70%)',
              animation: 'icon-pulse-scale 1s ease-in-out infinite, icon-pulse-rot 2s ease-in-out infinite',
            }} />
            <div style={{
              position: 'absolute', top: 25, left: 25, right: 25, bottom: 25,
              borderRadius: '50%', background: '#34A853',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(52,168,83,0.40)',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
          </div>

          <div style={{ fontSize: 32, fontWeight: 700, color: '#202124', letterSpacing: -0.5, marginBottom: 12 }}>
            Selamat! 🎉
          </div>
          <div style={{ fontSize: 20, fontWeight: 500, color: '#34A853', marginBottom: 16 }}>
            Registrasi Berhasil
          </div>
          <div style={{
            fontSize: 15, color: '#5F6368', textAlign: 'center',
            lineHeight: '22px', marginBottom: 32,
          }}>
            Akun Anda telah berhasil dibuat dan siap digunakan. Pilih langkah selanjutnya untuk melanjutkan.
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button onClick={onLoginClick} style={{
              width: '100%', height: 56, borderRadius: 16,
              background: '#4285F4', color: '#fff', border: 'none',
              fontSize: 16, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              boxShadow: '0 4px 12px rgba(66,133,244,0.35)',
              fontFamily: 'inherit',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Login STC Autotrade
            </button>

            <button onClick={onContinueClick} style={{
              width: '100%', height: 56, borderRadius: 16,
              background: 'transparent', color: '#4285F4',
              border: '1.5px solid rgba(66,133,244,0.30)',
              fontSize: 16, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              fontFamily: 'inherit',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
              Lanjut Trading
            </button>
          </div>

          <div style={{
            marginTop: 16, fontSize: 12, color: '#9AA0A6',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Anda dapat login kapan saja nanti
          </div>
        </div>
      </div>
    </>
  );
}

function ErrorDialog({
  message,
  isBlocked,
  onContactAdmin,
  onBack,
}: {
  message: string;
  isBlocked: boolean;
  onContactAdmin: () => void;
  onBack: () => void;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.60)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 20px',
      fontFamily: "-apple-system,'SF Pro Display',BlinkMacSystemFont,sans-serif",
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: 28,
        width: '100%', maxWidth: 360,
        boxShadow: '0 16px 48px rgba(0,0,0,0.20)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="#EA4335" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#202124' }}>
            {isBlocked ? 'Akun Diblokir' : 'Proses Gagal'}
          </span>
        </div>
        <p style={{ fontSize: 14, color: '#5F6368', lineHeight: '20px', marginBottom: 24, whiteSpace: 'pre-line' }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onBack} style={{
            flex: 1, height: 44, borderRadius: 12,
            background: 'transparent', color: '#5F6368',
            border: '1px solid rgba(0,0,0,0.15)',
            fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          }}>Kembali</button>
          <button onClick={onContactAdmin} style={{
            flex: 1, height: 44, borderRadius: 12,
            background: '#34A853', color: '#fff', border: 'none',
            fontSize: 14, fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontFamily: 'inherit',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
            </svg>
            Hubungi Admin
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const router = useRouter();

  const [mounted,            setMounted]            = useState(false);
  const [showLoading,        setShowLoading]        = useState(true);
  const [loadingProgress,    setLoadingProgress]    = useState(0);
  const [isProgressComplete, setIsProgressComplete] = useState(false);
  const [hasOpenedBrowser,   setHasOpenedBrowser]   = useState(false);

  const [showSuccessDialog,  setShowSuccessDialog]  = useState(false);
  const [hasShownSuccess,    setHasShownSuccess]    = useState(false);
  const [showSavingDialog,   setShowSavingDialog]   = useState(false);
  const [savingMessage,      setSavingMessage]      = useState('Mohon tunggu sebentar...');
  const [saveError,          setSaveError]          = useState<string | null>(null);
  const [isUserBlocked,      setIsUserBlocked]      = useState(false);

  const registrationUrl = useRef(DEFAULT_REGISTRATION_URL);
  const whatsappUrl     = useRef(DEFAULT_WHATSAPP_URL);
  const capturedToken   = useRef('');
  const capturedDevice  = useRef('');

  // ── Mount ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    const init = async () => {
      const token = await storage.get('stc_token');
      if (token) { router.replace('/dashboard'); return; }

      try {
        const cfg = await getRegistrationConfig();
        registrationUrl.current = cfg.registrationUrl;
        whatsappUrl.current     = cfg.whatsappHelpUrl;
      } catch { /* pakai default */ }
    };
    init();
  }, [router]);

  // ── Loading progress: 9s / 100 steps ──────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;
    const stepMs = LOADING_DURATION / 100;
    let count = 0;
    const iv = setInterval(() => {
      count++;
      setLoadingProgress(count / 100);
      if (count >= 100) { clearInterval(iv); setIsProgressComplete(true); }
    }, stepMs);
    return () => clearInterval(iv);
  }, [mounted]);

  // ── Setelah 100%: buka WebView ─────────────────────────────────────────────
  useEffect(() => {
    if (!isProgressComplete || hasOpenedBrowser) return;
    setHasOpenedBrowser(true);
    openRegistration();
  }, [isProgressComplete, hasOpenedBrowser]);

  useEffect(() => {
    if (!hasOpenedBrowser) return;
    const t = setTimeout(() => setShowLoading(false), 500);
    return () => clearTimeout(t);
  }, [hasOpenedBrowser]);

  const openRegistration = useCallback(async () => {
    try {
      const result = await stcWebView.open({ url: registrationUrl.current });

      if (result.success && result.authToken) {
        capturedToken.current  = result.authToken;
        capturedDevice.current = result.deviceId || await getOrCreateDeviceId();
        handleSuccessDetected();
      } else {
        // ✅ FIXED: Gunakan addListenerBrowserFinished (method terpisah)
        const handle = await stcWebView.addListenerBrowserFinished(() => {
          handle.remove();
          if (!hasShownSuccess) {
            setHasShownSuccess(true);
            setShowLoading(false);
            setShowSuccessDialog(true);
          }
        });
      }
    } catch (err) {
      console.error('[Register] openRegistration error:', err);
      setShowLoading(false);
    }
  }, [hasShownSuccess]);

  const handleSuccessDetected = useCallback(() => {
    if (hasShownSuccess) return;
    setShowLoading(false);
    setHasShownSuccess(true);
    setShowSuccessDialog(true);
  }, [hasShownSuccess]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { authToken, deviceId } = (e as CustomEvent).detail ?? {};
      if (authToken) capturedToken.current  = authToken;
      if (deviceId)  capturedDevice.current = deviceId;
      handleSuccessDetected();
    };
    window.addEventListener('stc:register:success', handler);
    window.addEventListener('stc:register:data',    handler);
    return () => {
      window.removeEventListener('stc:register:success', handler);
      window.removeEventListener('stc:register:data',    handler);
    };
  }, [handleSuccessDetected]);

  // ─────────────────────────────────────────────────────────────────────────
  // handleLoginClick
  // ✅ FIXED — Sekarang mirrors Kotlin RegisterViewModel.saveUserSession() secara penuh:
  //   1. saveUserToWhitelistAndLogin (whitelist check)
  //   2. saveUserSession dengan SEMUA field (bukan hanya 2)
  //   3. fetchUserCurrency — ambil KODE + SIMBOL unit ("IDR" + "Rp")
  //   4. saveCurrencyWithIso — simpan keduanya
  // ─────────────────────────────────────────────────────────────────────────
  const handleLoginClick = async () => {
    setShowSuccessDialog(false);
    const token    = capturedToken.current;
    const deviceId = capturedDevice.current || await getOrCreateDeviceId();

    if (token) {
      setShowSavingDialog(true);
      setSavingMessage('Memverifikasi akun...');

      try {
        // ── STEP 1: Whitelist check ──────────────────────────────────────────
        setSavingMessage('Memeriksa akses...');
        const result = await saveUserToWhitelistAndLogin(token, deviceId);

        if (!result.success) {
          setShowSavingDialog(false);
          setIsUserBlocked(result.isBlocked ?? false);
          setSaveError(result.error ?? 'Gagal memproses akun.');
          return;
        }

        // ── STEP 2: Simpan UserSession lengkap ───────────────────────────────
        // ✅ FIXED: mirrors Kotlin SessionManager.saveUserSession()
        setSavingMessage('Menyimpan sesi...');
        await saveUserSession({
          authtoken:    token,
          userId:       result.userId   ?? '',
          deviceId:     deviceId,
          email:        result.email    ?? '',
          userTimezone: 'Asia/Bangkok',
          userAgent:    USER_AGENT,
          deviceType:   'web',
          currency:     'IDR',          // default, akan diupdate setelah fetch
          currencyIso:  'IDR',          // default, akan diupdate setelah fetch
        });

        // ── STEP 3: Fetch currency — mirrors Kotlin currencyRepository.fetchUserCurrency()
        // ✅ FIXED: Kotlin menyimpan DUA nilai: currency code ("IDR") dan unit symbol ("Rp")
        try {
          setSavingMessage('Memuat data akun...');
          const currencyData = await fetchUserCurrency(token, deviceId);

          // ✅ FIXED: mirrors Kotlin sessionManager.saveCurrencyWithIso(currentCurrencyCode, unitSymbol)
          await saveCurrencyWithIso(currencyData.currency, currencyData.currencyIso);

          // Update session dengan currency yang benar
          await saveUserSession({
            authtoken:    token,
            userId:       result.userId   ?? '',
            deviceId:     deviceId,
            email:        result.email    ?? '',
            userTimezone: 'Asia/Bangkok',
            userAgent:    USER_AGENT,
            deviceType:   'web',
            currency:     currencyData.currency,
            currencyIso:  currencyData.currencyIso,
          });
        } catch (e) {
          console.warn('[Register] fetchUserCurrency failed, using default IDR:', e);
          // Fallback default — sama dengan Kotlin: currencyData?.current ?: "IDR"
          await saveCurrencyWithIso('IDR', 'Rp');
        }

        // ── STEP 4: Navigate ke dashboard ────────────────────────────────────
        await new Promise(r => setTimeout(r, 600));
        setShowSavingDialog(false);
        router.replace('/dashboard');

      } catch (e: unknown) {
        setShowSavingDialog(false);
        setSaveError(
          e instanceof Error ? e.message : 'Gagal menyimpan sesi. Silakan login manual.'
        );
      }

    } else {
      // Fallback: tidak ada token → manual login
      router.push('/login');
    }
  };

  const handleContinueClick = () => {
    setShowSuccessDialog(false);
    stcWebView.open({ url: registrationUrl.current }).catch(() => {
      window.open(registrationUrl.current, '_blank', 'noopener,noreferrer');
    });
  };

  if (!mounted) return null;

  return (
    <>
      <LoadingOverlay progress={loadingProgress} visible={showLoading} />

      {showSuccessDialog && (
        <ModernSuccessDialog
          onLoginClick={handleLoginClick}
          onContinueClick={handleContinueClick}
        />
      )}

      {showSavingDialog && <SavingDialog message={savingMessage} />}

      {saveError && (
        <ErrorDialog
          message={saveError}
          isBlocked={isUserBlocked}
          onContactAdmin={() => {
            window.open(whatsappUrl.current, '_blank', 'noopener,noreferrer');
            setSaveError(null);
          }}
          onBack={() => {
            setSaveError(null);
            router.push('/login');
          }}
        />
      )}
    </>
  );
}