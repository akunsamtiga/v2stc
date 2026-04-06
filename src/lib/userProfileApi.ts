// lib/userProfileApi.ts
// Mirrors: UserProfileApiService.kt — EXACT 1:1 header mapping

// ─── Base URL Stockity ────────────────────────────────────────────────────────
// Sama seperti Retrofit baseUrl di Kotlin — ganti sesuai konfigurasi Retrofit kamu
// Biasanya ada di NetworkModule.kt / AppModule.kt
const STOCKITY_BASE_URL =
  process.env.NEXT_PUBLIC_STOCKITY_API_URL ?? 'https://api.stockity.id/';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';

// ─── Types (mirrors LoginRequest, LoginResponse, UserProfileResponse) ─────────
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
  status?:  string | number;
  message?: string;
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
  status?:  string | number;
  message?: string;
}

/** Mirrors: userProfile.getFullName() di Kotlin */
export function getFullName(p: UserProfile): string {
  const full = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
  return full || p.nickname || p.username || p.email;
}

// ─── buildStockityHeaders — header yang sama untuk semua request Stockity ─────
function buildStockityHeaders(
  authToken: string,
  deviceId:  string,
  extra:     Record<string, string> = {},
): Record<string, string> {
  return {
    // ── Headers wajib dari UserProfileApiService.kt ──
    'device-id':           deviceId,
    'device-type':         'web',
    'user-timezone':       'Asia/Bangkok',
    'authorization-token': authToken,
    'User-Agent':          USER_AGENT,
    'Accept':              'application/json, text/plain, */*',
    'Origin':              'https://stockity.id',
    'Referer':             'https://stockity.id/',
    // ── Extra per-endpoint ──
    ...extra,
  };
}

// ─── fetchUserProfile ─────────────────────────────────────────────────────────
// Mirrors: UserProfileApiService.getUserProfile()
//   @GET("passport/v1/user_profile")
//   @Query("locale") locale = "id"
//   @Header("device-id") ...
//   @Header("authorization-token") ...
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

// ─── loginToStockity ──────────────────────────────────────────────────────────
// Mirrors: LoginApiService.login()
//   @POST("passport/v2/sign_in")
//   @Query("locale") locale = "id"
//   @Header("device-id") ...
//   (tidak pakai authorization-token — pre-login)
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

  if (!token)
    throw new Error('Token tidak ditemukan dalam response login');

  return { authToken: token, deviceId: retDevId };
}