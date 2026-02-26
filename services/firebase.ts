
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD16tV2Cv8Ue9CxmuAocKNYkqeb3dHlRdI",
  authDomain: "workshop-17f65.firebaseapp.com",
  projectId: "workshop-17f65",
  storageBucket: "workshop-17f65.firebasestorage.app",
  messagingSenderId: "20936146278",
  appId: "1:20936146278:web:27a984be978f5f4deb5ca7",
  measurementId: "G-HLM2JNYW8P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, analytics, db, auth, storage };
