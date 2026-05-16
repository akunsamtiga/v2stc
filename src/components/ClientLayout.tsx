'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { isSessionValid, sessionLogout } from '@/lib/storage';
import { LanguageProvider } from '@/lib';
import { DarkModeProvider, useDarkMode } from '@/lib/DarkModeContext';

const PUBLIC_ROUTES = ['/login', '/register'];

// ✅ CONFIGURABLE: Auth check settings
const AUTH_CHECK_RETRIES = 5;
const AUTH_CHECK_DELAY = 400;
const INITIAL_DELAY = 200;
const CAPACITOR_EXTRA_DELAY = 300;
const SPLASH_MIN_DURATION = 4500; // Minimum splash screen duration untuk smooth UX

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const authCheckRef  = useRef(false);
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
          const elapsed    = Date.now() - splashStartRef.current;
          const remaining  = Math.max(0, 500 - elapsed);
          setTimeout(() => setReady(true), remaining);
          clearTimeout(fallback);
          return;
        }

        // ✅ TUNGGU: Beri waktu WebView/DOM untuk inisialisasi
        await new Promise(resolve => setTimeout(resolve, INITIAL_DELAY));

        // ✅ EXTRA DELAY: Untuk Capacitor native app
        const isCapacitor =
          typeof window !== 'undefined' &&
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
        const elapsed   = Date.now() - splashStartRef.current;
        const remaining = Math.max(0, SPLASH_MIN_DURATION - elapsed);
        setTimeout(() => setReady(true), remaining);
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
    // ✅ FIX: Debounce logout handler — hanya satu logout yang jalan
    //    meski ada banyak 401 concurrent dari loadAll()
    let logoutPending = false;

    const handleUnauthorized = async () => {
      if (logoutPending) return;
      logoutPending = true;

      console.log('[ClientLayout] Unauthorized event received, logging out...');
      try {
        await sessionLogout();
      } catch {
        // ignore
      }
      router.replace('/login');
    };

    window.addEventListener('stc:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('stc:unauthorized', handleUnauthorized);
    };
  }, [router]);

  // Hide initial HTML splash screen when React is ready
  useEffect(() => {
    if (ready) {
      /* Double rAF: tunggu browser selesai paint frame pertama konten
         sebelum splash mulai fade → crossfade bersih tanpa flash. */
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const htmlSplash = document.getElementById('__stc_splash');
          if (htmlSplash) {
            htmlSplash.classList.add('hide');
            setTimeout(() => htmlSplash.remove(), 520);
          }
        });
      });
    }
  }, [ready]);

  return (
    <DarkModeProvider>
      <LanguageProvider>
        <ThemeWrapper>
          <main
            style={{
              display: 'block',
              margin: 0,
              padding: 0,
              height: '100%',
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: isPublic
                ? 'env(safe-area-inset-bottom, 0px)'
                : 'calc(56px + env(safe-area-inset-bottom, 0px))',
              opacity: ready ? 1 : 0,
              transition: ready ? 'opacity 0.35s ease-out' : 'none',
            } as React.CSSProperties}>
            {children}
          </main>
          {!isPublic && <BottomNav />}
        </ThemeWrapper>
      </LanguageProvider>
    </DarkModeProvider>
  );
}

// ── ThemeWrapper ──────────────────────────────────────────────────────────────
// ✅ SATU-SATUNYA tempat yang boleh memanggil sync ke native bars (StatusBar +
//    NavigationBar). Memusatkan logika di sini menghilangkan race condition yang
//    terjadi ketika DarkModeContext DAN ThemeWrapper keduanya memanggil
//    StatusBar.setStyle() hampir bersamaan → status bar flickering/berubah-ubah.
function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const { isDarkMode } = useDarkMode();
  const pathname = usePathname();

  // Warna harus cocok dengan --bg di globals.css
  const DARK_BG  = '#000000';
  const LIGHT_BG = '#F2F2F7';

  // ✅ FIX: Pisahkan syncNativeBars sebagai fungsi yang menerima parameter,
  //    sehingga bisa dipanggil dari beberapa useEffect tanpa closure stale.
  const syncNativeBars = async (dark: boolean) => {
    const isCapacitor =
      typeof window !== 'undefined' &&
      (window as any).Capacitor?.isNativePlatform?.() === true;
    if (!isCapacitor) return;

    const bgColor = dark ? DARK_BG : LIGHT_BG;

    // ── Status bar atas ────────────────────────────────────────────────────
    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
      await StatusBar.setBackgroundColor({ color: bgColor });
    } catch {
      // Plugin tidak tersedia — abaikan
    }

    // ── Navigation bar bawah (Android) ────────────────────────────────────
    try {
      const { NavigationBar } = await import('@capgo/capacitor-navigation-bar');
      await NavigationBar.setNavigationBarColor({
        color: bgColor,
        darkButtons: !dark,
      });
    } catch {
      // Fallback warna sudah diset di MainActivity.java
    }
  };

  useEffect(() => {
    const bgColor = isDarkMode ? DARK_BG : LIGHT_BG;

    // 1. Apply data-theme ke body (light/dark CSS vars)
    if (typeof document !== 'undefined') {
      if (isDarkMode) {
        document.body.removeAttribute('data-theme');
      } else {
        document.body.setAttribute('data-theme', 'light');
      }
      document.body.style.background = bgColor;

      // ✅ FIX UTAMA: Update meta[name="theme-color"] secara dinamis.
      //    Di Android WebView, meta theme-color adalah yang PALING DOMINAN
      //    mengontrol warna background status bar — lebih kuat dari
      //    StatusBar.setBackgroundColor(). Tanpa update ini, layout.tsx yang
      //    me-render tag statis tetap akan "menang" → status bar tetap hitam
      //    meski Capacitor StatusBar API sudah dipanggil.
      const metaTags = document.querySelectorAll('meta[name="theme-color"]');
      if (metaTags.length > 0) {
        // Update semua tag theme-color yang ada (Next.js bisa render >1)
        metaTags.forEach(el => {
          (el as HTMLMetaElement).content = bgColor;
          // Hapus attribute media agar tidak ter-override oleh media query
          (el as HTMLMetaElement).removeAttribute('media');
        });
      } else {
        // Buat tag baru jika belum ada
        const meta = document.createElement('meta');
        meta.name = 'theme-color';
        meta.content = bgColor;
        document.head.appendChild(meta);
      }
    }

    // 2. Sync native bars (Capacitor)
    syncNativeBars(isDarkMode);
  }, [isDarkMode]);

  // ✅ FIX: Re-sync native bars setiap kali halaman berubah (navigasi).
  //    Tanpa ini, navigasi ke halaman profile tidak memicu re-sync karena
  //    isDarkMode tidak berubah → status bar tetap hitam dari MainActivity.java.
  useEffect(() => {
    syncNativeBars(isDarkMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return <>{children}</>;
}