'use client';

// components/AppUpdateCard.tsx
// ✅ Hardcoded LIGHT theme — sinkron dengan halaman profile
// Tidak menggunakan useDarkMode, semua warna fixed ke light palette.

import React, { useEffect, useRef, useState } from 'react';
import { checkForUpdate, type UpdateCheckResult } from '@/lib/appUpdateApi';
import { APP_VERSION_NAME } from '@/lib/appVersion';

// ── Types ──────────────────────────────────────────────────────────────────────
type Phase =
  | 'idle'        // belum mulai cek
  | 'checking'    // sedang cek
  | 'up-to-date'  // tidak ada update
  | 'available'   // ada update, belum download
  | 'downloading' // sedang download
  | 'error';      // gagal cek

// ── ApkInstaller plugin bridge ────────────────────────────────────────────────
async function downloadAndInstall(
  url: string,
  onProgress: (p: number) => void,
): Promise<void> {
  const { registerPlugin } = await import('@capacitor/core');
  const ApkInstaller = registerPlugin<{
    downloadAndInstall(opts: { url: string }): Promise<{ success: boolean }>;
    cancelDownload(): Promise<void>;
    addListener(event: string, cb: (data: { progress: number }) => void): Promise<{ remove(): void }>;
  }>('ApkInstaller');

  const handle = await ApkInstaller.addListener('downloadProgress', ({ progress }) => {
    onProgress(progress);
  });

  try {
    await ApkInstaller.downloadAndInstall({ url });
  } finally {
    handle.remove();
  }
}

// ── Palette (hardcode light) ──────────────────────────────────────────────────
const C = {
  bg:          '#ffffff',
  bgSubtle:    '#f2f2f7',
  border:      'rgba(60,60,67,0.10)',
  text:        '#1c1c1e',
  textSec:     '#6e6e73',
  textTert:    '#aeaeb2',
  blue:        '#007aff',
  green:       '#34c759',
  orange:      '#ff9500',
  red:         '#ff3b30',
  greenBg:     'rgba(52,199,89,0.10)',
  blueBg:      'rgba(0,122,255,0.10)',
  orangeBg:    'rgba(255,149,0,0.10)',
  shadow:      '0 1px 0 rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.04)',
} as const;

// ── Sub-components ────────────────────────────────────────────────────────────
const ProgressBar = ({ value }: { value: number }) => (
  <div style={{ height: 4, borderRadius: 99, background: 'rgba(0,122,255,0.15)', overflow: 'hidden', marginTop: 10 }}>
    <div
      style={{
        height: '100%',
        borderRadius: 99,
        background: C.blue,
        width: value < 0 ? '100%' : `${value}%`,
        transition: 'width 0.3s ease',
        ...(value < 0 ? { animation: 'auc-indeterminate 1.4s ease-in-out infinite' } : {}),
      }}
    />
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
export function AppUpdateCard() {
  const [phase,    setPhase]    = useState<Phase>('idle');
  const [result,   setResult]   = useState<UpdateCheckResult | null>(null);
  const [progress, setProgress] = useState<number>(-1);  // -1 = indeterminate
  const [dlError,  setDlError]  = useState<string | null>(null);
  const cancelRef = useRef(false);

  // Cek update otomatis saat mount
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setPhase('checking');
      try {
        const res = await checkForUpdate();
        if (!mounted) return;
        setResult(res);
        if (res.error && !res.hasUpdate) {
          setPhase('error');
        } else {
          setPhase(res.hasUpdate ? 'available' : 'up-to-date');
        }
      } catch {
        if (mounted) setPhase('error');
      }
    };
    run();
    return () => { mounted = false; };
  }, []);

  const handleRetry = async () => {
    setDlError(null);
    setPhase('checking');
    try {
      const res = await checkForUpdate();
      setResult(res);
      setPhase(res.hasUpdate ? 'available' : 'up-to-date');
    } catch {
      setPhase('error');
    }
  };

  const handleDownload = async () => {
    if (!result?.resolvedDownloadUrl) return;
    cancelRef.current = false;
    setDlError(null);
    setPhase('downloading');
    setProgress(-1);

    try {
      await downloadAndInstall(result.resolvedDownloadUrl, (p) => {
        if (!cancelRef.current) setProgress(p);
      });
      // Jika sampai sini tanpa error = install prompt sudah muncul
    } catch (e: unknown) {
      if (!cancelRef.current) {
        setDlError(e instanceof Error ? e.message : 'Download gagal');
        setPhase('available');
      }
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes auc-indeterminate {
          0%   { transform: translateX(-100%) scaleX(0.5); }
          50%  { transform: translateX(0%)    scaleX(0.6); }
          100% { transform: translateX(200%)  scaleX(0.5); }
        }
        @keyframes auc-spin { to { transform: rotate(360deg); } }
        @keyframes auc-pop  { from { opacity:0; transform:scale(0.95) translateY(4px); } to { opacity:1; transform:scale(1) translateY(0); } }
        .auc-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          padding: 9px 18px; border-radius: 10px; border: none; cursor: pointer;
          font-size: 14px; font-weight: 600; font-family: inherit;
          transition: opacity 0.15s, transform 0.1s;
          -webkit-tap-highlight-color: transparent;
        }
        .auc-btn:active { opacity: 0.75; transform: scale(0.97); }
        .auc-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
      ` }} />

      <div style={{
        background: C.bg,
        borderRadius: 12,
        boxShadow: C.shadow,
        overflow: 'hidden',
        marginBottom: 12,
        animation: 'auc-pop 0.3s cubic-bezier(0.22,1,0.36,1) both',
      }}>

        {/* ── CHECKING ── */}
        {phase === 'checking' && (
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: C.blueBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2.2" strokeLinecap="round"
                style={{ animation: 'auc-spin 0.9s linear infinite' }}>
                <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>Memeriksa pembaruan…</p>
              <p style={{ fontSize: 12, color: C.textTert }}>Versi saat ini: {APP_VERSION_NAME}</p>
            </div>
          </div>
        )}

        {/* ── UP TO DATE ── */}
        {phase === 'up-to-date' && (
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: C.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>Aplikasi sudah terbaru</p>
              <p style={{ fontSize: 12, color: C.textTert }}>Versi {APP_VERSION_NAME}</p>
            </div>
            <button
              onClick={handleRetry}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, color: C.textTert, WebkitTapHighlightColor: 'transparent' }}
              title="Cek ulang"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
          </div>
        )}

        {/* ── UPDATE AVAILABLE ── */}
        {phase === 'available' && result?.latest && (
          <div style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: C.orangeBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2.2" strokeLinecap="round">
                  <path d="M12 2v10m0 0l-3-3m3 3l3-3"/><path d="M20 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Pembaruan tersedia</p>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.orange, background: C.orangeBg, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                    v{result.latest.versionName}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: C.textTert }}>
                  Saat ini: v{APP_VERSION_NAME} → Terbaru: v{result.latest.versionName}
                </p>
                {dlError && (
                  <p style={{ fontSize: 12, color: C.red, marginTop: 6 }}>{dlError}</p>
                )}
              </div>
            </div>
            <button
              className="auc-btn"
              onClick={handleDownload}
              style={{ marginTop: 12, background: C.blue, color: '#fff', width: '100%' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2v10m0 0l-3-3m3 3l3-3"/><path d="M20 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2"/>
              </svg>
              Unduh &amp; Pasang
            </button>
          </div>
        )}

        {/* ── DOWNLOADING ── */}
        {phase === 'downloading' && (
          <div style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: C.blueBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2.2" strokeLinecap="round"
                  style={{ animation: 'auc-spin 0.9s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke={C.blue}/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>
                  {progress < 0 ? 'Mengunduh…' : `Mengunduh… ${progress}%`}
                </p>
                <p style={{ fontSize: 12, color: C.textTert }}>
                  {result?.latest ? `v${result.latest.versionName}` : 'Pembaruan'}
                </p>
              </div>
            </div>
            <ProgressBar value={progress} />
          </div>
        )}

        {/* ── ERROR ── */}
        {phase === 'error' && (
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,59,48,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>Gagal memeriksa pembaruan</p>
              <p style={{ fontSize: 12, color: C.textTert }}>Versi {APP_VERSION_NAME}</p>
            </div>
            <button
              onClick={handleRetry}
              style={{ flexShrink: 0, background: C.blueBg, color: C.blue, border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent' }}
            >
              Coba lagi
            </button>
          </div>
        )}

      </div>
    </>
  );
}