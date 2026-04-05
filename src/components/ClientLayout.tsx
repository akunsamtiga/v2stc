'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';

const PUBLIC_ROUTES = ['/login'];

// ─── Storage helper ────────────────────────────────────────────────────────────
// Mendukung Capacitor Preferences (native) + localStorage (web fallback)
const storage = {
  async get(key: string): Promise<string | null> {
    try {
      // Cek apakah Capacitor tersedia (native app)
      if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
        const { Preferences } = await import('@capacitor/preferences');
        const { value } = await Preferences.get({ key });
        return value;
      }
    } catch {
      // Capacitor tidak tersedia, fallback ke localStorage
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

// Export helper agar bisa dipakai di komponen lain (login, logout, dsb.)
export { storage };
// ───────────────────────────────────────────────────────────────────────────────

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  const isPublic = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    const checkAuth = async () => {
      const token = await storage.get('stc_token');
      if (!isPublic && !token) {
        router.push('/login');
      } else {
        setReady(true);
      }
    };

    checkAuth();
  }, [pathname]);

  if (!ready) return (
    <div style={{
      display: 'flex',
      height: '100dvh',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f2f2f7',
      fontFamily: "-apple-system, 'SF Pro Display', BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6e6e73', fontSize: 14 }}>
        <span style={{
          width: 20,
          height: 20,
          border: '2px solid rgba(0,0,0,0.10)',
          borderTopColor: '#007aff',
          borderRadius: '50%',
          display: 'inline-block',
          animation: 'cl-spin 0.7s linear infinite',
          flexShrink: 0,
        }} />
        Memuat...
      </div>
      <style>{`@keyframes cl-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <>
      <main className="flex-1 overflow-y-auto">{children}</main>
      {!isPublic && <BottomNav />}
    </>
  );
}