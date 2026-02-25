import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    sendEmailVerification,
    updateProfile,
    User as FirebaseUser,
    UserCredential
} from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { User, UserRole } from '../types';
import { Collections } from './firestore';

export class AuthService {
    // Sign in with email and password
    static async signIn(email: string, password: string): Promise<User> {
        try {
            const userCredential: UserCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = await this.getUserData(userCredential.user.uid);

            if (!user) {
                throw new Error('User data not found');
            }

            return user;
        } catch (error: any) {
            console.error('Sign in error:', error);
            throw new Error(this.getAuthErrorMessage(error.code));
        }
    }

    // Create new user account
    static async signUp(
        email: string,
        password: string,
        name: string,
        role: UserRole = UserRole.TECHNICIAN
    ): Promise<User> {
        try {
            // Create Firebase auth account
            const userCredential: UserCredential = await createUserWithEmailAndPassword(auth, email, password);

            // Update display name
            await updateProfile(userCredential.user, { displayName: name });

            // Send email verification
            await sendEmailVerification(userCredential.user);

            // Create user document in Firestore
            const userData: Omit<User, 'id'> = {
                name,
                email,
                role,
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
            };

            await setDoc(doc(db, Collections.USERS, userCredential.user.uid), userData);

            return {
                id: userCredential.user.uid,
                ...userData
            };
        } catch (error: any) {
            console.error('Sign up error:', error);
            throw new Error(this.getAuthErrorMessage(error.code));
        }
    }

    // Sign out
    static async signOutUser(): Promise<void> {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Sign out error:', error);
            throw error;
        }
    }

    // Update user profile (name, phone, bio, avatar)
    static async updateUser(uid: string, data: Partial<Omit<User, 'id'>>): Promise<void> {
        try {
            // Update Firestore user document
            const docRef = doc(db, Collections.USERS, uid);
            await setDoc(docRef, data, { merge: true });

            // If name changed, also update Firebase Auth displayName
            if (data.name && auth.currentUser) {
                await updateProfile(auth.currentUser, { displayName: data.name });
            }
        } catch (error: any) {
            console.error('Update user error:', error);
            throw new Error('Failed to update profile');
        }
    }

    // Send password reset email
    static async resetPassword(email: string): Promise<void> {
        try {
            await sendPasswordResetEmail(auth, email);
        } catch (error: any) {
            console.error('Password reset error:', error);
            throw new Error(this.getAuthErrorMessage(error.code));
        }
    }

    // Get user data from Firestore
    static async getUserData(uid: string): Promise<User | null> {
        try {
            const docRef = doc(db, Collections.USERS, uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return {
                    id: docSnap.id,
                    ...docSnap.data()
                } as User;
            }

            return null;
        } catch (error) {
            console.error('Error getting user data:', error);
            return null;
        }
    }

    // Listen to auth state changes
    static onAuthStateChange(callback: (user: User | null) => void): () => void {
        return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
            if (firebaseUser) {
                const userData = await this.getUserData(firebaseUser.uid);
                callback(userData);
            } else {
                callback(null);
            }
        });
    }

    // Get current user
    static getCurrentUser(): FirebaseUser | null {
        return auth.currentUser;
    }

    // Check if user is authenticated
    static isAuthenticated(): boolean {
        return auth.currentUser !== null;
    }

    // User-friendly error messages
    private static getAuthErrorMessage(errorCode: string): string {
        switch (errorCode) {
            case 'auth/invalid-email':
                return 'Invalid email address';
            case 'auth/user-disabled':
                return 'This account has been disabled';
            case 'auth/user-not-found':
                return 'No account found with this email';
            case 'auth/wrong-password':
                return 'Incorrect password';
            case 'auth/email-already-in-use':
                return 'An account with this email already exists';
            case 'auth/weak-password':
                return 'Password should be at least 6 characters';
            case 'auth/too-many-requests':
                return 'Too many failed attempts. Please try again later';
            case 'auth/network-request-failed':
                return 'Network error. Please check your connection';
            default:
                return 'Authentication error. Please try again';
        }
    }
}
