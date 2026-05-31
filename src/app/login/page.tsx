// src/app/login/page.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { storage, isSessionValid } from '@/lib/storage';
import { isWhitelisted, updateLastLogin, getRegistrationConfig } from '@/lib/supabaseRepository';
import { LanguageProvider, useLanguage, AVAILABLE_LANGUAGES, COUNTRY_ENTRIES, Language, isWindows } from '@/lib';

type SplashPhase = 'hidden' | 'welcome' | 'verified' | 'out';

// ── CSS string extracted so it can be used with dangerouslySetInnerHTML ──────
const LOGIN_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:           #080e0a;
    --surface:      rgba(6, 30, 15, 0.88);
    --border:       rgba(76, 175, 80, 0.22);
    --border-focus: rgba(100, 220, 100, 0.55);
    --text-1:       #ffffff;
    --text-2:       rgba(255,255,255,0.55);
    --text-3:       rgba(255,255,255,0.30);
    --accent:       #4caf50;
    --accent-light: #66bb6a;
    --error:        #ff453a;
    --error-bg:     rgba(255,69,58,0.10);
    --success:      #30d158;
    --r-md:         14px;
    --r-xl:         22px;
    --font:         -apple-system, 'SF Pro Display', BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
  }

  /* ── Scoped override: variabel login di-hardcode langsung ke elemen ──────
     Selector yang dideklarasikan langsung pada element menang atas nilai
     yang diwariskan (inherited) dari body[data-theme="light"] globals.css.
     Ini menjamin tema login tetap gelap meskipun user pakai light mode.  */
  .lr-page, .splash, .tutor-modal, .tutor-overlay {
    --bg:           #080e0a;
    --surface:      rgba(6, 30, 15, 0.88);
    --border:       rgba(76, 175, 80, 0.22);
    --border-focus: rgba(100, 220, 100, 0.55);
    --text-1:       #ffffff;
    --text-2:       rgba(255,255,255,0.55);
    --text-3:       rgba(255,255,255,0.30);
    --accent:       #4caf50;
    --accent-light: #66bb6a;
    --error:        #ff453a;
    --error-bg:     rgba(255,69,58,0.10);
    --success:      #30d158;
    --r-md:         14px;
    --r-xl:         22px;
    --font:         -apple-system, 'SF Pro Display', BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
  }

  /* ── Page Shell ─────────────────────────────────────────────────────── */
  .lr-page {
    font-family:     var(--font);
    position:        fixed;
    inset:           0;
    background:      var(--bg);
    display:         flex;
    flex-direction:  column;
    align-items:     center;
    justify-content: flex-start;
    padding-top:     max(16px, env(safe-area-inset-top, 0px));
    padding-left:    16px;
    padding-right:   16px;
    padding-bottom:  max(72px, calc(env(safe-area-inset-bottom, 0px) + 60px));
    overflow-y:      auto;
    overflow-x:      hidden;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: none;
    -webkit-font-smoothing: antialiased;
    scroll-padding-bottom: 24px;
  }
  /* Vertically center when there's enough room */
  @media (min-height: 680px) {
    .lr-page { justify-content: center; }
  }
  /* Tablet */
  @media (min-width: 600px) {
    .lr-page {
      padding-left:   24px;
      padding-right:  24px;
      padding-bottom: max(40px, env(safe-area-inset-bottom, 0px));
    }
  }
  /* Desktop */
  @media (min-width: 1024px) {
    .lr-page {
      padding-top:    0;
      padding-bottom: 0;
      padding-left:   0;
      padding-right:  0;
      justify-content: center;
      align-items:    center;
    }
  }

  /* ── Ambient Orbs ───────────────────────────────────────────────────── */
  .orb { position: fixed; border-radius: 50%; pointer-events: none; animation: drift 20s ease-in-out infinite alternate; }
  .o1 {
    width: clamp(280px,70vw,520px); height: clamp(280px,70vw,520px);
    background: radial-gradient(circle, rgba(30,140,60,0.30) 0%, transparent 65%);
    bottom: -12%; right: -10%; filter: blur(80px);
  }
  .o2 {
    width: clamp(220px,55vw,420px); height: clamp(220px,55vw,420px);
    background: radial-gradient(circle, rgba(10,80,35,0.25) 0%, transparent 65%);
    top: -15%; left: -8%; filter: blur(70px); animation-delay: -9s;
  }
  @keyframes drift {
    0%   { transform: translate(0,0) scale(1); }
    50%  { transform: translate(3%,4%) scale(1.04); }
    100% { transform: translate(-2%,2%) scale(0.97); }
  }

  /* ── Card (outer wrapper) ───────────────────────────────────────────── */
  .card {
    position:  relative;
    z-index:   2;
    width:     100%;
    max-width: 390px;
    opacity:   0;
    transform: translateY(14px) scale(0.988);
    animation: rise 0.6s cubic-bezier(0.22,1,0.36,1) 0.08s forwards;
  }
  @keyframes rise { to { opacity: 1; transform: translateY(0) scale(1); } }

  /* Tablet: slightly wider card */
  @media (min-width: 600px) {
    .card { max-width: 440px; }
  }
  /* Desktop: wider + shadow frame */
  @media (min-width: 1024px) {
    .card {
      max-width: 460px;
      filter: drop-shadow(0 32px 80px rgba(0,0,0,0.55));
    }
  }

  /* ── Brand / Logo ───────────────────────────────────────────────────── */
  .brand { text-align: center; margin-bottom: 16px; }

  .brand-title {
    display: flex; align-items: center; justify-content: center;
    font-size: clamp(22px, 6vw, 30px);
    font-weight: 800; letter-spacing: -0.8px; line-height: 1;
    margin-bottom: 6px;
  }
  @media (min-width: 600px) { .brand-title { font-size: 30px; } }

  .brand-title-stc  { color: #ffffff; }
  .brand-title-auto { color: var(--accent-light); }
  .brand-sub { font-size: clamp(12px, 3.5vw, 14px); color: var(--text-2); font-weight: 400; }

  /* Mobile logo (shown on narrow screens) */
  .logo-mobile {
    display: flex; flex-direction: column;
    align-items: center; gap: 10px; margin-bottom: 8px;
  }
  .logo-mobile img {
    /* Scales from 72px on tiny phones to 96px on normal phones */
    height: clamp(72px, 22vw, 96px);
    width: auto; object-fit: contain;
  }

  /* Desktop logo (top-left corner) */
  .logo-desktop {
    display: none; position: absolute;
    top: calc(16px + env(safe-area-inset-top, 0px));
    left: 20px; z-index: 10; align-items: center; gap: 10px;
  }
  .logo-desktop img { height: 34px; width: auto; object-fit: contain; }
  .logo-desktop-name {
    font-size: 15px; font-weight: 700; letter-spacing: -0.3px;
    color: rgba(255,255,255,0.85);
  }

  @media (min-width: 600px) {
    .logo-desktop { display: flex; }
    .logo-mobile  { display: none;  }
    .brand        { margin-bottom: 20px; }
  }

  /* ── Panel (glassmorphism card) ─────────────────────────────────────── */
  .panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-xl);
    /* Compact on tiny phones, roomier on larger screens */
    padding: clamp(16px, 4vw, 24px) clamp(14px, 4vw, 22px) clamp(14px, 4vw, 20px);
    backdrop-filter: saturate(120%) blur(30px);
    -webkit-backdrop-filter: saturate(120%) blur(30px);
    box-shadow:
      0 8px 40px rgba(0,0,0,0.50),
      0 0 0 0.5px rgba(76,175,80,0.12),
      inset 0 1px 0 rgba(255,255,255,0.06);
  }
  @media (min-width: 600px) {
    .panel { padding: 26px 24px 22px; }
  }
  @media (min-width: 1024px) {
    .panel { padding: 30px 28px 26px; border-radius: 26px; }
  }

  /* ── Form Fields ────────────────────────────────────────────────────── */
  .fg-wrap { margin-bottom: 13px; }
  @media (min-width: 600px) { .fg-wrap { margin-bottom: 16px; } }

  .fg-label {
    display: block;
    font-size: 10.5px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.09em; color: var(--accent-light);
    margin-bottom: 7px; padding-left: 2px;
  }
  .fg-row {
    display: flex; align-items: center;
    background: rgba(0,0,0,0.30);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    overflow: hidden;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .fg-row.active {
    border-color: var(--border-focus);
    box-shadow: 0 0 0 3px rgba(76,175,80,0.15);
  }
  .fg-icon {
    display: flex; align-items: center; justify-content: center;
    width: 44px; flex-shrink: 0;
    background: rgba(30,100,50,0.45);
    align-self: stretch;
    border-right: 1px solid var(--border);
    color: var(--accent-light);
  }
  @media (min-width: 600px) { .fg-icon { width: 48px; } }

  .fi {
    flex: 1; background: transparent; border: none; outline: none;
    /* Minimum 16px on mobile avoids iOS zoom-in */
    padding: clamp(11px, 3vw, 13px) 12px;
    font-size: 16px; font-weight: 400;
    color: var(--text-1); font-family: var(--font); letter-spacing: -0.2px;
    -webkit-tap-highlight-color: transparent;
    appearance: none; -webkit-appearance: none;
  }
  .fi::placeholder { color: var(--text-3); font-size: 15px; }
  .fi[type="password"]              { letter-spacing: 3px; }
  .fi[type="password"]::placeholder { letter-spacing: -0.2px; font-size: 15px; }

  .eye-btn {
    background: none; border: none; padding: 0 14px; cursor: pointer;
    color: rgba(255,255,255,0.45); display: flex; align-items: center;
    transition: color 0.15s; -webkit-tap-highlight-color: transparent;
    min-width: 44px; justify-content: center; /* better tap target */
  }
  .eye-btn:hover { color: #66bb6a; }

  /* ── Remember me ────────────────────────────────────────────────────── */
  .remember-row {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 14px; cursor: pointer;
    -webkit-tap-highlight-color: transparent; user-select: none;
  }
  .cb-box {
    width: 22px; height: 22px; border-radius: 7px; flex-shrink: 0;
    border: 1.5px solid rgba(76,175,80,0.35);
    background: rgba(0,0,0,0.30);
    display: flex; align-items: center; justify-content: center;
    transition: background 0.18s, border-color 0.18s, box-shadow 0.18s;
  }
  .cb-box.checked {
    background: var(--accent); border-color: var(--accent);
    box-shadow: 0 1px 8px rgba(76,175,80,0.40);
  }
  .cb-tick {
    opacity: 0; transform: scale(0.5);
    transition: opacity 0.16s, transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
  }
  .cb-box.checked .cb-tick { opacity: 1; transform: scale(1); }
  .cb-label { font-size: 14px; color: var(--text-1); font-weight: 400; }

  /* ── Error banner ───────────────────────────────────────────────────── */
  .err {
    display: flex; align-items: flex-start; gap: 8px;
    background: var(--error-bg); border: 1px solid rgba(255,69,58,0.22);
    border-radius: 10px; padding: 10px 13px; margin-bottom: 12px;
    animation: shake 0.36s cubic-bezier(0.36,0.07,0.19,0.97);
  }
  @keyframes shake {
    0%,100%{ transform:translateX(0); } 20%{ transform:translateX(-4px); }
    50%    { transform:translateX(4px); } 80%{ transform:translateX(-3px); }
  }
  .err-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--error); flex-shrink: 0; margin-top: 4px; }
  .err-txt  { font-size: 12.5px; color: var(--error); line-height: 1.4; }
  .err-whitelist { background: rgba(255,69,58,0.07); border-color: rgba(255,69,58,0.28); }
  .err-whitelist .err-txt { font-size: 13px; font-weight: 500; }

  /* ── Submit button ──────────────────────────────────────────────────── */
  .btn {
    width: 100%;
    height: clamp(46px, 12vw, 52px);
    background: linear-gradient(180deg, #55c75a 0%, #3ea844 100%);
    border: none; border-radius: var(--r-md);
    color: #fff;
    font-size: clamp(15px, 4vw, 16px);
    font-weight: 700; letter-spacing: -0.3px;
    cursor: pointer; font-family: var(--font);
    display: flex; align-items: center; justify-content: center; gap: 10px;
    position: relative; overflow: hidden;
    box-shadow: 0 4px 20px rgba(76,175,80,0.45), 0 1px 0 rgba(255,255,255,0.15) inset;
    transition: opacity 0.15s, transform 0.12s, box-shadow 0.15s;
    -webkit-tap-highlight-color: transparent;
  }
  @media (min-width: 600px) { .btn { height: 52px; font-size: 16px; } }

  .btn::before {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(255,255,255,0.13) 0%, transparent 55%);
    pointer-events: none;
  }
  .btn:hover:not(:disabled)  { opacity: 0.90; box-shadow: 0 6px 26px rgba(76,175,80,0.55); }
  .btn:active:not(:disabled) { transform: scale(0.984); opacity: 0.82; }
  .btn:disabled              { opacity: 0.38; cursor: not-allowed; box-shadow: none; }
  .spin {
    width: 15px; height: 15px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.30); border-top-color: #fff;
    animation: rot 0.7s linear infinite; flex-shrink: 0;
  }
  @keyframes rot { to { transform: rotate(360deg); } }

  .step-hint {
    text-align: center; font-size: 11.5px;
    color: var(--text-3); margin-top: 8px;
    min-height: 16px; transition: opacity 0.2s;
  }

  /* ── Encrypted badge ────────────────────────────────────────────────── */
  .badge {
    display: inline-flex; align-items: center; gap: 6px;
    margin-top: 14px; padding: 6px 13px; border-radius: 99px;
    background: rgba(76,175,80,0.08); border: 1px solid rgba(76,175,80,0.18);
  }
  .badge-txt { font-size: 11px; color: var(--accent-light); font-weight: 600; letter-spacing: 0.01em; }

  /* ── Footer links ───────────────────────────────────────────────────── */
  .foot { text-align: center; margin-top: 14px; font-size: 11.5px; color: var(--text-3); }
  .foot-lnk {
    color: var(--accent-light); font-weight: 600; cursor: pointer;
    transition: opacity 0.14s; background: none; border: none;
    padding: 0; font-family: var(--font); font-size: 13px;
  }
  .foot-lnk:hover { opacity: 0.70; }

  /* ── Tutorial Modal ─────────────────────────────────────────────────── */
  .tutor-overlay {
    position: fixed; inset: 0; z-index: 500;
    background: rgba(0,0,0,0.65);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    display: flex; align-items: center; justify-content: center;
    padding: max(20px, env(safe-area-inset-top, 0px)) 16px max(20px, env(safe-area-inset-bottom, 0px));
    animation: tutor-in 0.22s cubic-bezier(0.22,1,0.36,1);
  }
  @keyframes tutor-in { from { opacity: 0; } to { opacity: 1; } }
  .tutor-modal {
    background: rgba(10,30,15,0.97);
    border: 1px solid rgba(76,175,80,0.20);
    border-radius: 22px;
    box-shadow: 0 24px 80px rgba(0,0,0,0.60), 0 4px 16px rgba(0,0,0,0.20);
    width: 100%; max-width: 380px; overflow: hidden;
    animation: tutor-rise 0.28s cubic-bezier(0.22,1,0.36,1);
  }
  @keyframes tutor-rise {
    from { opacity: 0; transform: translateY(18px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .tutor-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 18px 12px; border-bottom: 1px solid rgba(76,175,80,0.12);
  }
  .tutor-title { font-size: 15px; font-weight: 650; color: #fff; letter-spacing: -0.3px; }
  .tutor-close {
    width: 30px; height: 30px; border-radius: 50%;
    background: rgba(255,255,255,0.08); border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: var(--text-2); transition: background 0.15s; flex-shrink: 0;
  }
  .tutor-close:hover { background: rgba(255,255,255,0.14); }
  .tutor-img-wrap {
    position: relative; width: 100%; background: #080e0a;
    aspect-ratio: 9/16;
    /* Limit height based on viewport to avoid overflow on short screens */
    max-height: min(55vh, 480px);
    overflow: hidden; margin-bottom: 14px;
  }
  .tutor-img-wrap img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .tutor-footer {
    padding: 0 18px 18px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .tutor-next-btn {
    background: var(--accent); border: none; cursor: pointer;
    color: #fff; font-family: var(--font);
    font-size: 13px; font-weight: 700; letter-spacing: -0.1px;
    padding: 9px 20px; border-radius: 99px;
    box-shadow: 0 2px 10px rgba(76,175,80,0.35);
    transition: opacity 0.15s, transform 0.12s; -webkit-tap-highlight-color: transparent;
  }
  .tutor-next-btn:hover { opacity: 0.86; }
  .tutor-next-btn:active { transform: scale(0.96); }
  .tutor-next-btn:disabled { opacity: 0.28; cursor: default; }
  .tutor-dots { display: flex; gap: 6px; align-items: center; }
  .tutor-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: rgba(255,255,255,0.18);
    transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1);
  }
  .tutor-dot.active { background: var(--accent); width: 20px; border-radius: 99px; }
  .tutor-caption { padding: 0 18px 12px; animation: caption-fade 0.25s ease; }
  @keyframes caption-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  .tutor-caption-step {
    font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--accent-light); margin-bottom: 4px;
  }
  .tutor-caption-text { font-size: 13px; color: var(--text-2); line-height: 1.5; letter-spacing: -0.1px; }
  .tutor-caption-text strong { color: #fff; font-weight: 600; }

  /* ── Register link ──────────────────────────────────────────────────── */
  .register-link {
    text-align: center; margin-top: 16px;
    font-size: clamp(13px, 3.5vw, 14px); color: var(--text-2);
  }
  .register-link a { color: var(--accent-light); font-weight: 700; text-decoration: none; transition: opacity 0.14s; }
  .register-link a:hover { opacity: 0.70; }

  /* ── Language Selector ──────────────────────────────────────────────── */
  .lang-selector {
    position: absolute;
    top: calc(12px + env(safe-area-inset-top, 0px));
    right: 14px; z-index: 10;
  }
  @media (min-width: 600px) {
    .lang-selector {
      top: calc(16px + env(safe-area-inset-top, 0px));
      right: 20px;
    }
  }
  .lang-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 12px; border-radius: 22px;
    background: rgba(0,0,0,0.45);
    border: 1px solid rgba(255,255,255,0.12);
    cursor: pointer; font-size: 13px; font-weight: 500;
    color: rgba(255,255,255,0.80);
    backdrop-filter: blur(12px);
    transition: all 0.15s; max-width: 150px;
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
    -webkit-tap-highlight-color: transparent;
  }
  .lang-btn:hover { background: rgba(0,0,0,0.60); border-color: rgba(255,255,255,0.20); }
  .lang-btn-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 80px; }
  .lang-dropdown {
    position: absolute; top: calc(100% + 6px); right: 0;
    background: rgba(10,25,15,0.97);
    border: 1px solid rgba(76,175,80,0.20);
    border-radius: 14px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.50);
    overflow: hidden; min-width: 180px;
    max-height: min(300px, 60vh);
    overflow-y: auto; animation: lang-fade 0.2s ease;
  }
  @keyframes lang-fade { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  .lang-option {
    width: 100%; display: flex; align-items: center; gap: 10px;
    padding: 11px 14px; background: transparent;
    border: none; border-bottom: 1px solid rgba(76,175,80,0.08);
    cursor: pointer; text-align: left; font-size: 14px;
    color: var(--text-1);
    transition: background 0.15s; font-family: var(--font);
  }
  .lang-option:last-child { border-bottom: none; }
  .lang-option:hover { background: rgba(76,175,80,0.10); }
  .lang-option.active { background: rgba(76,175,80,0.14); color: var(--accent-light); font-weight: 600; }

  /* ── Splash ─────────────────────────────────────────────────────────── */
  .splash {
    position: fixed; inset: 0; z-index: 200;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    font-family: var(--font); -webkit-font-smoothing: antialiased;
    transition: background 1.2s ease; overflow: hidden;
  }
  .splash-welcome  { background: linear-gradient(160deg, #0a1f0d 0%, #0d1a10 60%, #111c14 100%); }
  .splash-verified { background: linear-gradient(160deg, #091a0c 0%, #0c1a12 100%); }
  .splash-out { animation: sp-fade-out 0.8s ease forwards; pointer-events: none; }
  @keyframes sp-fade-out { from { opacity: 1; } to { opacity: 0; } }
  .splash-enter { opacity: 1; }

  .sp-orb { position: fixed; border-radius: 50%; pointer-events: none; opacity: 0; transition: opacity 0.6s ease; }
  .splash-welcome .sp-orb, .splash-verified .sp-orb, .splash-out .sp-orb { opacity: 1; }
  .sp-orb-1 { width: 420px; height: 420px; background: radial-gradient(circle, rgba(30,160,70,0.28) 0%, transparent 70%); filter: blur(80px); top: -100px; left: -130px; animation: orb-drift-1 6s ease-in-out infinite alternate; }
  .sp-orb-2 { width: 380px; height: 380px; background: radial-gradient(circle, rgba(48,209,88,0.22) 0%, transparent 70%); filter: blur(75px); bottom: -90px; right: -110px; animation: orb-drift-2 7s ease-in-out infinite alternate; }
  .sp-orb-3 { width: 300px; height: 300px; background: radial-gradient(circle, rgba(0,200,100,0.15) 0%, transparent 70%); filter: blur(85px); top: 35%; left: -90px; animation: orb-drift-3 5s ease-in-out infinite alternate; }
  .sp-orb-4 { width: 280px; height: 280px; background: radial-gradient(circle, rgba(76,175,80,0.20) 0%, transparent 70%); filter: blur(80px); bottom: 25%; right: -80px; animation: orb-drift-4 5.5s ease-in-out infinite alternate; }
  @keyframes orb-drift-1 { from{transform:translate(0,0)} to{transform:translate(40px,30px)} }
  @keyframes orb-drift-2 { from{transform:translate(0,0)} to{transform:translate(-35px,-25px)} }
  @keyframes orb-drift-3 { from{transform:translate(0,0)} to{transform:translate(30px,20px)} }
  @keyframes orb-drift-4 { from{transform:translate(0,0)} to{transform:translate(-28px,-20px)} }
  .splash-out .sp-orb { animation: orb-fade-out 0.8s ease forwards !important; }
  @keyframes orb-fade-out { from{opacity:1} to{opacity:0} }

  .sp-sparkle { position: absolute; pointer-events: none; border-radius: 50%; animation: sparkle-float linear infinite; }
  @keyframes sparkle-float {
    0%   { transform: translateY(0) rotate(0deg);   opacity: 0; }
    15%  { opacity: 1; }
    85%  { opacity: 1; }
    100% { transform: translateY(-60px) rotate(180deg); opacity: 0; }
  }

  .sp-avatar-wrap { position: relative; width: 110px; height: 110px; display: flex; align-items: center; justify-content: center; margin-bottom: 28px; }
  .sp-ring { position: absolute; inset: 0; border-radius: 50%; border: 2px solid rgba(76,175,80,0.25); animation: ring-pulse 2s ease-in-out infinite; }
  .sp-ring-2 { inset: -12px; border-color: rgba(76,175,80,0.14); animation-delay: 0.4s; }
  .sp-ring-3 { inset: -24px; border-color: rgba(76,175,80,0.08); animation-delay: 0.8s; }
  @keyframes ring-pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.06); opacity: 0.6; } }
  .sp-avatar {
    width: 90px; height: 90px; border-radius: 28px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(10,40,20,0.95);
    border: 1px solid rgba(76,175,80,0.25);
    box-shadow: 0 8px 36px rgba(76,175,80,0.20), 0 2px 8px rgba(0,0,0,0.40);
    animation: avatar-in 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards; position: relative; z-index: 1;
  }
  @keyframes avatar-in { from{transform:scale(0.7);opacity:0} to{transform:scale(1);opacity:1} }
  .sp-avatar-verified {
    background: linear-gradient(135deg, #30d158 0%, #25a244 100%);
    border-color: rgba(48,209,88,0.30);
    box-shadow: 0 8px 36px rgba(48,209,88,0.35), 0 2px 8px rgba(0,0,0,0.30);
    animation: avatar-pop 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards;
  }
  .sp-ring-verified { border-color: rgba(48,209,88,0.28); }
  .sp-ring-2-verified { border-color: rgba(48,209,88,0.16); }
  .sp-ring-3-verified { border-color: rgba(48,209,88,0.08); }
  @keyframes avatar-pop { 0%{transform:scale(0.6);opacity:0} 70%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }

  .sp-wave { font-size: 38px; line-height: 1; animation: wave-hand 1.2s ease-in-out infinite; display: inline-block; }
  @keyframes wave-hand { 0%,100% { transform: rotate(0deg); } 20% { transform: rotate(-12deg); } 40% { transform: rotate(14deg); } 60% { transform: rotate(-8deg); } 80% { transform: rotate(10deg); } }

  .sp-pill {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(76,175,80,0.12); border: 1px solid rgba(76,175,80,0.22);
    border-radius: 99px; padding: 5px 14px;
    font-size: 12px; font-weight: 600; color: var(--accent-light);
    letter-spacing: 0.02em;
    animation: pill-in 0.5s cubic-bezier(0.22,1,0.36,1) 0.2s both;
  }
  @keyframes pill-in { from{opacity:0;transform:translateY(8px) scale(0.95)} to{opacity:1;transform:translateY(0) scale(1)} }
  .sp-pill-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-light); animation: blink 1.2s ease-in-out infinite; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

  .sp-text-area { position: relative; width: 100%; display: flex; align-items: center; justify-content: center; overflow: visible; }
  .sp-msg { position: relative; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; text-align: center; padding: 0 28px; }
  .sp-title { font-size: clamp(26px, 8vw, 34px); font-weight: 800; letter-spacing: -1px; line-height: 1.1; color: #ffffff; }
  .sp-title-success { color: var(--accent-light); }
  .sp-sub { font-size: 14.5px; color: var(--text-2); font-weight: 400; line-height: 1.5; letter-spacing: -0.1px; }
  .sp-name { font-weight: 700; color: var(--accent-light); }
  .sp-msg-welcome-in  { animation: msg-in 0.6s cubic-bezier(0.22,1,0.36,1) 0.1s both; }
  .sp-msg-verified-in { animation: msg-in 0.6s cubic-bezier(0.22,1,0.36,1) 0.1s both; }
  @keyframes msg-in { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }

  .sp-dots { display: flex; gap: 6px; margin-top: 36px; }
  .sp-dot { height: 6px; border-radius: 99px; background: rgba(255,255,255,0.15); transition: width 0.45s cubic-bezier(0.34,1.2,0.64,1), background 0.3s ease; width: 6px; }
  .sp-dot.act { width: 24px; background: var(--accent-light); }
  .sp-dot.act-green { width: 24px; background: #30d158; }

  /* Toast */
  .toast-container { position: fixed; top: 0; left: 0; right: 0; z-index: 300; display: flex; justify-content: center; padding: calc(16px + env(safe-area-inset-top, 0px)) 20px 0; pointer-events: none; }
  .toast { display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-radius: 16px; background: rgba(52, 199, 89, 0.95); color: #fff; font-size: 14px; font-weight: 500; letter-spacing: -0.15px; box-shadow: 0 8px 32px rgba(52,199,89,0.30), 0 0 0 0.5px rgba(255,255,255,0.2); backdrop-filter: blur(12px) saturate(180%); -webkit-backdrop-filter: blur(12px) saturate(180%); pointer-events: auto; max-width: 90vw; animation: toast-in 0.45s cubic-bezier(0.22,1,0.36,1) forwards; }
  .toast.hiding { animation: toast-out 0.35s cubic-bezier(0.4,0,1,1) forwards; }
  @keyframes toast-in { from { opacity: 0; transform: translateY(-20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes toast-out { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(-12px) scale(0.96); } }
  .toast-icon { width: 24px; height: 24px; border-radius: 50%; background: rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .toast-close { background: none; border: none; color: rgba(255,255,255,0.8); cursor: pointer; padding: 2px; display: flex; align-items: center; margin-left: 4px; transition: color 0.15s; }
  .toast-close:hover { color: #fff; }

  /* Tutorial button */
  .tutorial-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 18px; border-radius: 50px;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.15);
    cursor: pointer; font-family: var(--font);
    font-size: 13.5px; color: rgba(255,255,255,0.70);
    transition: all 0.15s; -webkit-tap-highlight-color: transparent;
  }
  .tutorial-btn:hover { border-color: rgba(76,175,80,0.40); color: var(--accent-light); }
  .tutorial-btn:active { opacity: 0.75; }
`;

// ── Loading step labels (shown below the sign-in button while loading) ─────
type LoginStep = 'idle' | 'auth' | 'whitelist' | 'saving';

function LoginPageContent() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [loginStep, setLoginStep] = useState<LoginStep>('idle');
  const [error,    setError]    = useState('');
  const [isWhitelistError, setIsWhitelistError] = useState(false);
  const [mounted,  setMounted]  = useState(false);
  const [focused,  setFocused]  = useState<'email' | 'password' | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [splash,   setSplash]   = useState<SplashPhase>('hidden');
  const [showLangSelector, setShowLangSelector] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialPage, setTutorialPage] = useState(0);
  const [useImg, setUseImg] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState('https://wa.me/6285959860015');

  const [toast, setToast] = useState<{ visible: boolean; message: string; hiding: boolean }>({
    visible: false, message: '', hiding: false,
  });

  const emailRef = useRef<HTMLInputElement>(null);
  const passRef  = useRef<HTMLInputElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      setMounted(true);

      if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
        try {
          const { StatusBar, Style } = await import('@capacitor/status-bar');
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#080e0a' });
        } catch { /* plugin tidak tersedia */ }
      }

      const savedEmail = await storage.get('stc_remember_email');
      const savedPass  = await storage.get('stc_remember_password');
      if (savedEmail) { setEmail(savedEmail); setRemember(true); }
      if (savedPass)  { setPassword(savedPass); }
      const sessionValid = await isSessionValid();
      if (sessionValid) router.push('/dashboard');

      try {
        const config = await getRegistrationConfig();
        if (config.whatsappHelpUrl?.trim()) {
          setWhatsappUrl(config.whatsappHelpUrl.trim());
        }
      } catch { /* gunakan default */ }

      if (typeof window !== 'undefined') {
        const registerSuccess = sessionStorage.getItem('stc_register_success');
        const registerEmail = sessionStorage.getItem('stc_register_email');
        if (registerSuccess === '1') {
          const msg = registerEmail
            ? `Registrasi berhasil! Akun ${registerEmail} telah ditambahkan ke whitelist.`
            : 'Registrasi berhasil! Silakan login dengan akun Stockity Anda.';
          setToast({ visible: true, message: msg, hiding: false });
          sessionStorage.removeItem('stc_register_success');
          sessionStorage.removeItem('stc_register_email');
          setTimeout(() => {
            setToast(prev => ({ ...prev, hiding: true }));
            setTimeout(() => setToast({ visible: false, message: '', hiding: false }), 400);
          }, 5000);
        }
      }
    };
    init();
  }, [router]);

  useEffect(() => { setUseImg(isWindows()); }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setShowLangSelector(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const runSplash = async (res: { accessToken: string; userId: string; email: string; deviceId: string }) => {
    const { saveUserSession } = await import('@/lib/storage');

    // ── Auto-detect currency & language dari akun Stockity ───────────────────
    // Jalankan fetchUserProfile + fetchPlatformCurrencies secara paralel.
    // Keduanya bisa gagal (network error / token belum siap) → gunakan fallback.
    let detectedCurrency    = 'IDR';
    let detectedCurrencyIso = 'Rp';
    let detectedCountry     = 'ID';   // ISO2 negara akun, bukan geo IP

    try {
      const { fetchUserProfile, fetchPlatformCurrencies } = await import('@/lib/userProfileApi');
      const [profileResult, currencyResult] = await Promise.allSettled([
        fetchUserProfile(res.accessToken, res.deviceId),
        fetchPlatformCurrencies(res.accessToken, res.deviceId),
      ]);

      // Ambil country dari profile (registration_country_iso lebih reliable dari geo IP)
      if (profileResult.status === 'fulfilled') {
        const p = profileResult.value;
        // fetchUserProfile memetakan snake_case → camelCase
        // field "country" di response Stockity → "country" di UserProfile
        const countryRaw = (p as any).country ?? (p as any).registrationCountryIso ?? 'ID';
        detectedCountry  = (countryRaw as string).toUpperCase();
      }

      // Ambil currency (ISO code + unit/simbol) dari /platform/private/v2/currencies
      if (currencyResult.status === 'fulfilled') {
        detectedCurrency    = currencyResult.value.currencyIso;  // e.g. "COP"
        detectedCurrencyIso = currencyResult.value.currencyUnit; // e.g. "Col$"
      }
    } catch (err) {
      console.warn('[runSplash] Gagal deteksi currency/language, pakai fallback IDR:', err);
    }

    // ── Map country ISO → language code via COUNTRY_ENTRIES ──────────────────
    // COUNTRY_ENTRIES: [{ code: 'es', region: 'CO' }, { code: 'id', region: 'ID' }, ...]
    const validCodes   = AVAILABLE_LANGUAGES.map(l => l.code);
    const countryEntry = COUNTRY_ENTRIES.find(
      e => e.region.toUpperCase() === detectedCountry,
    );
    const detectedLang = (
      countryEntry && validCodes.includes(countryEntry.code as Language)
        ? countryEntry.code
        : 'en'                  // fallback ke English jika negara tidak dikenali
    ) as Language;

    // ── Simpan preferensi bahasa ke localStorage agar dashboard ikut ─────────
    // setLanguage juga memanggil localStorage.setItem → dashboard load dengan bahasa ini
    setLanguage(detectedLang, detectedCountry);

    // ── Simpan sesi (dengan currency yang benar) ──────────────────────────────
    await saveUserSession({
      authtoken:    res.accessToken,
      userId:       res.userId,
      deviceId:     res.deviceId,
      email:        res.email,
      userTimezone: 'Asia/Bangkok',
      userAgent:    typeof window !== 'undefined' ? navigator.userAgent : '',
      deviceType:   'web',
      currency:     detectedCurrency,    // e.g. "COP" / "IDR"
      currencyIso:  detectedCurrencyIso, // e.g. "Col$" / "Rp"  ← SIMBOL, bukan ISO code
    });

    setSplash('welcome');
    setTimeout(() => setSplash('verified'), 3000);
    setTimeout(() => {
      setSplash('out');
      const htmlSplash = document.getElementById('__stc_splash');
      if (htmlSplash) {
        htmlSplash.style.transition = 'none';
        htmlSplash.style.opacity = '1';
        htmlSplash.style.pointerEvents = 'none';
        htmlSplash.classList.remove('hide');
        requestAnimationFrame(() => { htmlSplash.style.transition = ''; });
      }
      sessionStorage.setItem('stc_from_login', '1');
      setTimeout(() => router.push('/dashboard'), 50);
    }, 7000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailVal = emailRef.current?.value || email;
    const passVal  = passRef.current?.value  || password;

    setLoading(true);
    setError('');
    setIsWhitelistError(false);
    setLoginStep('auth');

    try {
      const res = await api.login(emailVal, passVal);

      setLoginStep('whitelist');
      const allowed = await isWhitelisted(res.email || emailVal);
      if (!allowed) {
        setIsWhitelistError(true);
        throw new Error(t('login.notWhitelisted'));
      }

      setLoginStep('saving');
      if (remember) {
        await storage.set('stc_remember_email',    emailVal);
        await storage.set('stc_remember_password', passVal);
      } else {
        await storage.remove('stc_remember_email');
        await storage.remove('stc_remember_password');
      }

      updateLastLogin(res.email || emailVal).catch(() => {});
      await runSplash(res);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('login.invalidCredentials'));
      setLoading(false);
      setLoginStep('idle');
    }
  };

  const stepHintLabel = (): string => {
    switch (loginStep) {
      case 'auth':      return 'Memverifikasi akun…';
      case 'whitelist': return 'Memeriksa akses whitelist…';
      case 'saving':    return 'Menyimpan sesi…';
      default:          return '';
    }
  };

  const canSubmit = !!(
    (email || emailRef.current?.value) &&
    (password || passRef.current?.value)
  );

  const getLanguageName = (code: Language): string => {
    return AVAILABLE_LANGUAGES.find(l => l.code === code)?.nativeName ?? code.toUpperCase();
  };

  const FlagIcon = ({ lang, size = 16 }: { lang: typeof AVAILABLE_LANGUAGES[0]; size?: number }) => {
    if (useImg) {
      return (
        <Image
          src={lang.flagImg}
          alt={lang.name}
          width={size + 2}
          height={Math.round((size + 2) * 0.75)}
          unoptimized
          style={{ objectFit: 'cover', borderRadius: 2, display: 'inline-block', verticalAlign: 'middle' }}
        />
      );
    }
    return <span style={{ fontSize: size }}>{lang.flag}</span>;
  };

  const dismissToast = () => {
    setToast(prev => ({ ...prev, hiding: true }));
    setTimeout(() => setToast({ visible: false, message: '', hiding: false }), 400);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LOGIN_STYLES }} />

      {/* Splash */}
      {splash !== 'hidden' && (
        <div className={[
          'splash',
          splash === 'welcome'  ? 'splash-enter splash-welcome'  : '',
          splash === 'verified' ? 'splash-verified'              : '',
          splash === 'out'      ? 'splash-out'                   : '',
        ].join(' ')}>
          <div className="sp-orb sp-orb-1" />
          <div className="sp-orb sp-orb-2" />
          <div className="sp-orb sp-orb-3" />
          <div className="sp-orb sp-orb-4" />

          {splash === 'welcome' && ([
            { size: 8,  color: '#4caf50', left: '12%', top: '22%', delay: '0s',    dur: '3.2s' },
            { size: 6,  color: '#66bb6a', left: '80%', top: '18%', delay: '0.6s',  dur: '2.8s' },
            { size: 10, color: '#30d158', left: '88%', top: '55%', delay: '1.1s',  dur: '3.5s' },
            { size: 5,  color: '#81c784', left: '8%',  top: '60%', delay: '0.3s',  dur: '2.6s' },
            { size: 7,  color: '#4caf50', left: '70%', top: '80%', delay: '0.8s',  dur: '3.0s' },
            { size: 9,  color: '#66bb6a', left: '22%', top: '78%', delay: '1.4s',  dur: '2.9s' },
          ].map((s, i) => (
            <div key={i} className="sp-sparkle" style={{
              width: s.size, height: s.size, background: s.color,
              left: s.left, top: s.top,
              animationDelay: s.delay, animationDuration: s.dur, opacity: 0.8,
            }} />
          )))}

          <div className="sp-avatar-wrap">
            <div className={`sp-ring ${splash !== 'welcome' ? 'sp-ring-verified' : ''}`} />
            <div className={`sp-ring sp-ring-2 ${splash !== 'welcome' ? 'sp-ring-2-verified' : ''}`} />
            <div className={`sp-ring sp-ring-3 ${splash !== 'welcome' ? 'sp-ring-3-verified' : ''}`} />
            {splash === 'welcome' ? (
              <div className="sp-avatar">
                <span className="sp-wave">👋</span>
              </div>
            ) : (
              <div className="sp-avatar" style={{ background: 'linear-gradient(135deg,#30d158 0%,#25a244 100%)', border: '1px solid rgba(48,209,88,0.30)', boxShadow: '0 4px 22px rgba(48,209,88,0.30)', animation: 'avatar-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
            )}
          </div>

          {splash === 'welcome' && (
            <div className="sp-pill" style={{ marginBottom: 18 }}>
              <div className="sp-pill-dot" />
              Masuk ke akun Anda
            </div>
          )}

          <div className="sp-text-area">
            {splash === 'welcome' && (
              <div className="sp-msg sp-msg-welcome-in">
                <span className="sp-title">{t('login.welcome')}</span>
                <span className="sp-sub">Senang melihat Anda kembali 🎉</span>
              </div>
            )}
            {(splash === 'verified' || splash === 'out') && (
              <div className="sp-msg sp-msg-verified-in">
                <span className="sp-title">{t('login.loginSuccess')}</span>
                <span className="sp-sub">{t('login.redirecting')}</span>
              </div>
            )}
          </div>

          <div className="sp-dots">
            <div className={`sp-dot ${splash === 'welcome' ? 'act' : ''}`} />
            <div className={`sp-dot ${splash === 'verified' || splash === 'out' ? 'act' : ''}`} />
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.visible && (
        <div className="toast-container">
          <div className={`toast ${toast.hiding ? 'hiding' : ''}`}>
            <div className="toast-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <span style={{ lineHeight: 1.4 }}>{toast.message}</span>
            <button className="toast-close" onClick={dismissToast} aria-label="Tutup notifikasi">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {mounted && (
        <div
          className="lr-page"
          style={splash !== 'hidden' ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}
        >
          {/* Logo Desktop — top-left corner on tablet/desktop */}
          <div className="logo-desktop">
            <Image src="/logo.png" alt="STC AutoTrade" width={34} height={34} style={{ height: '34px', width: 'auto', borderRadius: 8 }} />
            <span className="logo-desktop-name">STC AutoTrade</span>
          </div>

          {/* Language Selector */}
          <div className="lang-selector" ref={langRef}>
            <button className="lang-btn" onClick={() => setShowLangSelector(!showLangSelector)}>
              {(() => { const l = AVAILABLE_LANGUAGES.find(l => l.code === language); return l ? <FlagIcon lang={l} size={16} /> : '🌐'; })()}
              <span className="lang-btn-text">{getLanguageName(language)}</span>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0 }}>
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {showLangSelector && (
              <div className="lang-dropdown">
                {AVAILABLE_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    className={`lang-option ${language === lang.code ? 'active' : ''}`}
                    onClick={() => { setLanguage(lang.code as Language); setShowLangSelector(false); }}
                  >
                    <FlagIcon lang={lang} size={16} />
                    <span>{lang.nativeName}</span>
                    {language === lang.code && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="orb o1" />
          <div className="orb o2" />

          <div className="card">
            <div className="brand">
              {/* Logo Mobile */}
              <div className="logo-mobile">
                <Image src="/logo.png" alt="STC AutoTrade" width={96} height={96} style={{ height: 'clamp(72px, 22vw, 96px)', width: 'auto', borderRadius: 22 }} />
              </div>
              {/* Title with green AutoTrade */}
              <div className="brand-title">
                <span className="brand-title-stc">STC&nbsp;</span>
                <span className="brand-title-auto">AutoTrade</span>
              </div>
              <p className="brand-sub">{t('login.subtitle')}</p>
            </div>

            <div className="panel">
              <div tabIndex={0} aria-hidden="true" style={{position:"absolute",opacity:0,width:0,height:0,overflow:"hidden",pointerEvents:"none"}}/>
              <form onSubmit={handleLogin} noValidate>

                {/* EMAIL field */}
                <div className="fg-wrap">
                  <label className="fg-label" htmlFor="email">{t('login.email')}</label>
                  <div className={`fg-row ${focused === 'email' ? 'active' : ''}`}>
                    <div className="fg-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                    </div>
                    <input
                      ref={emailRef}
                      id="email" type="email" className="fi"
                      placeholder={t('login.emailPlaceholder')}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onFocus={() => setFocused('email')}
                      onBlur={() => setFocused(null)}
                      autoComplete="email" autoCapitalize="none"
                      spellCheck={false} required
                    />
                  </div>
                </div>

                {/* PASSWORD field */}
                <div className="fg-wrap">
                  <label className="fg-label" htmlFor="password">{t('login.password')}</label>
                  <div className={`fg-row ${focused === 'password' ? 'active' : ''}`}>
                    <div className="fg-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </div>
                    <input
                      ref={passRef}
                      id="password"
                      type={showPass ? 'text' : 'password'}
                      className="fi"
                      placeholder={t('login.passwordPlaceholder')}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setFocused('password')}
                      onBlur={() => setFocused(null)}
                      autoComplete="current-password"
                      required style={{ paddingRight: 4 }}
                    />
                    <button type="button" className="eye-btn"
                      onClick={() => setShowPass(p => !p)}
                      tabIndex={-1}
                      aria-label={showPass ? t('common.close') : t('common.show')}
                    >
                      {showPass ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember me */}
                <label className="remember-row" onClick={() => setRemember(r => !r)}>
                  <div className={`cb-box ${remember ? 'checked' : ''}`}>
                    <svg className="cb-tick" width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span className="cb-label">{t('login.rememberMe')}</span>
                </label>

                {/* Error */}
                {error && (
                  <div className={`err${isWhitelistError ? ' err-whitelist' : ''}`}>
                    {isWhitelistError ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                        <rect x="3" y="11" width="18" height="11" rx="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    ) : (
                      <div className="err-dot" />
                    )}
                    <p className="err-txt">{error}</p>
                  </div>
                )}

                {/* Submit button */}
                <button type="submit" className="btn" disabled={loading || !canSubmit}>
                  {loading && <div className="spin" />}
                  {loading ? t('login.signingIn') : t('login.signIn')}
                  {!loading && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  )}
                </button>

                <p className="step-hint" style={{ opacity: loading ? 1 : 0 }}>
                  {stepHintLabel()}
                </p>
              </form>

              <div style={{ textAlign: 'center' }}>
                <div className="badge">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-light)' }}>
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span className="badge-txt">{t('common.encrypted')} & {t('common.secure')}</span>
                </div>
              </div>
            </div>

            <div className="register-link">
              {t('login.noAccount')} <Link href="/register">{t('login.register')}</Link>
            </div>

            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button
                className="tutorial-btn"
                onClick={() => { setTutorialPage(0); setShowTutorial(true); }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
                <span>Cara daftar STC</span>
                <span style={{ color: 'var(--accent-light)', fontWeight: 700 }}>lihat tutorial</span>
              </button>
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text-3)', padding: '14px 0 4px' }}>
            © 2026 STC AutoTrade ·{' '}
            <a href="https://stockity.id/information/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-3)', fontWeight: 500, cursor: 'pointer', transition: 'opacity 0.14s' }}>{t('login.terms')}</a>
          </div>
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-3)', paddingBottom: 8 }}>
            Ada pertanyaan?{' '}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent-light)', fontWeight: 600, textDecoration: 'none' }}
            >
              Hubungi kami
            </a>
          </div>
        </div>
      )}

      {/* Tutorial Modal Portal */}
      {showTutorial && typeof document !== 'undefined' && createPortal((() => {
        const TUTOR_CAPTIONS = [
          {
            step: 'Langkah 1 — Buat Akun',
            text: <span>Gunakan <strong>akun baru</strong> ya! Isi <strong>email</strong>, buat <strong>password</strong>, pilih <strong>mata uang</strong> yang sesuai, lalu tekan tombol <strong>Daftar</strong>.</span>,
          },
          {
            step: 'Langkah 2 — Registrasi Berhasil',
            text: <span>Selamat! Akan muncul pesan sukses seperti gambar di atas. Selanjutnya, tekan tombol <strong>"Login STC AutoTrade"</strong> untuk langsung menuju halaman login 🎉</span>,
          },
          {
            step: 'Langkah 3 — Masuk ke Akun',
            text: <span>Hampir selesai! Masukkan <strong>email</strong> dan <strong>password</strong> yang tadi didaftarkan, lalu tekan login. Selamat bergabung di STC AutoTrade! 🚀</span>,
          },
        ];
        const cap = TUTOR_CAPTIONS[tutorialPage];
        return (
          <div className="tutor-overlay" onClick={() => setShowTutorial(false)}>
            <div className="tutor-modal" onClick={e => e.stopPropagation()}>
              <div className="tutor-header">
                <span className="tutor-title">Tutorial Pendaftaran</span>
                <button className="tutor-close" onClick={() => setShowTutorial(false)} aria-label="Tutup">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              <div className="tutor-img-wrap">
                <Image
                  src={`/tutor${tutorialPage + 1}.jpeg`}
                  alt={`Tutorial langkah ${tutorialPage + 1}`}
                  fill
                  style={{ objectFit: 'contain' }}
                  priority
                />
              </div>

              <div key={tutorialPage} className="tutor-caption">
                <p className="tutor-caption-step">{cap.step}</p>
                <p className="tutor-caption-text">{cap.text}</p>
              </div>

              <div className="tutor-footer">
                <div className="tutor-dots">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className={`tutor-dot${tutorialPage === i ? ' active' : ''}`}
                      onClick={() => setTutorialPage(i)}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </div>
                <button
                  className="tutor-next-btn"
                  onClick={() => tutorialPage < 2 ? setTutorialPage(p => p + 1) : setShowTutorial(false)}
                >
                  {tutorialPage < 2 ? 'Selanjutnya' : 'Selesai'}
                </button>
              </div>
            </div>
          </div>
        );
      })(), document.body)}
    </>
  );
}

export default function LoginPage() {
  return <LoginPageContent />;
}