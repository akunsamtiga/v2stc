// src/plugins/StcWebViewPlugin.ts

import { registerPlugin } from '@capacitor/core';

export interface StcWebViewOpenOptions {
  url: string;
}

export interface StcWebViewOpenResult {
  url:       string;
  authToken: string;
  deviceId:  string;
  email:     string;
  success:   boolean;
}

export interface StcWebViewPlugin {
  /** Buka in-app WebView. Promise resolve saat success URL terdeteksi. */
  open(options: StcWebViewOpenOptions): Promise<StcWebViewOpenResult>;
  /**
   * Panggil setelah loading 9s selesai — plugin akan auto-click tombol Daftar.
   * Mirrors: LaunchedEffect(isProgressComplete, isWebFullyLoaded)
   */
  notifyReady(): Promise<void>;
  close(): Promise<void>;
  addListener(
    event: 'daftarClicked',
    fn: (data: { clicked: boolean }) => void
  ): Promise<{ remove: () => void }>;
  addListener(
    event: 'browserFinished',
    fn: (data: { finished: boolean; cancelled?: boolean }) => void
  ): Promise<{ remove: () => void }>;
}

const StcWebViewNative = registerPlugin<StcWebViewPlugin>('StcWebView', {
  web: () => import('./StcWebViewWeb').then(m => new m.StcWebViewWeb()),
});

function isNative(): boolean {
  return typeof window !== 'undefined' &&
    (window as any).Capacitor?.isNativePlatform?.() === true;
}

export const stcWebView = {
  async open(options: StcWebViewOpenOptions): Promise<StcWebViewOpenResult> {
    if (isNative()) return StcWebViewNative.open(options);
    // Web fallback
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: options.url, presentationStyle: 'fullscreen' });
    } catch {
      window.open(options.url, '_blank', 'noopener,noreferrer');
    }
    return { url: options.url, authToken: '', deviceId: '', email: '', success: false };
  },

  async notifyReady(): Promise<void> {
    if (isNative()) return StcWebViewNative.notifyReady();
  },

  async close(): Promise<void> {
    if (isNative()) return StcWebViewNative.close();
  },

  async addListener(
    event: 'daftarClicked' | 'browserFinished',
    fn: (data: any) => void
  ): Promise<{ remove: () => void }> {
    if (isNative()) return StcWebViewNative.addListener(event as any, fn);
    // Web fallback untuk browserFinished
    if (event === 'browserFinished') {
      try {
        const { Browser } = await import('@capacitor/browser');
        const h = await Browser.addListener('browserFinished', () =>
          fn({ finished: true, cancelled: true })
        );
        return h;
      } catch { /* ignore */ }
    }
    return { remove: () => {} };
  },
};