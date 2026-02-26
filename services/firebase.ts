
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBqRlctfvzQpe9Qy5-hzbW2kWzb2NH-ev4",
  authDomain: "workshop-d1832.firebaseapp.com",
  projectId: "workshop-d1832",
  storageBucket: "workshop-d1832.firebasestorage.app",
  messagingSenderId: "1087918767180",
  appId: "1:1087918767180:web:624de8b54d2fe079d988e9",
  measurementId: "G-77DD2YWH43"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, analytics, db, auth, storage };
