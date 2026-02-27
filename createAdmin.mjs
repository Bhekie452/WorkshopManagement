// Create System Admin user
// Run with: node createAdmin.mjs

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBqRlctfvzQpe9Qy5-hzbW2kWzb2NH-ev4",
  authDomain: "workshop-d1832.firebaseapp.com",
  projectId: "workshop-d1832",
  storageBucket: "workshop-d1832.firebasestorage.app",
  messagingSenderId: "1087918767180",
  appId: "1:1087918767180:web:624de8b54d2fe079d988e9",
  measurementId: "G-77DD2YWH43"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function createSystemAdmin() {
  const email = 'admin@workshop.com';
  const password = 'admin123';
  const name = 'System Administrator';
  
  let uid = '';
  
  console.log(`Starting System Admin creation for ${email}...`);

  try {
    // 1. Try to create user in Firebase Auth
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      uid = userCredential.user.uid;
      console.log('Firebase Auth account created.');
      
      // Update profile with display name
      await updateProfile(userCredential.user, { displayName: name });
    } catch (authError) {
      if (authError.code === 'auth/email-already-in-use') {
        console.log('Auth account already exists. Attempting to sign in to retrieve UID...');
        // 2. If user exists, try to sign in to get their UID
        const signInCredential = await signInWithEmailAndPassword(auth, email, password);
        uid = signInCredential.user.uid;
        console.log('Successfully signed in. retrieved UID:', uid);
      } else {
        throw authError;
      }
    }
    
    // 3. Create/Update user document in Firestore with SYSTEM_ADMIN role
    const userRef = doc(db, 'users', uid);
    const userData = {
      email: email,
      name: name,
      role: 'SYSTEM_ADMIN',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ef4444&color=fff`,
      updatedAt: new Date().toISOString(),
      permissions: ['all'] // Keep for compatibility, though app uses role-based constants
    };

    // Check if document exists to preserve createdAt if needed
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) {
      userData.createdAt = new Date().toISOString();
    }

    await setDoc(userRef, userData, { merge: true });
    
    console.log('\n--- SUCCESS ---');
    console.log('System Admin record ensured in Firestore!');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('UID:', uid);
    console.log('Role: SYSTEM_ADMIN');
    console.log('----------------\n');
    console.log('You can now log in to the application with these credentials.');

  } catch (error) {
    console.error('\n--- ERROR ---');
    console.error('Failed to ensure System Admin:', error.message);
    if (error.code === 'auth/wrong-password') {
      console.error('The account exists but the password you provided does not match.');
      console.error('Please update the "password" variable in this script to match the existing account password.');
    }
    console.error('-------------\n');
  }
  process.exit(0);
}

createSystemAdmin();
