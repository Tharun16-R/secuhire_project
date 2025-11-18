// Firebase initialization for SecuHire frontend
// Reads public config from environment variables defined in frontend/.env or .env.local

import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Guard against missing config during dev
if (!firebaseConfig.apiKey || !firebaseConfig.storageBucket) {
  // eslint-disable-next-line no-console
  console.warn(
    "Firebase config missing. Set REACT_APP_FIREBASE_* variables in frontend/.env.local",
  );
}

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
export let analytics = null;

// Initialize Analytics only when measurement ID is set and supported (browser only)
const measurementId = process.env.REACT_APP_FIREBASE_MEASUREMENT_ID;
if (measurementId && typeof window !== "undefined") {
  // Analytics requires a browser environment and secure context.
  // Wrap in a feature check to avoid errors in unsupported environments.
  isSupported()
    .then((supported) => {
      if (supported) {
        try {
          analytics = getAnalytics(app);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("Firebase Analytics init skipped:", e?.message || e);
        }
      }
    })
    .catch(() => {
      // ignore unsupported
    });
}
export default app;
