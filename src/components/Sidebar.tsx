'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const NAV = [
  { href: '/dashboard',              icon: '⬡',  label: 'Overview' },
  { href: '/dashboard/orders',       icon: '≡',  label: 'Orders'   },
  { href: '/dashboard/config',       icon: '◈',  label: 'Config'   },
  { href: '/dashboard/logs',         icon: '◉',  label: 'Logs'     },
];

export default function Sidebar() {
  const path   = usePathname();
  const router = useRouter();

  const logout = async () => {
    try { await api.logout(); } catch { /* ignore */ }
    localStorage.removeItem('stc_token');
    router.push('/login');
  };

  return (
    <aside className="w-52 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center text-base">
            📈
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">Stockity</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Dashboard</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.map(item => {
          const active = path === item.href;
          return (
            <Link
              key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200 border border-transparent'
              }`}
            >
              <span className={`text-base leading-none ${active ? 'text-green-400' : 'text-gray-600'}`}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-gray-800">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                     text-gray-500 hover:bg-red-500/10 hover:text-red-400 border border-transparent
                     hover:border-red-500/20 transition-all"
        >
          <span className="text-base leading-none">⎋</span>
          Logout
        </button>
      </div>
    </aside>
  );
}
