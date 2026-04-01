'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router          = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('stc_token')) {
      router.push('/login');
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return (
    <div className="flex h-screen items-center justify-center bg-gray-950">
      <div className="flex items-center gap-3 text-gray-500 text-sm">
        <span className="w-5 h-5 border-2 border-gray-700 border-t-gray-400 rounded-full animate-spin" />
        Loading...
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-950 p-6">{children}</main>
    </div>
  );
}
