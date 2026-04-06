// lib/firebaseRepository.ts
// Mirrors: FirebaseRepository.kt

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, query,
  collection, where, getDocs, serverTimestamp, Firestore,
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

export interface RegistrationConfig {
  registrationUrl: string;
  whatsappHelpUrl: string;
}

export interface WhitelistUser {
  id:        string;
  email:     string;
  name:      string;
  userId:    string;
  deviceId:  string;
  isActive:  boolean;
  createdAt: number;
  lastLogin: number;
  addedBy:   string;
}

const DEFAULT_CONFIG: RegistrationConfig = {
  registrationUrl: 'https://stockity.id/registered?a=25db72fbbc00',
  whatsappHelpUrl: 'https://wa.me/6285959860015',
};

export async function getRegistrationConfig(): Promise<RegistrationConfig> {
  try {
    const snap = await getDoc(doc(getDb(), 'config', 'registration'));
    if (snap.exists()) {
      const d = snap.data();
      return {
        registrationUrl: d.registrationUrl ?? DEFAULT_CONFIG.registrationUrl,
        whatsappHelpUrl: d.whatsappHelpUrl  ?? DEFAULT_CONFIG.whatsappHelpUrl,
      };
    }
  } catch {}

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

export async function getWhitelistUserByEmail(email: string): Promise<WhitelistUser | null> {
  try {
    const q    = query(collection(getDb(), 'whitelist'), where('email', '==', email.toLowerCase().trim()));
    const snap = await getDocs(q);
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() } as WhitelistUser;
  } catch (e) { console.error('[Firebase] getWhitelistUserByEmail:', e); }
  return null;
}

export async function getWhitelistUserByUserId(userId: string): Promise<WhitelistUser | null> {
  try {
    const q    = query(collection(getDb(), 'whitelist'), where('userId', '==', userId));
    const snap = await getDocs(q);
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() } as WhitelistUser;
  } catch (e) { console.error('[Firebase] getWhitelistUserByUserId:', e); }
  return null;
}

export async function updateLastLogin(userId: string): Promise<void> {
  try {
    const q    = query(collection(getDb(), 'whitelist'), where('userId', '==', userId));
    const snap = await getDocs(q);
    if (!snap.empty) await updateDoc(snap.docs[0].ref, { lastLogin: Date.now(), updatedAt: serverTimestamp() });
  } catch (e) { console.error('[Firebase] updateLastLogin:', e); }
}

export async function addWhitelistUser(user: Omit<WhitelistUser, 'id'>, addedBy = 'web_registration'): Promise<string> {
  const ref = doc(collection(getDb(), 'whitelist'));
  await setDoc(ref, { ...user, addedBy, createdAt: user.createdAt || Date.now(), lastLogin: user.lastLogin || Date.now(), serverTimestamp: serverTimestamp() });
  return ref.id;
}