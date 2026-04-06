// src/plugins/StcWebViewPlugin.ts
//
// JS/TS interface untuk StcWebViewPlugin.kt
// Digunakan di register/page.tsx sebagai pengganti @capacitor/browser
//
// Usage:
//   import { stcWebView } from '@/plugins/StcWebViewPlugin';
//   const result = await stcWebView.open({ url: REGISTRATION_URL });
//   if (result.authToken) { ... }

import { registerPlugin } from '@capacitor/core';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StcWebViewOpenOptions {
  /** URL yang akan dibuka di in-app WebView */
  url: string;
}

export interface StcWebViewOpenResult {
  /** URL terakhir saat success terdeteksi */
  url:        string;
  /** Authorization token dari cookie (kosong jika tidak ditemukan) */
  authToken:  string;
  /** Device ID dari cookie (kosong jika tidak ditemukan) */
  deviceId:   string;
  /** Raw cookie string — untuk debug */
  cookies?:   string;
  /** true jika success URL terdeteksi */
  success:    boolean;
}

export interface StcWebViewBrowserFinishedEvent {
  finished:   boolean;
  /** true jika user menutup manual tanpa registrasi selesai */
  cancelled?: boolean;
}

export interface StcWebViewPlugin {
  /**
   * Buka in-app WebView fullscreen.
   * Promise resolve ketika success URL terdeteksi ATAU timeout.
   * Jika resolve dengan success=false, berarti user menutup manual.
   */
  open(options: StcWebViewOpenOptions): Promise<StcWebViewOpenResult>;

  /** Tutup WebView dari JS secara manual */
  close(): Promise<void>;

  /** Listener untuk event browserFinished (user tutup manual) */
  addListener(
    eventName: 'browserFinished',
    listenerFunc: (event: StcWebViewBrowserFinishedEvent) => void
  ): Promise<{ remove: () => void }>;
}

// ── Register plugin (nama harus match dengan @CapacitorPlugin(name = "StcWebView")) ──
const StcWebViewNative = registerPlugin<StcWebViewPlugin>('StcWebView', {
  // Web fallback — tidak ada native WebView di browser, pakai Capacitor Browser
  web: () => import('./StcWebViewWeb').then(m => new m.StcWebViewWeb()),
});

// ── Helper: deteksi apakah running di native Capacitor ───────────────────────
function isNative(): boolean {
  return typeof window !== 'undefined' &&
    (window as any).Capacitor?.isNativePlatform?.() === true;
}

// ── stcWebView: unified API — native atau fallback ke @capacitor/browser ─────
export const stcWebView = {
  /**
   * Buka WebView.
   * - Native Android: pakai StcWebViewPlugin (in-app, bisa baca cookies)
   * - Web/browser: fallback ke window.open atau @capacitor/browser
   */
  async open(options: StcWebViewOpenOptions): Promise<StcWebViewOpenResult> {
    if (isNative()) {
      return StcWebViewNative.open(options);
    }
    // Web fallback — buka external, return empty token
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: options.url, presentationStyle: 'fullscreen' });
    } catch {
      window.open(options.url, '_blank', 'noopener,noreferrer');
    }
    return { url: options.url, authToken: '', deviceId: '', success: false };
  },

  async close(): Promise<void> {
    if (isNative()) {
      return StcWebViewNative.close();
    }
  },

  async addListener(
    eventName: 'browserFinished',
    fn: (e: StcWebViewBrowserFinishedEvent) => void
  ): Promise<{ remove: () => void }> {
    if (isNative()) {
      return StcWebViewNative.addListener(eventName, fn);
    }
    // Web fallback: listen ke @capacitor/browser browserFinished
    try {
      const { Browser } = await import('@capacitor/browser');
      const handle = await Browser.addListener('browserFinished', () =>
        fn({ finished: true, cancelled: true })
      );
      return handle;
    } catch {
      return { remove: () => {} };
    }
  },
};