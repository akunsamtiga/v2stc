'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';

const PUBLIC_ROUTES = ['/login'];

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready, setReady]   = useState(false);

  const isPublic = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    const token = localStorage.getItem('stc_token');
    if (!isPublic && !token) {
      router.push('/login');
    } else {
      setReady(true);
    }
  }, [pathname]);

  if (!ready) return (
    <div className="flex h-screen items-center justify-center bg-gray-950">
      <div className="flex items-center gap-3 text-gray-500 text-sm">
        <span className="w-5 h-5 border-2 border-gray-700 border-t-gray-400 rounded-full animate-spin" />
        Loading...
      </div>
    </div>
  );

  return (
    <>
      <main className="flex-1 overflow-y-auto pb-24">{children}</main>
      {!isPublic && <BottomNav />}
    </>
  );
}