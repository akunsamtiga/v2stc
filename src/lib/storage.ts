// lib/storage.ts
// ✅ FIXED — Port 1:1 dari SessionManager.kt
//
// PERUBAHAN dari versi lama:
//   1. Tambah SESSION_KEYS — semua key sama dengan Kotlin SessionManager constant
//   2. Tambah saveUserSession() — mirrors SessionManager.saveUserSession()
//   3. Tambah getUserSession() — mirrors SessionManager.getUserSession()
//   4. Tambah saveCurrencyWithIso() — mirrors SessionManager.saveCurrencyWithIso()
//   5. Tambah logout() — mirrors SessionManager.logout() (clear semua key)

'use client';

// ── Session key constants — harus identik dengan Kotlin SessionManager ────────
// Kotlin: PREF_NAME = "trading_session"
// Keys:
export const SESSION_KEYS = {
  AUTHTOKEN:     'stc_token',          // KEY_AUTHTOKEN
  USER_ID:       'stc_user_id',        // KEY_USER_ID        ✅ FIXED: was missing
  DEVICE_ID:     'stc_device_id',      // KEY_DEVICE_ID
  EMAIL:         'stc_email',          // KEY_EMAIL           ✅ FIXED: was missing
  USER_TIMEZONE: 'stc_timezone',       // KEY_USER_TIMEZONE   ✅ FIXED: was missing
  USER_AGENT:    'stc_user_agent',     // KEY_USER_AGENT      ✅ FIXED: was missing
  DEVICE_TYPE:   'stc_device_type',    // KEY_DEVICE_TYPE     ✅ FIXED: was missing
  CURRENCY:      'stc_currency',       // KEY_CURRENCY
  CURRENCY_ISO:  'stc_currency_iso',   // KEY_CURRENCY_ISO    ✅ FIXED: was missing
  IS_LOGGED_IN:  'stc_is_logged_in',   // KEY_IS_LOGGED_IN    ✅ FIXED: was missing
} as const;

// ── UserSession type — mirrors UserSession.kt ─────────────────────────────────
export interface UserSession {
  authtoken:     string;
  userId:        string;
  deviceId:      string;
  email:         string;
  userTimezone:  string;
  userAgent:     string;
  deviceType:    string;
  currency:      string;
  currencyIso:   string;
}

// ── Raw storage get/set/remove ────────────────────────────────────────────────

async function storageGet(key: string): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key });
      return value;
    }
  } catch {}
  return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
}

async function storageSet(key: string, value: string): Promise<void> {
  try {
    if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key, value });
      return;
    }
  } catch {}
  if (typeof window !== 'undefined') localStorage.setItem(key, value);
}

async function storageRemove(key: string): Promise<void> {
  try {
    if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key });
      return;
    }
  } catch {}
  if (typeof window !== 'undefined') localStorage.removeItem(key);
}

// ── Exported storage object (backward compatible) ─────────────────────────────
export const storage = {
  get:    storageGet,
  set:    storageSet,
  remove: storageRemove,
};

// ── saveUserSession ───────────────────────────────────────────────────────────
// Mirrors: SessionManager.saveUserSession()
// ✅ FIXED: versi lama hanya set 2 key (stc_token, stc_device_id)
//           Kotlin menyimpan semua field UserSession
export async function saveUserSession(session: UserSession): Promise<void> {
  await storageSet(SESSION_KEYS.AUTHTOKEN,     session.authtoken);
  await storageSet(SESSION_KEYS.USER_ID,       session.userId);
  await storageSet(SESSION_KEYS.DEVICE_ID,     session.deviceId);
  await storageSet(SESSION_KEYS.EMAIL,         session.email);
  await storageSet(SESSION_KEYS.USER_TIMEZONE, session.userTimezone);
  await storageSet(SESSION_KEYS.USER_AGENT,    session.userAgent);
  await storageSet(SESSION_KEYS.DEVICE_TYPE,   session.deviceType);
  await storageSet(SESSION_KEYS.CURRENCY,      session.currency);
  await storageSet(SESSION_KEYS.CURRENCY_ISO,  session.currencyIso);
  await storageSet(SESSION_KEYS.IS_LOGGED_IN,  'true');
}

// ── getUserSession ────────────────────────────────────────────────────────────
// Mirrors: SessionManager.getUserSession()
export async function getUserSession(): Promise<UserSession | null> {
  const isLoggedIn = await storageGet(SESSION_KEYS.IS_LOGGED_IN);
  if (isLoggedIn !== 'true') return null;

  return {
    authtoken:    (await storageGet(SESSION_KEYS.AUTHTOKEN))     ?? '',
    userId:       (await storageGet(SESSION_KEYS.USER_ID))       ?? '',
    deviceId:     (await storageGet(SESSION_KEYS.DEVICE_ID))     ?? '',
    email:        (await storageGet(SESSION_KEYS.EMAIL))         ?? '',
    userTimezone: (await storageGet(SESSION_KEYS.USER_TIMEZONE)) ?? 'Asia/Bangkok',
    userAgent:    (await storageGet(SESSION_KEYS.USER_AGENT))    ?? '',
    deviceType:   (await storageGet(SESSION_KEYS.DEVICE_TYPE))   ?? 'web',
    currency:     (await storageGet(SESSION_KEYS.CURRENCY))      ?? 'IDR',
    currencyIso:  (await storageGet(SESSION_KEYS.CURRENCY_ISO))  ?? 'IDR',
  };
}

// ── saveCurrencyWithIso ───────────────────────────────────────────────────────
// Mirrors: SessionManager.saveCurrencyWithIso()
// ✅ FIXED: versi lama tidak ada — Kotlin simpan currency code + unit symbol "Rp"
export async function saveCurrencyWithIso(currency: string, iso: string): Promise<void> {
  await storageSet(SESSION_KEYS.CURRENCY,     currency);
  await storageSet(SESSION_KEYS.CURRENCY_ISO, iso);
}

// ── logout ────────────────────────────────────────────────────────────────────
// Mirrors: SessionManager.logout()
// Bersihkan semua session keys
export async function sessionLogout(): Promise<void> {
  for (const key of Object.values(SESSION_KEYS)) {
    await storageRemove(key);
  }
}