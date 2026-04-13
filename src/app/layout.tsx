import type { Metadata, Viewport } from 'next'
import { ClientLayout } from '@/components/ClientLayout'
import './globals.css'

export const metadata: Metadata = {
  title: 'STC AutoTrade',
  description: 'Trading Bot Automation System',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/logo.png', media: '(prefers-color-scheme: light)' },
      { url: '/logo.png',  media: '(prefers-color-scheme: dark)'  },
      { url: '/logo.png', type: 'image' },
    ],
    apple: '/logo.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)',  color: '#0a0a0a' },
  ],
  viewportFit: 'cover',
}

const initialSplashStyles = `
  html, body { margin: 0; padding: 0; }

  @media (prefers-color-scheme: light) {
    html, body           { background: #ffffff !important; }
    #__stc_splash        { background: #ffffff; }
    #__stc_splash .splash-text { color: #000000; }
    #__stc_splash .splash-dot  { background: #000000; }
  }
  @media (prefers-color-scheme: dark) {
    html, body           { background: #0a0a0a !important; }
    #__stc_splash        { background: #0a0a0a; }
    #__stc_splash .splash-text { color: #ffffff; }
    #__stc_splash .splash-dot  { background: #ffffff; }
  }

  #__stc_splash {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    z-index: 99999;
    transition: opacity 0.4s ease-out;
  }
  #__stc_splash.hide {
    opacity: 0;
    pointer-events: none;
  }

  #__stc_splash .splash-text {
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
    font-size: 13px;
    font-weight: 400;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    opacity: 0;
    animation: __stc_fadein 0.5s ease 0.1s forwards;
  }

  #__stc_splash .splash-dots {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  #__stc_splash .splash-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    animation: __stc_dot 1.4s ease-in-out infinite;
  }
  #__stc_splash .splash-dot:nth-child(1) { animation-delay: 0s;   }
  #__stc_splash .splash-dot:nth-child(2) { animation-delay: 0.2s; }
  #__stc_splash .splash-dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes __stc_fadein {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 0.45; transform: translateY(0); }
  }
  @keyframes __stc_dot {
    0%, 80%, 100% { opacity: 0.15; transform: scale(0.8); }
    40%           { opacity: 1;    transform: scale(1.2); }
  }
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: initialSplashStyles }} />
      </head>
      <body className="font-sans antialiased">
        <div id="__stc_splash">
          <span className="splash-text">Loading</span>
          <div className="splash-dots">
            <span className="splash-dot" />
            <span className="splash-dot" />
            <span className="splash-dot" />
          </div>
        </div>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  )
}