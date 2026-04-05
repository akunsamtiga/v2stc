// lib/storage.ts
'use client';

export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
        const { Preferences } = await import('@capacitor/preferences');
        const { value } = await Preferences.get({ key });
        return value;
      }
    } catch {
      // fallback
    }
    return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
  },

  async set(key: string, value: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.set({ key, value });
        return;
      }
    } catch {
      // fallback
    }
    if (typeof window !== 'undefined') localStorage.setItem(key, value);
  },

  async remove(key: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.remove({ key });
        return;
      }
    } catch {
      // fallback
    }
    if (typeof window !== 'undefined') localStorage.removeItem(key);
  },
};