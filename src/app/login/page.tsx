'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

// hidden → welcome (3s) → verified (4s) → out → navigate
type SplashPhase = 'hidden' | 'welcome' | 'verified' | 'out';

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [mounted,  setMounted]  = useState(false);
  const [focused,  setFocused]  = useState<'email' | 'password' | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [splash,   setSplash]   = useState<SplashPhase>('hidden');

  const emailRef = useRef<HTMLInputElement>(null);
  const passRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      setMounted(true);

      // Baca remember email & token via storage helper (Capacitor-safe)
      const savedEmail = await storage.get('stc_remember_email');
      if (savedEmail) { setEmail(savedEmail); setRemember(true); }

      const token = await storage.get('stc_token');
      if (token) router.push('/dashboard');
    };
    init();
  }, [router]);

  // FIX: browser autocomplete tidak trigger onChange — poll DOM setelah mount
  useEffect(() => {
    if (!mounted) return;
    const check = () => {
      if (emailRef.current?.value && emailRef.current.value !== email)
        setEmail(emailRef.current.value);
      if (passRef.current?.value && passRef.current.value !== password)
        setPassword(passRef.current.value);
    };
    const t1 = setTimeout(check, 100);
    const t2 = setTimeout(check, 400);
    const t3 = setTimeout(check, 800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [mounted]); // eslint-disable-line

  const runSplash = async (token: string) => {
    await storage.set('stc_token', token);

    setSplash('welcome');
    setTimeout(() => setSplash('verified'), 3000);
    setTimeout(() => {
      setSplash('out');
      router.push('/dashboard');
    }, 7000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailVal = emailRef.current?.value || email;
    const passVal  = passRef.current?.value  || password;

    setLoading(true);
    setError('');
    try {
      const res = await api.login(emailVal, passVal);

      if (remember) {
        await storage.set('stc_remember_email', emailVal);
      } else {
        await storage.remove('stc_remember_email');
      }

      await runSplash(res.accessToken);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login gagal. Periksa email dan password.');
      setLoading(false);
    }
  };

  const canSubmit = !!(
    (email || emailRef.current?.value) &&
    (password || passRef.current?.value)
  );

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:           #f2f2f7;
          --surface:      rgba(255,255,255,0.80);
          --border:       rgba(0,0,0,0.08);
          --border-focus: rgba(0,122,255,0.50);
          --text-1:       #1c1c1e;
          --text-2:       #6e6e73;
          --text-3:       #aeaeb2;
          --accent:       #007aff;
          --error:        #ff3b30;
          --error-bg:     rgba(255,59,48,0.07);
          --r-md:         13px;
          --r-xl:         24px;
          --font:         -apple-system, 'SF Pro Display', BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
        }

        .lr {
          font-family: var(--font);
          position: fixed; inset: 0;
          background: var(--bg);
          display: flex; align-items: center; justify-content: center;
          padding: 20px; overflow: hidden;
          -webkit-font-smoothing: antialiased;
        }

        .orb { position: absolute; border-radius: 50%; pointer-events: none; animation: drift 20s ease-in-out infinite alternate; }
        .o1 {
          width: min(55vw,460px); height: min(55vw,460px);
          background: radial-gradient(circle, rgba(0,122,255,0.12) 0%, transparent 68%);
          top: -18%; right: -8%; filter: blur(70px);
        }
        .o2 {
          width: min(42vw,360px); height: min(42vw,360px);
          background: radial-gradient(circle, rgba(48,209,88,0.09) 0%, transparent 68%);
          bottom: -12%; left: -6%; filter: blur(60px); animation-delay: -8s;
        }
        @keyframes drift {
          0%   { transform: translate(0,0) scale(1); }
          50%  { transform: translate(2%,3%) scale(1.03); }
          100% { transform: translate(-2%,1%) scale(0.98); }
        }

        .card {
          position: relative; z-index: 2;
          width: 100%; max-width: 380px;
          opacity: 0; transform: translateY(14px) scale(0.988);
          animation: rise 0.6s cubic-bezier(0.22,1,0.36,1) 0.08s forwards;
        }
        @keyframes rise { to { opacity: 1; transform: translateY(0) scale(1); } }

        .brand { text-align: center; margin-bottom: 20px; }
        .brand-title { display: block; font-size: 26px; font-weight: 700; letter-spacing: -0.7px; color: var(--text-1); margin-bottom: 4px; }
        .brand-sub   { font-size: 14px; color: var(--text-2); font-weight: 400; }

        .panel {
          background: var(--surface);
          border: 1px solid var(--border); border-radius: var(--r-xl);
          padding: 22px 20px 18px;
          backdrop-filter: saturate(180%) blur(30px);
          -webkit-backdrop-filter: saturate(180%) blur(30px);
          box-shadow: 0 8px 36px rgba(0,0,0,0.09), 0 2px 6px rgba(0,0,0,0.05);
        }

        .fg {
          border: 1px solid var(--border); border-radius: var(--r-md);
          overflow: hidden; margin-bottom: 12px;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .fg.active { border-color: var(--border-focus); box-shadow: 0 0 0 4px rgba(0,122,255,0.09); }
        .field { position: relative; background: rgba(118,118,128,0.06); }
        .field + .field { border-top: 1px solid var(--border); }
        .fl {
          position: absolute; top: 9px; left: 13px;
          font-size: 10.5px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.055em; color: var(--text-3);
          pointer-events: none; transition: color 0.18s;
        }
        .fg.active .fl { color: var(--accent); }
        .fi {
          width: 100%; background: transparent; border: none; outline: none;
          padding: 26px 13px 9px; font-size: 15.5px; font-weight: 400;
          color: var(--text-1); font-family: var(--font); letter-spacing: -0.2px;
          -webkit-tap-highlight-color: transparent; appearance: none; -webkit-appearance: none;
        }
        .fi::placeholder { color: var(--text-3); }
        .fi[type="password"]              { letter-spacing: 3px; font-size: 17px; }
        .fi[type="password"]::placeholder { letter-spacing: -0.2px; font-size: 15.5px; }
        .fwrap { position: relative; }
        .eye-btn {
          position: absolute; right: 11px; top: 50%; transform: translateY(-50%);
          background: none; border: none; padding: 5px; cursor: pointer;
          color: var(--text-3); display: flex; align-items: center;
          border-radius: 6px; transition: color 0.15s, background 0.15s;
        }
        .eye-btn:hover { color: var(--text-2); background: rgba(0,0,0,0.04); }

        .remember-row {
          display: flex; align-items: center; gap: 9px;
          margin-bottom: 14px; cursor: pointer;
          -webkit-tap-highlight-color: transparent; user-select: none;
        }
        .cb-box {
          width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0;
          border: 1.5px solid rgba(0,0,0,0.18);
          background: rgba(118,118,128,0.07);
          display: flex; align-items: center; justify-content: center;
          transition: background 0.18s, border-color 0.18s, box-shadow 0.18s;
        }
        .cb-box.checked {
          background: var(--accent); border-color: var(--accent);
          box-shadow: 0 1px 6px rgba(0,122,255,0.30);
        }
        .cb-tick {
          opacity: 0; transform: scale(0.5);
          transition: opacity 0.16s, transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
        }
        .cb-box.checked .cb-tick { opacity: 1; transform: scale(1); }
        .cb-label { font-size: 13.5px; color: var(--text-2); font-weight: 400; letter-spacing: -0.1px; }

        .err {
          display: flex; align-items: flex-start; gap: 8px;
          background: var(--error-bg); border: 1px solid rgba(255,59,48,0.16);
          border-radius: 10px; padding: 9px 12px; margin-bottom: 12px;
          animation: shake 0.36s cubic-bezier(0.36,0.07,0.19,0.97);
        }
        @keyframes shake {
          0%,100%{ transform:translateX(0); } 20%{ transform:translateX(-4px); }
          50%    { transform:translateX(4px); } 80%{ transform:translateX(-3px); }
        }
        .err-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--error); flex-shrink: 0; margin-top: 4px; }
        .err-txt  { font-size: 12.5px; color: var(--error); line-height: 1.4; }

        .btn {
          width: 100%; height: 46px;
          background: var(--accent); border: none; border-radius: var(--r-md);
          color: #fff; font-size: 15px; font-weight: 600; letter-spacing: -0.2px;
          cursor: pointer; font-family: var(--font);
          display: flex; align-items: center; justify-content: center; gap: 8px;
          position: relative; overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,122,255,0.28);
          transition: opacity 0.15s, transform 0.12s, box-shadow 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        .btn::before {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.11) 0%, transparent 55%);
          pointer-events: none;
        }
        .btn:hover:not(:disabled)  { opacity: 0.88; box-shadow: 0 4px 16px rgba(0,122,255,0.34); }
        .btn:active:not(:disabled) { transform: scale(0.987); opacity: 0.80; }
        .btn:disabled              { opacity: 0.42; cursor: not-allowed; box-shadow: none; }
        .spin {
          width: 14px; height: 14px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.28); border-top-color: #fff;
          animation: rot 0.7s linear infinite; flex-shrink: 0;
        }
        @keyframes rot { to { transform: rotate(360deg); } }

        .badge {
          display: inline-flex; align-items: center; gap: 5px;
          margin-top: 13px; padding: 5px 11px; border-radius: 99px;
          background: rgba(0,0,0,0.035); border: 1px solid rgba(0,0,0,0.055);
        }
        .badge-txt { font-size: 10.5px; color: var(--text-3); font-weight: 500; }

        .foot { text-align: center; margin-top: 14px; font-size: 11.5px; color: var(--text-3); }
        .foot-lnk { color: var(--accent); font-weight: 500; cursor: pointer; transition: opacity 0.14s; }
        .foot-lnk:hover { opacity: 0.70; }

        /* ══ SPLASH ══ */
        .splash {
          position: fixed; inset: 0; z-index: 200;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          font-family: var(--font);
          -webkit-font-smoothing: antialiased;
          transition: background 1.2s ease;
        }
        .splash-welcome  { background: #ffffff; }
        .splash-verified { background: #f0f7ff; }
        .splash-out {
          background: #f2f2f7;
          animation: sp-fade-out 0.8s ease forwards;
          pointer-events: none;
        }
        @keyframes sp-fade-out { from { opacity: 1; } to { opacity: 0; } }
        .splash-enter { animation: sp-in 0.45s ease forwards; }
        @keyframes sp-in { from { opacity: 0; } to { opacity: 1; } }

        .sp-icon-wrap {
          width: 76px; height: 76px; border-radius: 22px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 32px;
          transition: background 0.7s ease, border-color 0.7s ease, box-shadow 0.7s ease;
        }
        .sp-icon-welcome {
          background: #f0f7ff;
          border: 1px solid rgba(0,122,255,0.14);
          box-shadow: 0 4px 22px rgba(0,122,255,0.10);
        }
        .sp-icon-verified {
          background: #edfaf3;
          border: 1px solid rgba(48,209,88,0.22);
          box-shadow: 0 4px 22px rgba(48,209,88,0.14);
          animation: icon-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        @keyframes icon-pop { from { transform: scale(0.8); opacity: 0.5; } to { transform: scale(1); opacity: 1; } }

        .sp-text-area {
          position: relative; height: 80px; width: 100%;
          display: flex; align-items: center; justify-content: center; overflow: hidden;
        }
        .sp-msg {
          position: absolute; width: 100%;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 10px; text-align: center; padding: 0 24px;
        }
        .sp-title { font-size: clamp(24px, 7vw, 30px); font-weight: 700; letter-spacing: -0.7px; color: #1c1c1e; line-height: 1.15; white-space: nowrap; }
        .sp-sub   { font-size: 14px; color: #6e6e73; font-weight: 400; line-height: 1.5; letter-spacing: -0.1px; }

        .sp-msg-welcome-in  { animation: msg-in 0.55s cubic-bezier(0.22,1,0.36,1) forwards; }
        .sp-msg-welcome-out { animation: msg-out-up 0.4s cubic-bezier(0.4,0,1,1) forwards; }
        .sp-msg-verified-in { animation: msg-in-from-below 0.55s cubic-bezier(0.22,1,0.36,1) forwards; }

        @keyframes msg-in            { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes msg-out-up        { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(-20px)} }
        @keyframes msg-in-from-below { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }

        .sp-dots { display: flex; gap: 6px; margin-top: 40px; }
        .sp-dot {
          height: 6px; border-radius: 99px;
          background: rgba(0,0,0,0.10);
          transition: width 0.45s cubic-bezier(0.34,1.2,0.64,1), background 0.3s ease;
          width: 6px;
        }
        .sp-dot.act { width: 22px; background: #007aff; }
      `}</style>

      {/* ══ SPLASH ══ */}
      {splash !== 'hidden' && (
        <div className={[
          'splash',
          splash === 'welcome'  ? 'splash-enter splash-welcome'  : '',
          splash === 'verified' ? 'splash-verified'              : '',
          splash === 'out'      ? 'splash-out'                   : '',
        ].join(' ')}>

          <div className={`sp-icon-wrap ${splash === 'verified' || splash === 'out' ? 'sp-icon-verified' : 'sp-icon-welcome'}`}>
            {splash === 'welcome' ? (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            ) : (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#30d158" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            )}
          </div>

          <div className="sp-text-area">
            {splash === 'welcome' && (
              <div className="sp-msg sp-msg-welcome-in">
                <span className="sp-title">Selamat Datang</span>
              </div>
            )}
            {(splash === 'verified' || splash === 'out') && (
              <div className="sp-msg sp-msg-verified-in">
                <span className="sp-title">Berhasil Masuk</span>
                <span className="sp-sub">Akun berhasil terverifikasi,<br/>mengarahkan ke dashboard…</span>
              </div>
            )}
          </div>

          <div className="sp-dots">
            <div className={`sp-dot ${splash === 'welcome' ? 'act' : ''}`} />
            <div className={`sp-dot ${splash === 'verified' || splash === 'out' ? 'act' : ''}`} />
          </div>
        </div>
      )}

      {/* ══ LOGIN FORM ══ */}
      {mounted && splash === 'hidden' && (
        <div className="lr">
          <div className="orb o1" />
          <div className="orb o2" />

          <div className="card">
            <div className="brand">
              <span className="brand-title">STC AutoTrade</span>
              <p className="brand-sub">Masuk untuk melanjutkan</p>
            </div>

            <div className="panel">
              <form onSubmit={handleLogin} noValidate>

                <div className={`fg ${focused ? 'active' : ''}`}>
                  <div className="field">
                    <label className="fl" htmlFor="email">Email</label>
                    <div className="fwrap">
                      <input
                        ref={emailRef}
                        id="email" type="email" className="fi"
                        placeholder="nama@contoh.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onFocus={() => setFocused('email')}
                        onBlur={() => setFocused(null)}
                        autoComplete="email" autoCapitalize="none"
                        spellCheck={false} required
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label className="fl" htmlFor="password">Password</label>
                    <div className="fwrap">
                      <input
                        ref={passRef}
                        id="password"
                        type={showPass ? 'text' : 'password'}
                        className="fi" placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onFocus={() => setFocused('password')}
                        onBlur={() => setFocused(null)}
                        autoComplete="current-password"
                        required style={{ paddingRight: 40 }}
                      />
                      <button type="button" className="eye-btn"
                        onClick={() => setShowPass(p => !p)}
                        tabIndex={-1}
                        aria-label={showPass ? 'Sembunyikan' : 'Tampilkan'}
                      >
                        {showPass ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <label className="remember-row" onClick={() => setRemember(r => !r)}>
                  <div className={`cb-box ${remember ? 'checked' : ''}`}>
                    <svg className="cb-tick" width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span className="cb-label">Ingat saya</span>
                </label>

                {error && (
                  <div className="err">
                    <div className="err-dot" />
                    <p className="err-txt">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn"
                  disabled={loading || !canSubmit}
                >
                  {loading && <div className="spin" />}
                  {loading ? 'Memverifikasi...' : 'Masuk'}
                </button>

              </form>

              <div style={{ textAlign: 'center' }}>
                <div className="badge">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#aeaeb2" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span className="badge-txt">Terenkripsi &amp; Aman</span>
                </div>
              </div>
            </div>

            <div className="foot">
              © 2026 STC AutoTrade ·{' '}
              <span className="foot-lnk">Ketentuan</span>
              {' '}·{' '}
              <span className="foot-lnk">Privasi</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}