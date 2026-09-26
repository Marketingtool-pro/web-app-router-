import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';

// Firebase web config comes from the environment (see env.template), the same
// VITE_APP_FIREBASE_* variables used by src/utils/auth-client/firebase.js.
// Keeping it out of source means it can be rotated per environment.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_APP_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_APP_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_APP_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_APP_FIREBASE_MEASUREMENT_ID
};

const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

const app = configured ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;
const analytics = app && typeof window !== 'undefined' && firebaseConfig.measurementId ? getAnalytics(app) : null;

export { app, analytics };
