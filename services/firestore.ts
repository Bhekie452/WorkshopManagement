import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    DocumentData,
    QueryConstraint,
    Timestamp,
    serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

// Generic Firestore CRUD operations
export class FirestoreService {
    // Get all documents from a collection
    static async getAll<T>(collectionName: string, ...queryConstraints: QueryConstraint[]): Promise<T[]> {
        try {
            const collectionRef = collection(db, collectionName);
            const q = queryConstraints.length > 0 ? query(collectionRef, ...queryConstraints) : collectionRef;
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
        } catch (error) {
            console.error(`Error getting ${collectionName}:`, error);
            throw error;
        }
    }

    // Get a single document by ID
    static async getById<T>(collectionName: string, id: string): Promise<T | null> {
        try {
            const docRef = doc(db, collectionName, id);
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                return { id: snapshot.id, ...snapshot.data() } as T;
            }
            return null;
        } catch (error) {
            console.error(`Error getting document ${id} from ${collectionName}:`, error);
            throw error;
        }
    }

    // Create a new document
    static async create<T extends DocumentData>(collectionName: string, data: T): Promise<string> {
        try {
            const collectionRef = collection(db, collectionName);
            const docRef = await addDoc(collectionRef, {
                ...data,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error(`Error creating document in ${collectionName}:`, error);
            throw error;
        }
    }

    // Update an existing document
    static async update<T extends DocumentData>(
        collectionName: string,
        id: string,
        data: Partial<T>
    ): Promise<void> {
        try {
            const docRef = doc(db, collectionName, id);
            await updateDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error(`Error updating document ${id} in ${collectionName}:`, error);
            throw error;
        }
    }

    // Delete a document
    static async delete(collectionName: string, id: string): Promise<void> {
        try {
            const docRef = doc(db, collectionName, id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error(`Error deleting document ${id} from ${collectionName}:`, error);
            throw error;
        }
    }

    // Subscribe to real-time updates
    static subscribe<T>(
        collectionName: string,
        callback: (data: T[]) => void,
        ...queryConstraints: QueryConstraint[]
    ): () => void {
        const collectionRef = collection(db, collectionName);
        const q = queryConstraints.length > 0 ? query(collectionRef, ...queryConstraints) : collectionRef;

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
            callback(data);
        }, (error) => {
            console.error(`Error subscribing to ${collectionName}:`, error);
        });

        return unsubscribe;
    }

    // Query documents with custom conditions
    static async queryDocuments<T>(
        collectionName: string,
        ...queryConstraints: QueryConstraint[]
    ): Promise<T[]> {
        try {
            const collectionRef = collection(db, collectionName);
            const q = query(collectionRef, ...queryConstraints);
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
        } catch (error) {
            console.error(`Error querying ${collectionName}:`, error);
            throw error;
        }
    }
}

// Collection-specific services
export const Collections = {
    USERS: 'users',
    CUSTOMERS: 'customers',
    VEHICLES: 'vehicles',
    JOBS: 'jobs',
    PARTS: 'parts',
    INVOICES: 'invoices',
    APPOINTMENTS: 'appointments',
    DIAGNOSTICS: 'diagnostics',
    WARRANTIES: 'warranties'
} as const;
