'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SquaresFour, ClockCounterClockwise, User } from '@phosphor-icons/react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', Icon: SquaresFour },
  { href: '/history',   label: 'History',   Icon: ClockCounterClockwise },
  { href: '/profile',   label: 'Profil',    Icon: User },
];

export const BottomNav = () => {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(10, 10, 12, 0.97)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Active indicator line */}
      <div className="relative flex">
        {navItems.map(({ href }) => {
          const isActive = pathname === href;
          return (
            <div
              key={href}
              className="flex-1 h-[1px] transition-all duration-400"
              style={{
                background: isActive
                  ? 'linear-gradient(to right, transparent, rgba(180, 195, 215, 0.7), transparent)'
                  : 'transparent',
              }}
            />
          );
        })}
      </div>

      {/* Nav items */}
      <div className="flex items-stretch">
        {navItems.map(({ href, label, Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-[4px] py-3 relative"
              style={{
                color: isActive ? 'rgba(210, 220, 235, 0.95)' : 'rgba(255, 255, 255, 0.25)',
                textDecoration: 'none',
                transition: 'color 0.2s ease',
              }}
            >
              <div
                style={{
                  transform: isActive ? 'translateY(-1px)' : 'translateY(0)',
                  transition: 'transform 0.2s ease',
                }}
              >
                <Icon
                  size={19}
                  weight={isActive ? 'fill' : 'regular'}
                />
              </div>

              <span
                style={{
                  fontFamily: 'var(--font-exo)',
                  fontSize: 9,
                  fontWeight: isActive ? 500 : 400,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  opacity: isActive ? 0.9 : 0.5,
                  transition: 'all 0.2s ease',
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};