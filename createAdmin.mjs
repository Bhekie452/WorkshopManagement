// Create System Admin user
// Run with: node createAdmin.mjs

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';

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
  
  try {
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Update profile with display name
    await updateProfile(user, { displayName: name });
    
    // Create user document in Firestore with SYSTEM_ADMIN role
    await setDoc(doc(db, 'users', user.uid), {
      email: email,
      name: name,
      role: 'SYSTEM_ADMIN',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ef4444&color=fff`,
      createdAt: new Date().toISOString(),
      permissions: ['all']
    });
    
    console.log('System Admin created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('UID:', user.uid);
    console.log('Role: SYSTEM_ADMIN');
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('Admin user already exists. Updating role to SYSTEM_ADMIN...');
      // If user exists, we need to get their UID and update Firestore
      console.log('Please sign in to the app with admin@workshop.com and the system will recognize the SYSTEM_ADMIN role once we update the database.');
    } else {
      console.error('Error creating admin:', error.message);
    }
  }
  process.exit(0);
}

createSystemAdmin();
