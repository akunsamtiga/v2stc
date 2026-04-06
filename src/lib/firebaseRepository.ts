// lib/firebaseRepository.ts
// ✅ FIXED — Port 1:1 dari FirebaseRepository.kt
//
// PERUBAHAN dari versi lama:
//   1. Collection names: 'whitelist_users' (bukan 'whitelist'), 'app_config' (bukan 'config')
//   2. Config document ID: 'registration_config' (bukan 'registration')
//   3. Document ID whitelist: sanitizeDocId(userId) — sama persis dengan Kotlin
//   4. addWhitelistUser: cek duplikat dulu sebelum set() — mirror Kotlin
//   5. WhitelistUser fields: tambah addedAt, fcmToken, fcmTokenUpdatedAt
//   6. updateLastLogin: query by userId field, update field 'lastLogin' langsung

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  collection,
  where,
  getDocs,
  serverTimestamp,
  Firestore,
  limit,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { getRemoteConfig, fetchAndActivate, getValue, RemoteConfig } from 'firebase/remote-config';

const FIREBASE_CONFIG = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// ── Collection names — HARUS sama dengan Kotlin FirebaseRepository.kt ─────────
// Kotlin: whitelist_users, app_config, admin_users
const COLLECTION_WHITELIST = 'whitelist_users';  // ✅ FIXED: was 'whitelist'
const COLLECTION_CONFIG    = 'app_config';        // ✅ FIXED: was 'config'
const COLLECTION_ADMIN     = 'admin_users';
const CONFIG_DOC_ID        = 'registration_config'; // ✅ FIXED: was 'registration'

let app: FirebaseApp;
let db: Firestore;
let remoteConfig: RemoteConfig | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!app) app = getApps().length > 0 ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
  return app;
}

function getDb(): Firestore {
  if (!db) db = getFirestore(getFirebaseApp());
  return db;
}

async function getRemoteCfg(): Promise<RemoteConfig> {
  if (!remoteConfig) {
    remoteConfig = getRemoteConfig(getFirebaseApp());
    remoteConfig.settings.minimumFetchIntervalMillis = 3_600_000;
    await fetchAndActivate(remoteConfig).catch(() => {});
  }
  return remoteConfig;
}

// ── sanitizeDocId — HARUS identik dengan Kotlin: ─────────────────────────────
// Kotlin: userId.replace(Regex("[^a-zA-Z0-9_-]"), "_")
// ✅ FIXED: versi lama tidak ada fungsi ini → doc ID acak → tidak konsisten
export function sanitizeDocId(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RegistrationConfig {
  registrationUrl: string;
  whatsappHelpUrl: string;
}

export interface WhitelistUser {
  id:                 string;
  email:              string;
  name:               string;
  userId:             string;
  deviceId:           string;
  isActive:           boolean;
  createdAt:          number;
  lastLogin:          number;
  addedBy:            string;
  addedAt:            number;    // ✅ FIXED: field ini ada di Kotlin tapi missing di TS lama
  fcmToken:           string;    // ✅ FIXED: field ini ada di Kotlin tapi missing di TS lama
  fcmTokenUpdatedAt:  number;    // ✅ FIXED: field ini ada di Kotlin tapi missing di TS lama
}

const DEFAULT_CONFIG: RegistrationConfig = {
  registrationUrl: 'https://stockity.id/registered?a=25db72fbbc00',
  whatsappHelpUrl: 'https://wa.me/6285959860015',
};

// ── getRegistrationConfig ─────────────────────────────────────────────────────
// Mirrors: FirebaseRepository.getRegistrationConfig()
// Collection: app_config / document: registration_config
export async function getRegistrationConfig(): Promise<RegistrationConfig> {
  try {
    const snap = await getDoc(doc(getDb(), COLLECTION_CONFIG, CONFIG_DOC_ID));
    if (snap.exists()) {
      const d = snap.data();
      return {
        registrationUrl: d.registrationUrl ?? DEFAULT_CONFIG.registrationUrl,
        whatsappHelpUrl: d.whatsappHelpUrl  ?? DEFAULT_CONFIG.whatsappHelpUrl,
      };
    }
  } catch (e) {
    console.error('[Firebase] getRegistrationConfig Firestore error:', e);
  }

  // Fallback ke Remote Config
  try {
    const rc = await getRemoteCfg();
    const regUrl = getValue(rc, 'registration_url').asString();
    const waUrl  = getValue(rc, 'whatsapp_help_url').asString();
    if (regUrl || waUrl) return {
      registrationUrl: regUrl || DEFAULT_CONFIG.registrationUrl,
      whatsappHelpUrl: waUrl  || DEFAULT_CONFIG.whatsappHelpUrl,
    };
  } catch {}

  return DEFAULT_CONFIG;
}

// ── getWhitelistUserByEmail ───────────────────────────────────────────────────
// Mirrors: FirebaseRepository.getWhitelistUserByEmail()
// Collection: whitelist_users
export async function getWhitelistUserByEmail(email: string): Promise<WhitelistUser | null> {
  try {
    const q    = query(
      collection(getDb(), COLLECTION_WHITELIST),
      where('email', '==', email.toLowerCase().trim()),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() } as WhitelistUser;
  } catch (e) { console.error('[Firebase] getWhitelistUserByEmail:', e); }
  return null;
}

// ── getWhitelistUserByUserId ──────────────────────────────────────────────────
// Mirrors: FirebaseRepository.getWhitelistUserByUserId()
export async function getWhitelistUserByUserId(userId: string): Promise<WhitelistUser | null> {
  try {
    const q    = query(
      collection(getDb(), COLLECTION_WHITELIST),
      where('userId', '==', userId),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() } as WhitelistUser;
  } catch (e) { console.error('[Firebase] getWhitelistUserByUserId:', e); }
  return null;
}

// ── updateLastLogin ───────────────────────────────────────────────────────────
// Mirrors: FirebaseRepository.updateLastLogin()
// Query by field userId, update field lastLogin
export async function updateLastLogin(userId: string): Promise<void> {
  try {
    const q    = query(
      collection(getDb(), COLLECTION_WHITELIST),
      where('userId', '==', userId),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      await updateDoc(snap.docs[0].ref, {
        lastLogin: Date.now(),
        updatedAt: serverTimestamp(),
      });
    } else {
      console.warn('[Firebase] updateLastLogin: user not found for userId=', userId);
    }
  } catch (e) { console.error('[Firebase] updateLastLogin:', e); }
}

// ── addWhitelistUser ──────────────────────────────────────────────────────────
// ✅ FIXED — Port 1:1 dari FirebaseRepository.addWhitelistUser()
//
// PERUBAHAN KRITIS:
//   1. Document ID = sanitizeDocId(user.userId) — bukan random UUID
//   2. Cek duplikat via getDoc() sebelum set() — throw jika sudah ada
//   3. Semua field disertakan termasuk addedAt, fcmToken, fcmTokenUpdatedAt
export async function addWhitelistUser(
  user: Omit<WhitelistUser, 'id'>,
  addedBy = 'web_registration'
): Promise<string> {
  if (!user.userId) {
    throw new Error('userId tidak boleh kosong');
  }

  // ✅ FIXED: Gunakan sanitizeDocId — sama dengan Kotlin
  const docId = sanitizeDocId(user.userId);

  // ✅ FIXED: Cek duplikat dulu — sama dengan Kotlin
  const existingDoc = await getDoc(doc(getDb(), COLLECTION_WHITELIST, docId));
  if (existingDoc.exists()) {
    throw new Error(`User dengan ID "${user.userId}" sudah terdaftar`);
  }

  const now = Date.now();

  // ✅ FIXED: Semua field sama persis dengan Kotlin addWhitelistUser()
  const userData = {
    id:                docId,
    email:             user.email,
    name:              user.name,
    userId:            user.userId,
    deviceId:          user.deviceId ?? '',
    isActive:          true,
    createdAt:         user.createdAt || now,
    lastLogin:         user.lastLogin || now,
    addedBy:           addedBy,
    addedAt:           now,           // ✅ FIXED: was missing
    fcmToken:          '',            // ✅ FIXED: was missing
    fcmTokenUpdatedAt: 0,             // ✅ FIXED: was missing
  };

  await setDoc(doc(getDb(), COLLECTION_WHITELIST, docId), userData);
  return docId;
}

// ── checkIsAdmin ──────────────────────────────────────────────────────────────
// Mirrors: FirebaseRepository.checkIsAdmin()
// Collection: admin_users
export async function checkIsAdmin(email: string): Promise<boolean> {
  try {
    const q = query(
      collection(getDb(), COLLECTION_ADMIN),
      where('email', '==', email),
      where('isActive', '==', true),
      limit(1)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  } catch (e) {
    console.error('[Firebase] checkIsAdmin:', e);
    return false;
  }
}