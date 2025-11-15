import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Firebase configuration - these will be set via environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'AIzaSyAjR4FjfFoDPQVf6q09oWEPZN_Mto3Gg1Y',
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'tconnect-store-9893e.firebaseapp.com',
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || 'tconnect-store-9893e',
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'tconnect-store-9893e.firebasestorage.app',
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '708789106974',
  appId: process.env.REACT_APP_FIREBASE_APP_ID || '1:708789106974:web:04ede5bded3a2f22bfb10f'
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Log Firebase config for debugging (without sensitive data)
if (process.env.NODE_ENV === 'development') {
  console.log('🔥 Firebase initialized:', {
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : 'missing'
  });
}

export default app;

