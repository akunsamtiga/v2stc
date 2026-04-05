'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { storage } from '@/lib/storage'; // ← Import dari lib

const PUBLIC_ROUTES = ['/login'];

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  const isPublic = PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`));

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const checkAuth = async () => {
      try {
        const token = await storage.get('stc_token');
        console.log('Token:', token ? 'exists' : 'null');
        
        if (!isPublic && !token) {
          router.replace('/login');
        }
        
        setReady(true);
      } catch (err) {
        console.error('Auth error:', err);
        setReady(true); // Force show on error
      }
    };

    // Force ready after 3 seconds
    timeoutId = setTimeout(() => {
      console.log('Force ready');
      setReady(true);
    }, 3000);

    checkAuth();
    return () => clearTimeout(timeoutId);
  }, [pathname, router, isPublic]);

  if (!ready) {
    return (
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
  }

  return (
    <>
      <main className="flex-1 overflow-y-auto">{children}</main>
      {!isPublic && <BottomNav />}
    </>
  );
}