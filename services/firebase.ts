
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBqRlctfvzQpe9Qy5-hzbW2kWzb2NH-ev4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "workshop-d1832.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "workshop-d1832",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "workshop-d1832.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1087918767180",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1087918767180:web:624de8b54d2fe079d988e9",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-77DD2YWH43"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, analytics, db, auth, storage };
