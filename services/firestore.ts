import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    startAfter,
    limit,
    onSnapshot,
    DocumentData,
    QueryConstraint,
    Timestamp,
    serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

// Generic Firestore CRUD operations
export class FirestoreService {
    /**
     * Get all documents from a collection with optional backend pagination.
     * @param collectionName Firestore collection
     * @param options { limit, startAfter, orderByField, orderDirection }
     * @param queryConstraints Additional Firestore query constraints
     */
    static async getAll<T>(
        collectionName: string,
        optionsOrConstraint?: { limit?: number; startAfter?: any; orderByField?: string; orderDirection?: 'asc' | 'desc' } | QueryConstraint,
        ...queryConstraints: QueryConstraint[]
    ): Promise<T[]> {
        try {
            const collectionRef = collection(db, collectionName);
            const isConstraint =
                !!optionsOrConstraint &&
                typeof optionsOrConstraint === 'object' &&
                'type' in (optionsOrConstraint as any);

            const options = isConstraint ? undefined : (optionsOrConstraint as { limit?: number; startAfter?: any; orderByField?: string; orderDirection?: 'asc' | 'desc' } | undefined);
            const constraints = isConstraint
                ? [optionsOrConstraint as QueryConstraint, ...queryConstraints]
                : queryConstraints;

            let q: any = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;
            if (options?.orderByField) {
                q = query(q, orderBy(options.orderByField, options.orderDirection || 'asc'));
            }
            if (options?.startAfter) {
                q = query(q, startAfter(options.startAfter));
            }
            if (options?.limit) {
                q = query(q, limit(options.limit));
            }
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => {
                const data = doc.data();
                return ({ id: doc.id, ...(data && typeof data === 'object' ? data : {}) } as T);
            });
        } catch (error) {
            console.error(`Error getting ${collectionName}:`, error);
            throw error;
        }
    }

    // --- Redis Caching Stub ---
    // To enable Redis caching for heavy queries, add a Redis client here and wrap getAll/queryDocuments with cache logic.
    // Example:
    // import Redis from 'ioredis';
    // const redis = new Redis(process.env.REDIS_URL);
    // static async getAllWithCache<T>(...) { ... }

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

    // Create a new document with a specific ID
    static async createWithId<T extends DocumentData>(collectionName: string, id: string, data: T): Promise<void> {
        try {
            const docRef = doc(db, collectionName, id);
            await setDoc(docRef, {
                ...data,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error(`Error creating document ${id} in ${collectionName}:`, error);
            throw error;
        }
    }

    // Update an existing document (uses merge to create if missing)
    static async update<T extends DocumentData>(
        collectionName: string,
        id: string,
        data: Partial<T>
    ): Promise<void> {
        try {
            const docRef = doc(db, collectionName, id);
            await setDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp()
            }, { merge: true });
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
            const data = snapshot.docs.map(doc => {
                const row = doc.data();
                return ({ id: doc.id, ...(row && typeof row === 'object' ? row : {}) } as T);
            });
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
            return snapshot.docs.map(doc => {
                const data = doc.data();
                return ({ id: doc.id, ...(data && typeof data === 'object' ? data : {}) } as T);
            });
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
    WARRANTIES: 'warranties',
    COMPANY_PROFILES: 'companyProfiles',
    NOTIFICATIONS: 'notifications',
    NOTIFICATION_PREFERENCES: 'notificationPreferences'
} as const;
