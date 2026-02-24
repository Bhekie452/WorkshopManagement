/**
 * Firebase Configuration Test
 * 
 * This utility tests that all Firebase services are properly configured
 * Run this from the browser console or create a test page
 */

import { db, auth, storage } from './firebase';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';

export async function testFirebaseSetup() {
    const results = {
        firestore: false,
        storage: false,
        auth: false,
        overall: false
    };

    console.log('🧪 Testing Firebase Configuration...\n');

    // Test 1: Firestore
    try {
        console.log('1. Testing Firestore...');
        const testCollection = collection(db, 'test_collection');

        // Try to add a document
        const docRef = await addDoc(testCollection, {
            test: true,
            timestamp: new Date().toISOString()
        });
        console.log('  ✅ Write successful:', docRef.id);

        // Try to read documents
        const snapshot = await getDocs(testCollection);
        console.log(`  ✅ Read successful: ${snapshot.size} documents`);

        // Clean up
        await deleteDoc(doc(db, 'test_collection', docRef.id));
        console.log('  ✅ Delete successful\n');

        results.firestore = true;
    } catch (error: any) {
        console.error('  ❌ Firestore test failed:', error.message);
        console.error('  💡 Check Firestore security rules\n');
    }

    // Test 2: Storage
    try {
        console.log('2. Testing Storage...');
        const testRef = ref(storage, 'test/test.txt');

        // Try to upload
        await uploadString(testRef, 'Test file content');
        console.log('  ✅ Upload successful');

        // Try to get download URL
        const url = await getDownloadURL(testRef);
        console.log('  ✅ URL generation successful:', url);

        // Clean up
        await deleteObject(testRef);
        console.log('  ✅ Delete successful\n');

        results.storage = true;
    } catch (error: any) {
        console.error('  ❌ Storage test failed:', error.message);
        console.error('  💡 Check Storage security rules or authentication\n');
    }

    // Test 3: Auth
    try {
        console.log('3. Testing Authentication...');
        const currentUser = auth.currentUser;

        if (currentUser) {
            console.log('  ✅ User authenticated:', currentUser.email);
            results.auth = true;
        } else {
            console.log('  ⚠️  No user currently authenticated');
            console.log('  💡 This is expected if not logged in\n');
            results.auth = true; // Auth service is working, just no user
        }
    } catch (error: any) {
        console.error('  ❌ Auth test failed:', error.message);
    }

    // Overall result
    results.overall = results.firestore && results.storage && results.auth;

    console.log('\n📊 Test Results:');
    console.log('  Firestore:', results.firestore ? '✅' : '❌');
    console.log('  Storage:', results.storage ? '✅' : '❌');
    console.log('  Auth:', results.auth ? '✅' : '❌');
    console.log('\n' + (results.overall ? '✅ All Firebase services configured correctly!' : '⚠️  Some services need attention'));

    return results;
}

// Instructions
console.log(`
🔧 Firebase Test Utility Loaded

To test your Firebase configuration, run:
  testFirebaseSetup()

Note: You need to be authenticated to test Firestore and Storage.
If tests fail due to permissions, try:
  1. Sign in to the app first
  2. Check Firebase Console security rules
  3. Verify project ID in firebase.ts
`);
