import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Intercept transient Firestore connection retry warnings so they do not trigger false fatal error alerts
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('@firebase/firestore') &&
    (args[0].includes('Could not reach Cloud Firestore backend') ||
      args[0].includes('code=unavailable'))
  ) {
    console.warn('[Firestore Transport Notice]:', ...args);
    return;
  }
  originalConsoleError.apply(console, args);
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with experimentalForceLongPolling to reliably connect within browser iframes & Cloud Run
export const db = initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId
);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export default app;
