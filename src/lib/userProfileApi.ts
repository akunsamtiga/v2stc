// lib/userProfileApi.ts
// ✅ FIXED — Port 1:1 dari UserProfileApiService.kt + CurrencyRepository.kt
//
// PERUBAHAN dari versi lama:
//   1. fetchUserCurrency() — ✅ BARU: mirrors CurrencyRepository.fetchUserCurrency()
//      - Mengembalikan { currency: string, currencyIso: string }
//      - currency = kode ISO (contoh: "IDR")
//      - currencyIso = unit/simbol (contoh: "Rp") — dari list[].unit
//      - Kotlin menyimpan KEDUANYA, versi lama hanya menyimpan kode

const STOCKITY_BASE_URL =
  process.env.NEXT_PUBLIC_STOCKITY_API_URL ?? 'https://api.stockity.id/';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id:        number;
  email:     string;
  firstName: string;
  lastName:  string;
  username?: string;
  nickname?: string;
  phone?:    string;
  gender?:   string;
  country?:  string;
  birthday?: string;
  registeredAt?: string;
  avatar?:   string;
}

export interface UserProfileResponse {
  data: UserProfile | null;
}

export interface LoginRequest {
  email:    string;
  password: string;
}

export interface LoginResponse {
  data?: {
    authorizationToken?: string;
    accessToken?:        string;
    deviceId?:           string;
    userId?:             string | number;
  };
}

// ── CurrencyItem — mirrors data class Currency di Kotlin ─────────────────────
interface CurrencyItem {
  iso:    string;  // contoh: "IDR"
  unit:   string;  // contoh: "Rp"
  name?:  string;
}

// ── CurrencyData — mirrors response dari /currency/v1/user_currency ──────────
interface CurrencyData {
  current: string;           // kode aktif, contoh: "IDR"
  list:    CurrencyItem[];   // daftar semua currency
}

interface CurrencyResponse {
  data?: CurrencyData;
}

// ── FetchedCurrency — return type saveUserSession ────────────────────────────
export interface FetchedCurrency {
  currency:    string;  // kode: "IDR"
  currencyIso: string;  // unit: "Rp"
}

/** Mirrors: userProfile.getFullName() di Kotlin */
export function getFullName(p: UserProfile): string {
  const full = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
  return full || p.nickname || p.username || p.email;
}

// ── buildStockityHeaders — header yang sama untuk semua request Stockity ──────
function buildStockityHeaders(
  authToken: string,
  deviceId:  string,
  extra:     Record<string, string> = {},
): Record<string, string> {
  return {
    'device-id':           deviceId,
    'device-type':         'web',
    'user-timezone':       'Asia/Bangkok',
    'authorization-token': authToken,
    'User-Agent':          USER_AGENT,
    'Accept':              'application/json, text/plain, */*',
    'Origin':              'https://stockity.id',
    'Referer':             'https://stockity.id/',
    ...extra,
  };
}

// ── fetchUserProfile ──────────────────────────────────────────────────────────
// Mirrors: UserProfileApiService.getUserProfile()
export async function fetchUserProfile(
  authToken: string,
  deviceId:  string,
  locale     = 'id',
): Promise<UserProfile> {
  const url = `${STOCKITY_BASE_URL}passport/v1/user_profile?locale=${locale}`;

  const res = await fetch(url, {
    method:  'GET',
    headers: buildStockityHeaders(authToken, deviceId),
  });

  if (!res.ok) {
    throw new Error(`Terjadi kesalahan saat memproses akun (${res.status})`);
  }

  const json: UserProfileResponse = await res.json();
  if (!json.data) {
    throw new Error('Terjadi kesalahan saat memproses akun (data kosong)');
  }

  return json.data;
}

// ── fetchUserCurrency ─────────────────────────────────────────────────────────
// ✅ BARU — Mirrors: CurrencyRepository.fetchUserCurrency()
//
// Kotlin:
//   val currencyData = currencyResult.getOrNull()
//   val currentCurrencyCode = currencyData?.current ?: "IDR"
//   val currentCurrency = currencyData?.list?.find { it.iso == currentCurrencyCode }
//   val unitSymbol = currentCurrency?.unit ?: "Rp"
//   userSession = userSession.copy(currency = currentCurrencyCode, currencyIso = unitSymbol)
//
// Jadi kita butuh KEDUANYA: kode ISO ("IDR") dan simbol unit ("Rp")
export async function fetchUserCurrency(
  authToken: string,
  deviceId:  string,
  locale     = 'id',
): Promise<FetchedCurrency> {
  try {
    const url = `${STOCKITY_BASE_URL}currency/v1/user_currency?locale=${locale}`;

    const res = await fetch(url, {
      method:  'GET',
      headers: buildStockityHeaders(authToken, deviceId),
    });

    if (!res.ok) {
      console.warn('[Currency] fetch failed:', res.status);
      return { currency: 'IDR', currencyIso: 'Rp' };
    }

    const json: CurrencyResponse = await res.json();
    const data = json.data;

    if (!data) {
      return { currency: 'IDR', currencyIso: 'Rp' };
    }

    const currentCode   = data.current ?? 'IDR';
    const currentItem   = data.list?.find(c => c.iso === currentCode);
    const unitSymbol    = currentItem?.unit ?? 'Rp';

    return { currency: currentCode, currencyIso: unitSymbol };
  } catch (e) {
    console.warn('[Currency] fetchUserCurrency error:', e);
    return { currency: 'IDR', currencyIso: 'Rp' };
  }
}

// ── loginToStockity ───────────────────────────────────────────────────────────
// Mirrors: LoginApiService.login()
export async function loginToStockity(
  email:    string,
  password: string,
  deviceId: string,
  locale    = 'id',
): Promise<{ authToken: string; deviceId: string }> {
  const url = `${STOCKITY_BASE_URL}passport/v2/sign_in?locale=${locale}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'device-id':    deviceId,
      'device-type':  'web',
      'user-timezone':'Asia/Bangkok',
      'User-Agent':   USER_AGENT,
      'Accept':       'application/json',
      'Content-Type': 'application/json',
      'Origin':       'https://stockity.id',
      'Referer':      'https://stockity.id/',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      throw new Error('Email atau password salah untuk akun Stockity');
    if (res.status === 423)
      throw new Error('Akun Stockity diblokir');
    if (res.status >= 500)
      throw new Error('Server Stockity error');
    throw new Error(`Login gagal (${res.status})`);
  }

  const json: LoginResponse = await res.json();
  const token    = json.data?.authorizationToken ?? json.data?.accessToken ?? '';
  const retDevId = json.data?.deviceId ?? deviceId;

  if (!token) throw new Error('Token tidak ditemukan dalam response login');

  return { authToken: token, deviceId: retDevId };
}