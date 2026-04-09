'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutDashboard, History, User } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/history',   label: 'Riwayat',   icon: History },
  { href: '/profile',   label: 'Profil',    icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [safeBottom, setSafeBottom] = useState(0);

  useEffect(() => {
    setMounted(true);
    // Trigger scale-in after mount
    const t = setTimeout(() => setVisible(true), 30);
    const readSafeArea = () => {
      const val = getComputedStyle(document.documentElement).getPropertyValue('--sab').trim();
      setSafeBottom(parseFloat(val) || 0);
    };
    readSafeArea();
    window.addEventListener('orientationchange', readSafeArea);
    return () => {
      clearTimeout(t);
      window.removeEventListener('orientationchange', readSafeArea);
    };
  }, []);

  if (!mounted) return null;

  const isDashboard = pathname === '/dashboard' || pathname.startsWith('/dashboard/');

  const theme = isDashboard
    ? {
        navBg:         'rgb(18,18,20)',
        navBorder:     '1px solid rgba(255,255,255,0.08)',
        navShadow:     [
          '0 8px 32px rgba(0,0,0,0.40)',
          '0 2px 8px rgba(0,0,0,0.30)',
          'inset 0 1px 0 rgba(255,255,255,0.06)',
          'inset 0 -1px 0 rgba(0,0,0,0.20)',
        ].join(', '),
        itemColor:      'rgba(255,255,255,0.45)',
        itemHoverBg:    'rgba(255,255,255,0.08)',
        itemHoverColor: 'rgba(255,255,255,0.80)',
        activeBg:       'rgba(99,179,237,0.14)',
        activeBorder:   'rgba(99,179,237,0.30)',
        activeColor:    '#63b3ed',
        activeShadow:   [
          '0 0 0 3px rgba(99,179,237,0.08)',
          '0 1px 6px rgba(99,179,237,0.18)',
          'inset 0 1px 0 rgba(255,255,255,0.08)',
        ].join(', '),
        activeGlow:     'drop-shadow(0 0 5px rgba(99,179,237,0.45))',
        sepBg:          'rgba(255,255,255,0.08)',
      }
    : {
        navBg:         'rgb(255,255,255)',
        navBorder:     '1px solid rgba(60,60,67,0.10)',
        navShadow:     [
          '0 8px 24px rgba(0,0,0,0.08)',
          '0 2px 8px rgba(0,0,0,0.05)',
          'inset 0 1px 0 rgba(255,255,255,0.90)',
          'inset 0 -1px 0 rgba(60,60,67,0.04)',
        ].join(', '),
        itemColor:      'rgba(60,60,67,0.72)',
        itemHoverBg:    'rgba(60,60,67,0.06)',
        itemHoverColor: 'rgba(60,60,67,0.90)',
        activeBg:       'rgba(0,122,255,0.09)',
        activeBorder:   'rgba(0,122,255,0.18)',
        activeColor:    '#007aff',
        activeShadow:   [
          '0 0 0 3px rgba(0,122,255,0.05)',
          '0 1px 6px rgba(0,122,255,0.10)',
          'inset 0 1px 0 rgba(255,255,255,0.70)',
        ].join(', '),
        activeGlow:     'drop-shadow(0 0 4px rgba(0,122,255,0.35))',
        sepBg:          'rgba(60,60,67,0.10)',
      };

  const navBottom = 16 + safeBottom;

  return (
    <>
      <style>{`
        @keyframes theme-fade {
          from { opacity: 0.6; }
          to   { opacity: 1; }
        }

        .bnav-item {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          padding: 9px 14px;
          border-radius: 9999px;
          border: 1px solid transparent;
          text-decoration: none;
          transition:
            background   0.25s cubic-bezier(0.4,0,0.2,1),
            border-color 0.25s cubic-bezier(0.4,0,0.2,1),
            color        0.25s cubic-bezier(0.4,0,0.2,1),
            box-shadow   0.25s cubic-bezier(0.4,0,0.2,1),
            padding      0.25s cubic-bezier(0.4,0,0.2,1),
            gap          0.25s cubic-bezier(0.4,0,0.2,1),
            transform    0.12s ease;
          -webkit-tap-highlight-color: transparent;
          white-space: nowrap;
          overflow: hidden;
        }
        .bnav-item:active { transform: scale(0.91); }

        .bnav-icon { flex-shrink: 0; transition: filter 0.25s ease; }

        .bnav-label {
          font-size: 12.5px;
          font-weight: 600;
          letter-spacing: -0.02em;
          line-height: 1;
          max-width: 0;
          opacity: 0;
          overflow: hidden;
          transition:
            max-width 0.28s cubic-bezier(0.4,0,0.2,1),
            opacity   0.18s cubic-bezier(0.4,0,0.2,1);
        }
        .bnav-item.active .bnav-label {
          max-width: 80px;
          opacity: 1;
        }
      `}</style>

      <div
        suppressHydrationWarning
        style={{
          position: 'fixed',
          bottom: navBottom,
          left: '50%',
          zIndex: 50,
          pointerEvents: 'none',
          transform: `translateX(-50%) scale(${visible ? 1 : 0.6})`,
          opacity: visible ? 1 : 0,
          transition: 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
          transformOrigin: 'center bottom',
        }}
      >
        <nav
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            padding: '5px 6px',
            borderRadius: 9999,
            background: theme.navBg,
            border: theme.navBorder,
            boxShadow: theme.navShadow,
            transition: 'background 0.35s ease, border 0.35s ease, box-shadow 0.35s ease',
            animation: 'theme-fade 0.3s ease',
          }}
        >
          {NAV_ITEMS.map(({ href, label, icon: Icon }, index) => {
            const isActive   = pathname === href || pathname.startsWith(href + '/');
            const prevActive = index > 0 &&
              (pathname === NAV_ITEMS[index - 1].href ||
               pathname.startsWith(NAV_ITEMS[index - 1].href + '/'));

            return (
              <div key={href} style={{ display: 'flex', alignItems: 'center' }}>
                {index > 0 && !isActive && !prevActive && (
                  <div style={{
                    width: 1, height: 14,
                    background: theme.sepBg,
                    flexShrink: 0,
                    margin: '0 1px',
                    transition: 'background 0.35s ease',
                  }} />
                )}
                <Link
                  href={href}
                  className={`bnav-item${isActive ? ' active' : ''}`}
                  style={{
                    color: isActive ? theme.activeColor : theme.itemColor,
                    ...(isActive ? {
                      gap: '7px',
                      padding: '9px 18px',
                      background: theme.activeBg,
                      borderColor: theme.activeBorder,
                      boxShadow: theme.activeShadow,
                    } : {}),
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = theme.itemHoverBg;
                      (e.currentTarget as HTMLElement).style.color = theme.itemHoverColor;
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = '';
                      (e.currentTarget as HTMLElement).style.color = theme.itemColor;
                    }
                  }}
                >
                  <Icon
                    size={17}
                    className="bnav-icon"
                    strokeWidth={isActive ? 2.2 : 1.8}
                    style={{ filter: isActive ? theme.activeGlow : 'none' }}
                  />
                  <span className="bnav-label">{label}</span>
                </Link>
              </div>
            );
          })}
        </nav>
      </div>
    </>
  );
}