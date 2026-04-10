'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Language, Translations, getTranslation } from './translations';
export type { Language };

// Storage key for language preference
const LANGUAGE_STORAGE_KEY = 'stc_language';

// Default language
const DEFAULT_LANGUAGE: Language = 'id';

// Available languages
export const AVAILABLE_LANGUAGES: { code: Language; name: string; flag: string; flagImg: string; nativeName: string }[] = [
  { code: 'en', name: 'English',    flag: '🇬🇧', flagImg: 'https://flagcdn.com/w20/gb.png', nativeName: 'English'        },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩', flagImg: 'https://flagcdn.com/w20/id.png', nativeName: 'Indonesia'      },
  { code: 'ru', name: 'Russian',    flag: '🇷🇺', flagImg: 'https://flagcdn.com/w20/ru.png', nativeName: 'Русский'        },
  { code: 'es', name: 'Spanish',    flag: '🇪🇸', flagImg: 'https://flagcdn.com/w20/es.png', nativeName: 'Español'        },
  { code: 'ms', name: 'Malay',      flag: '🇲🇾', flagImg: 'https://flagcdn.com/w20/my.png', nativeName: 'Bahasa Melayu' },
  { code: 'hi', name: 'Hindi',      flag: '🇮🇳', flagImg: 'https://flagcdn.com/w20/in.png', nativeName: 'हिन्दी'          },
  { code: 'th', name: 'Thai',       flag: '🇹🇭', flagImg: 'https://flagcdn.com/w20/th.png', nativeName: 'ภาษาไทย'        },
  { code: 'tr', name: 'Turkish',    flag: '🇹🇷', flagImg: 'https://flagcdn.com/w20/tr.png', nativeName: 'Türkçe'         },
];

// Detect if running on Windows (emoji flags not supported)
export function isWindows(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Win/i.test(navigator.platform || navigator.userAgent);
}

// Language Context Type
interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isLoading: boolean;
  availableLanguages: typeof AVAILABLE_LANGUAGES;
  getLanguageName: (code: Language) => string;
  getLanguageFlag: (code: Language) => string;
  getLanguageFlagImg: (code: Language) => string;
  formatNumber: (num: number) => string;
}

// Create Context
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Language Provider Props
interface LanguageProviderProps {
  children: ReactNode;
  defaultLanguage?: Language;
}

// Language Provider Component
export function LanguageProvider({ children, defaultLanguage = DEFAULT_LANGUAGE }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(defaultLanguage);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  // Detect client-side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load saved language preference
  useEffect(() => {
    if (!isClient) return;

    const loadLanguage = async () => {
      try {
        const validCodes = AVAILABLE_LANGUAGES.map(l => l.code);

        // Try to get from localStorage first
        const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (savedLanguage && validCodes.includes(savedLanguage as Language)) {
          setLanguageState(savedLanguage as Language);
        } else {
          // Try to detect browser language
          const browserLang = navigator.language.split('-')[0];
          if (validCodes.includes(browserLang as Language)) {
            setLanguageState(browserLang as Language);
          }
        }
      } catch (error) {
        console.warn('Failed to load language preference:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguage();
  }, [isClient]);

  // Set language and save to storage
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
        // Update html lang attribute
        document.documentElement.lang = lang;
      } catch (error) {
        console.warn('Failed to save language preference:', error);
      }
    }
  }, []);

  // Translation function
  const t = useCallback(
    (key: string): string => {
      return getTranslation(language, key);
    },
    [language]
  );

  // Get language name
  const getLanguageName = useCallback((code: Language): string => {
    const lang = AVAILABLE_LANGUAGES.find((l) => l.code === code);
    return lang?.nativeName || lang?.name || code;
  }, []);

  // Get language flag emoji
  const getLanguageFlag = useCallback((code: Language): string => {
    const lang = AVAILABLE_LANGUAGES.find((l) => l.code === code);
    return lang?.flag || '🌐';
  }, []);

  // Get language flag image URL
  const getLanguageFlagImg = useCallback((code: Language): string => {
    const lang = AVAILABLE_LANGUAGES.find((l) => l.code === code);
    return lang?.flagImg || '';
  }, []);

  // Format number based on current language
  const formatNumberFn = useCallback(
    (num: number): string => formatNumber(num, language),
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        isLoading,
        availableLanguages: AVAILABLE_LANGUAGES,
        getLanguageName,
        getLanguageFlag,
        getLanguageFlagImg,
        formatNumber: formatNumberFn,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

// Custom hook to use language context
export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// HOC to wrap components with language support
export function withLanguage<T extends object>(Component: React.ComponentType<T>) {
  return function WithLanguageComponent(props: T) {
    return (
      <LanguageProvider>
        <Component {...props} />
      </LanguageProvider>
    );
  };
}

// Utility to format numbers based on language
export function formatNumber(num: number, language: Language): string {
  const locales: Record<Language, string> = {
    en: 'en-US',
    id: 'id-ID',
    ru: 'ru-RU',
    es: 'es-ES',
    ms: 'ms-MY',
    hi: 'hi-IN',
    th: 'th-TH',
    tr: 'tr-TR',
  };
  return num.toLocaleString(locales[language]);
}

// Utility to format currency based on language
export function formatCurrency(amount: number, currency: string, language: Language): string {
  const locales: Record<Language, string> = {
    en: 'en-US',
    id: 'id-ID',
    ru: 'ru-RU',
    es: 'es-ES',
    ms: 'ms-MY',
    hi: 'hi-IN',
    th: 'th-TH',
    tr: 'tr-TR',
  };

  // Convert from cents to main currency unit
  const value = amount / 100;

  return new Intl.NumberFormat(locales[language], {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Utility to format date based on language
export function formatDate(date: Date | number, language: Language, options?: Intl.DateTimeFormatOptions): string {
  const locales: Record<Language, string> = {
    en: 'en-US',
    id: 'id-ID',
    ru: 'ru-RU',
    es: 'es-ES',
    ms: 'ms-MY',
    hi: 'hi-IN',
    th: 'th-TH',
    tr: 'tr-TR',
  };

  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  };

  return new Intl.DateTimeFormat(locales[language], options || defaultOptions).format(date);
}

// Utility to format time based on language
export function formatTime(date: Date | number, language: Language, options?: Intl.DateTimeFormatOptions): string {
  const locales: Record<Language, string> = {
    en: 'en-US',
    id: 'id-ID',
    ru: 'ru-RU',
    es: 'es-ES',
    ms: 'ms-MY',
    hi: 'hi-IN',
    th: 'th-TH',
    tr: 'tr-TR',
  };

  const defaultOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };

  return new Intl.DateTimeFormat(locales[language], options || defaultOptions).format(date);
}