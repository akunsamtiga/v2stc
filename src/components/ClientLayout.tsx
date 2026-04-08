'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { isSessionValid, sessionLogout } from '@/lib/storage';
import { LanguageProvider } from '@/lib/i18n';

const PUBLIC_ROUTES = ['/login', '/register'];

// ✅ CONFIGURABLE: Auth check settings
const AUTH_CHECK_RETRIES = 5;        // Ditambah dari 3 ke 5
const AUTH_CHECK_DELAY = 400;        // Ditambah dari 300ms ke 400ms
const INITIAL_DELAY = 200;           // Ditambah dari 100ms ke 200ms untuk WebView init
const CAPACITOR_EXTRA_DELAY = 300;   // Extra delay untuk Capacitor native app

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const authCheckRef = useRef(false);  // Prevent double auth check

  const isPublic = PUBLIC_ROUTES.some(
    route => pathname === route || pathname.startsWith(`${route}/`)
  );

  useEffect(() => {
    // Prevent double execution
    if (authCheckRef.current) return;
    authCheckRef.current = true;

    // ✅ FALLBACK: Pastikan UI tidak stuck lebih dari 5 detik
    const fallback = setTimeout(() => {
      console.warn('[ClientLayout] Fallback timeout reached, forcing ready state');
      setReady(true);
    }, 5000);

    const checkAuth = async () => {
      try {
        // Halaman publik: langsung tampilkan
        if (isPublic) {
          setReady(true);
          clearTimeout(fallback);
          return;
        }

        // ✅ TUNGGU: Beri waktu WebView/DOM untuk inisialisasi
        await new Promise(resolve => setTimeout(resolve, INITIAL_DELAY));

        // ✅ EXTRA DELAY: Untuk Capacitor native app
        const isCapacitor = typeof window !== 'undefined' && 
          (window as any).Capacitor?.isNativePlatform?.() === true;
        if (isCapacitor) {
          console.log('[ClientLayout] Capacitor detected, adding extra delay');
          await new Promise(resolve => setTimeout(resolve, CAPACITOR_EXTRA_DELAY));
        }

        // ✅ CEK SESSION: Dengan retry dan validasi lengkap
        let sessionValid = false;
        for (let i = 0; i < AUTH_CHECK_RETRIES; i++) {
          sessionValid = await isSessionValid();
          
          if (sessionValid) {
            console.log('[ClientLayout] Session valid on attempt', i + 1);
            break;
          }
          
          console.log(`[ClientLayout] Session check attempt ${i + 1}/${AUTH_CHECK_RETRIES} - not valid yet`);
          
          if (i < AUTH_CHECK_RETRIES - 1) {
            await new Promise(r => setTimeout(r, AUTH_CHECK_DELAY));
          }
        }

        if (!sessionValid) {
          console.log('[ClientLayout] Session invalid after all retries, redirecting to login');
          // Clear any stale session data
          await sessionLogout().catch(() => {});
          router.replace('/login');
        } else {
          console.log('[ClientLayout] Auth verified, rendering protected page');
        }
      } catch (err) {
        console.error('[ClientLayout] Auth check error:', err);
        if (!isPublic) {
          await sessionLogout().catch(() => {});
          router.replace('/login');
        }
      } finally {
        setReady(true);
        clearTimeout(fallback);
      }
    };

    checkAuth();
    return () => {
      clearTimeout(fallback);
      authCheckRef.current = false;
    };
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
          Loading...
        </div>
        <style>{`@keyframes cl-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <LanguageProvider>
      <main
        className="flex-1 overflow-y-auto"
        style={{
          height: '100dvh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingTop: 'var(--sat)',
        } as React.CSSProperties}
      >
        {children}
      </main>
      {!isPublic && <BottomNav />}
    </LanguageProvider>
  );
}
