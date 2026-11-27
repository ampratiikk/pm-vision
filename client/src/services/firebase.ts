import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  Auth,
  User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Firestore
} from 'firebase/firestore';
import type { CandleColorSettings, IndicatorConfig } from '../components/chart';
import type { WatchlistSegment } from '../components/dashboard';

export interface UserCloudSettings {
  indicators?: IndicatorConfig[];
  candleColors?: CandleColorSettings;
  paneSeparatorColor?: string;
  pinnedTimeframes?: string[];
  highlightSymbols?: string[];
  defaultWatchlist?: WatchlistSegment;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
  } catch (err) {
    console.warn('[Firebase] Initialization skipped:', err);
  }
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle(): Promise<User | null> {
  if (!auth || !googleProvider) {
    throw new Error('Firebase is not configured. Add VITE_FIREBASE_* environment variables.');
  }
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

export async function loadUserCloudSettings(uid: string): Promise<UserCloudSettings | null> {
  if (!db || !uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data() as UserCloudSettings;
  } catch (err) {
    console.warn('[Firebase] Failed to load cloud settings:', err);
    return null;
  }
}

export async function saveUserCloudSettings(
  uid: string,
  settings: Partial<UserCloudSettings>
): Promise<void> {
  if (!db || !uid) return;
  try {
    await setDoc(
      doc(db, 'users', uid),
      {
        ...settings,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Firebase] Failed to save cloud settings:', err);
  }
}
