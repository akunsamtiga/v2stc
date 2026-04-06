// src/plugins/StcWebViewWeb.ts
import { WebPlugin } from '@capacitor/core';
import type { StcWebViewPlugin, StcWebViewOpenOptions, StcWebViewOpenResult } from './StcWebViewPlugin';

export class StcWebViewWeb extends WebPlugin implements StcWebViewPlugin {
  async open(options: StcWebViewOpenOptions): Promise<StcWebViewOpenResult> {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: options.url, presentationStyle: 'fullscreen' });
    } catch {
      window.open(options.url, '_blank', 'noopener,noreferrer');
    }
    return { url: options.url, authToken: '', deviceId: '', email: '', success: false };
  }
  async notifyReady(): Promise<void> { /* no-op on web */ }
  async close(): Promise<void> { /* no-op on web */ }
}