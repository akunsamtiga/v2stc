'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { storage } from '@/lib/storage';

const PUBLIC_ROUTES = ['/login', '/register'];

// Berapa kali coba baca token sebelum memutuskan "tidak ada sesi"
// Ini mencegah false-redirect ke login akibat race condition storage async
const AUTH_CHECK_RETRIES = 3;
const AUTH_CHECK_DELAY   = 250; // ms antar retry

async function checkTokenWithRetry(): Promise<string | null> {
  for (let i = 0; i < AUTH_CHECK_RETRIES; i++) {
    const token = await storage.get('stc_token');
    if (token) return token;
    if (i < AUTH_CHECK_RETRIES - 1) {
      await new Promise(r => setTimeout(r, AUTH_CHECK_DELAY));
    }
  }
  return null;
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  const isPublic = PUBLIC_ROUTES.some(
    route => pathname === route || pathname.startsWith(`${route}/`)
  );

  useEffect(() => {
    // Fallback timeout: jika storage terlalu lama, tetap tampilkan halaman
    const fallback = setTimeout(() => setReady(true), 4000);

    const checkAuth = async () => {
      try {
        if (isPublic) {
          // Halaman publik: tidak perlu cek auth, langsung tampil
          setReady(true);
          clearTimeout(fallback);
          return;
        }

        // Halaman protected: cek token dengan retry
        // Retry penting untuk menangani race condition setelah saveUserSession()
        const token = await checkTokenWithRetry();
        if (!token) {
          router.replace('/login');
        }
      } catch {
        // Jika storage error, tetap redirect ke login untuk keamanan
        if (!isPublic) router.replace('/login');
      } finally {
        setReady(true);
        clearTimeout(fallback);
      }
    };

    checkAuth();
    return () => clearTimeout(fallback);
  }, [pathname, router, isPublic]);

  useEffect(() => {
    const handleUnauthorized = () => router.replace('/login');
    window.addEventListener('stc:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('stc:unauthorized', handleUnauthorized);
  }, [router]);

  if (!ready) {
    return (
      <div style={{
        display: 'flex', height: '100dvh',
        alignItems: 'center', justifyContent: 'center',
        background: '#f2f2f7',
        fontFamily: "-apple-system, 'SF Pro Display', BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6e6e73', fontSize: 14 }}>
          <span style={{
            width: 20, height: 20,
            border: '2px solid rgba(0,0,0,0.10)', borderTopColor: '#007aff',
            borderRadius: '50%', display: 'inline-block',
            animation: 'cl-spin 0.7s linear infinite', flexShrink: 0,
          }} />
          Memuat...
        </div>
        <style>{`@keyframes cl-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      <main
        className="flex-1 overflow-y-auto"
        style={{
          height: '100dvh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}
      >
        {children}
      </main>
      {!isPublic && <BottomNav />}
    </>
  );
}