'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { isSessionValid, sessionLogout } from '@/lib/storage';
import { LanguageProvider } from '@/lib/i18n';

const PUBLIC_ROUTES = ['/login', '/register'];

// ✅ CONFIGURABLE: Auth check settings
const AUTH_CHECK_RETRIES = 5;
const AUTH_CHECK_DELAY = 400;
const INITIAL_DELAY = 200;
const CAPACITOR_EXTRA_DELAY = 300;
const SPLASH_MIN_DURATION = 800;     // Minimum splash screen duration untuk smooth UX

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);  // State untuk fade animation
  const authCheckRef = useRef(false);
  const splashStartRef = useRef(Date.now());

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
        // Halaman publik: tampilkan dengan smooth transition
        if (isPublic) {
          // Minimal delay untuk smooth UX
          const elapsed = Date.now() - splashStartRef.current;
          const remaining = Math.max(0, 500 - elapsed); // Shorter delay untuk public pages
          
          setTimeout(() => {
            setFadeOut(true);
            setTimeout(() => setReady(true), 300);
          }, remaining);
          
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
        // Ensure minimum splash duration for smooth UX
        const elapsed = Date.now() - splashStartRef.current;
        const remaining = Math.max(0, SPLASH_MIN_DURATION - elapsed);
        
        setTimeout(() => {
          setFadeOut(true);
          // Wait for fade animation before showing content
          setTimeout(() => setReady(true), 300);
        }, remaining);
        
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

  // Hide initial HTML splash screen when React is ready
  useEffect(() => {
    if (ready) {
      const htmlSplash = document.getElementById('__stc_splash');
      if (htmlSplash) {
        htmlSplash.classList.add('hide');
        // Remove from DOM after fade
        setTimeout(() => htmlSplash.remove(), 350);
      }
    }
  }, [ready]);

  if (!ready) {
    return (
      <div 
        className="stc-splash"
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 100%)',
          fontFamily: "-apple-system, 'SF Pro Display', BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
          WebkitFontSmoothing: 'antialiased',
          zIndex: 9999,
          opacity: fadeOut ? 0 : 1,
          transition: 'opacity 0.3s ease-out',
        }}
      >
        {/* Logo / Brand */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
        }}>
          {/* App Icon */}
          <div style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: 'linear-gradient(135deg, #00d4aa 0%, #00a080 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(0, 212, 170, 0.3)',
            animation: 'stc-pulse 2s ease-in-out infinite',
          }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
          
          {/* App Name */}
          <div style={{ textAlign: 'center' }}>
            <h1 style={{
              fontSize: 28,
              fontWeight: 700,
              color: '#ffffff',
              margin: 0,
              letterSpacing: '-0.5px',
            }}>
              STC AutoTrade
            </h1>
            <p style={{
              fontSize: 14,
              color: 'rgba(255,255,255,0.5)',
              margin: '8px 0 0 0',
            }}>
              Smart Trading Automation
            </p>
          </div>
        </div>

        {/* Loading Indicator */}
        <div style={{
          position: 'absolute',
          bottom: 80,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}>
          {/* Spinner */}
          <div style={{
            width: 32,
            height: 32,
            border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: '#00d4aa',
            borderRadius: '50%',
            animation: 'stc-spin 0.8s linear infinite',
          }} />
          <span style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: '0.5px',
          }}>
            Memuat...
          </span>
        </div>

        <style>{`
          @keyframes stc-spin {
            to { transform: rotate(360deg); }
          }
          @keyframes stc-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
        `}</style>
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
        } as React.CSSProperties}
      >
        {children}
      </main>
      {!isPublic && <BottomNav />}
    </LanguageProvider>
  );
}
