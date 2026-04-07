'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useLanguage, AVAILABLE_LANGUAGES, Language } from '@/lib/i18n/LanguageContext';

interface LanguageSelectorProps {
  variant?: 'row' | 'sheet' | 'dropdown';
  showLabel?: boolean;
  disabled?: boolean;
}

// Row variant - for use in settings list
export function LanguageSelectorRow({ showLabel = true, disabled = false }: LanguageSelectorProps) {
  const { language, setLanguage, getLanguageName, getLanguageFlag, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLang = AVAILABLE_LANGUAGES.find((l) => l.code === language);

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '10px 16px 10px 14px',
          background: 'transparent',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          gap: 12,
          textAlign: 'left',
          opacity: disabled ? 0.5 : 1,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            background: 'linear-gradient(135deg, #007aff, #5ac8fa)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 14,
          }}
        >
          🌐
        </div>
        <span style={{ flex: 1, fontSize: 15, color: '#1c1c1e' }}>
          {showLabel ? t('language.title') : getLanguageName(language)}
        </span>
        <span style={{ fontSize: 14, color: '#aeaeb2', marginRight: 4 }}>
          {getLanguageFlag(language)} {getLanguageName(language)}
        </span>
        <svg width="6" height="11" viewBox="0 0 7 12" fill="none">
          <path
            d="M1 1l5 5-5 5"
            stroke="#c7c7cc"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 16,
            right: 16,
            zIndex: 100,
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            animation: 'fade-up 0.2s ease',
          }}
        >
          <style>{`
            @keyframes fade-up {
              from { opacity: 0; transform: translateY(-8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          {AVAILABLE_LANGUAGES.map((lang, index) => {
            const isSelected = lang.code === language;
            return (
              <button
                key={lang.code}
                onClick={() => {
                  setLanguage(lang.code);
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: isSelected ? 'rgba(0,122,255,0.06)' : 'transparent',
                  border: 'none',
                  borderBottom: index < AVAILABLE_LANGUAGES.length - 1 ? '1px solid rgba(60,60,67,0.08)' : 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 18 }}>{lang.flag}</span>
                <span
                  style={{
                    flex: 1,
                    fontSize: 15,
                    color: isSelected ? '#007aff' : '#1c1c1e',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {lang.nativeName}
                </span>
                {isSelected && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Sheet variant - for mobile modal
interface LanguageSheetProps {
  open: boolean;
  onClose: () => void;
}

export function LanguageSheet({ open, onClose }: LanguageSheetProps) {
  const { language, setLanguage, getLanguageName, t } = useLanguage();

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          animation: 'bd-in 0.25s ease',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 400,
          maxHeight: '70dvh',
          display: 'flex',
          flexDirection: 'column',
          background: '#f2f2f7',
          borderRadius: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
          animation: 'pop-in 0.28s cubic-bezier(0.32,0.72,0,1)',
          overflow: 'hidden',
        }}
      >
        <style>{`
          @keyframes bd-in { from { opacity: 0; } to { opacity: 1; } }
          @keyframes pop-in { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
        `}</style>
        
        {/* Header */}
        <div
          style={{
            flexShrink: 0,
            padding: '16px 20px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '0.5px solid rgba(60,60,67,0.14)',
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 600, color: '#1c1c1e', letterSpacing: -0.4 }}>
            {t('language.selectLanguage')}
          </span>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'rgba(116,116,128,0.12)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3c3c43',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Language List */}
        <div style={{ overflowY: 'auto', flex: 1, background: '#fff' }}>
          {AVAILABLE_LANGUAGES.map((lang, index) => {
            const isSelected = lang.code === language;
            return (
              <button
                key={lang.code}
                onClick={() => {
                  setLanguage(lang.code);
                  onClose();
                }}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '14px 20px',
                  borderBottom: index < AVAILABLE_LANGUAGES.length - 1 ? '1px solid rgba(60,60,67,0.08)' : 'none',
                  gap: 14,
                }}
              >
                <span style={{ fontSize: 24 }}>{lang.flag}</span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <p
                    style={{
                      fontSize: 16,
                      color: '#1c1c1e',
                      fontWeight: isSelected ? 600 : 400,
                      margin: 0,
                    }}
                  >
                    {lang.nativeName}
                  </p>
                  <p style={{ fontSize: 13, color: '#6e6e73', margin: '2px 0 0 0' }}>{lang.name}</p>
                </div>
                {isSelected && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Compact variant - for navbar/header
export function LanguageSelectorCompact() {
  const { language, setLanguage, getLanguageFlag } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'rgba(0,0,0,0.05)',
          border: 'none',
          cursor: 'pointer',
          fontSize: 18,
          transition: 'background 0.15s',
        }}
        title="Change Language"
      >
        {getLanguageFlag(language)}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 100,
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            minWidth: 140,
            animation: 'fade-up 0.2s ease',
          }}
        >
          <style>{`
            @keyframes fade-up {
              from { opacity: 0; transform: translateY(-8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          {AVAILABLE_LANGUAGES.map((lang) => {
            const isSelected = lang.code === language;
            return (
              <button
                key={lang.code}
                onClick={() => {
                  setLanguage(lang.code);
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: isSelected ? 'rgba(0,122,255,0.06)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 16 }}>{lang.flag}</span>
                <span
                  style={{
                    fontSize: 14,
                    color: isSelected ? '#007aff' : '#1c1c1e',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {lang.code.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Main LanguageSelector component
export default function LanguageSelector({ variant = 'row', ...props }: LanguageSelectorProps) {
  switch (variant) {
    case 'sheet':
      return null; // Sheet is used as a modal, not a standalone component
    case 'dropdown':
      return <LanguageSelectorCompact />;
    case 'row':
    default:
      return <LanguageSelectorRow {...props} />;
  }
}