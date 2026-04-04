'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutDashboard, History, User } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/history',   label: 'History',   icon: History },
  { href: '/profile',   label: 'Profile',   icon: User },
];

export function BottomNav() {
  const pathname  = usePathname();
  const [mounted, setMounted] = useState(false);

  // Only render on client to avoid SSR ↔ client hydration mismatch (#418 / #423)
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return (
    <div
      suppressHydrationWarning
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        pointerEvents: 'none',
      }}
    >
      <nav
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '6px 8px',
          borderRadius: 9999,
          background: 'rgba(20, 20, 20, 0.82)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow:
            '0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isActive ? 7 : 0,
                padding: isActive ? '9px 18px' : '9px 16px',
                borderRadius: 9999,
                background: isActive ? 'rgba(52,211,153,0.15)' : 'transparent',
                border: isActive
                  ? '1px solid rgba(52,211,153,0.30)'
                  : '1px solid transparent',
                color: isActive ? '#34d399' : 'rgba(255,255,255,0.45)',
                textDecoration: 'none',
                transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: isActive
                  ? '0 0 14px rgba(52,211,153,0.12), inset 0 1px 0 rgba(52,211,153,0.12)'
                  : 'none',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <Icon
                size={18}
                style={{
                  flexShrink: 0,
                  strokeWidth: isActive ? 2.2 : 1.8,
                  filter: isActive
                    ? 'drop-shadow(0 0 6px rgba(52,211,153,0.45))'
                    : 'none',
                }}
              />
              {isActive && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    lineHeight: 1,
                  }}
                >
                  {label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}