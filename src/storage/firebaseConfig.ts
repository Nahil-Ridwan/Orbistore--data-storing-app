import { getApps, initializeApp } from 'firebase/app';
import { Firestore, getFirestore, initializeFirestore } from 'firebase/firestore';

// Replace with the config from your Firebase project:
// Firebase console -> Project settings -> General -> Your apps -> SDK setup and configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

// initializeApp throws "duplicate-app" if called more than once (e.g. on
// Fast Refresh, or if this module gets re-imported/re-evaluated). Reuse
// the existing app instance if one already exists instead of creating a
// new one.
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// ignoreUndefinedProperties: Firestore normally THROWS if you try to
// setDoc/updateDoc an object containing an `undefined` field (e.g. an
// optional Entry field like `validity` or `expdate` that hasn't been
// computed yet). Since several of your Entry fields are legitimately
// optional/undefined depending on what the user has filled in, this
// setting tells Firestore to just drop those fields instead of erroring.
//
// initializeFirestore also throws if called more than once for the same
// app (same root cause as duplicate-app above), so fall back to
// getFirestore if a Firestore instance is already running.
let db: Firestore;
try {
  db = initializeFirestore(app, { ignoreUndefinedProperties: true });
} catch {
  db = getFirestore(app);
}

export { db };

