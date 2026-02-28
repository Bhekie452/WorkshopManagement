import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    onIdTokenChanged,
    sendPasswordResetEmail,
    sendEmailVerification,
    updateProfile,
    User as FirebaseUser,
    UserCredential
} from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, getDoc, getDocs, collection } from 'firebase/firestore';
import { User, UserRole } from '../types';
import { Collections } from './firestore';

type AuthMode = 'firebase' | 'custom';

interface CustomAuthResponse {
    user: User;
    accessToken: string;
    refreshToken: string;
}

export class AuthService {
    // Determine auth mode with runtime safety: prefer Firebase when running
    // in production (non-localhost) even if build env was set to custom.
    private static readonly AUTH_MODE: AuthMode = (() => {
        const envMode = import.meta.env.VITE_AUTH_MODE;
        if (envMode === 'custom') {
            try {
                if (typeof window !== 'undefined') {
                    const host = window.location.hostname;
                    // Only allow custom mode when running on localhost
                    if (host === 'localhost' || host === '127.0.0.1') return 'custom';
                    return 'firebase';
                }
            } catch (_e) {
                return 'firebase';
            }
            return 'custom';
        }
        return 'firebase';
    })();

    // AUTH_SERVER_URL: prefer explicit env, but avoid localhost URLs when running in production
    private static readonly AUTH_SERVER_URL: string = (() => {
        const envUrl = import.meta.env.VITE_AUTH_SERVER_URL || import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:3001';
        try {
            if (typeof window !== 'undefined') {
                const host = window.location.hostname;
                if (host !== 'localhost' && host !== '127.0.0.1') {
                    // If envUrl points to localhost but we're running in prod, ignore it
                    if (/localhost|127\.0\.0\.1/.test(envUrl)) {
                        return '';
                    }
                }
            }
        } catch (_e) {
            // fall through
        }
        return envUrl;
    })();
    private static readonly SESSION_KEY = 'customAuthSession';
    private static customAuthListeners = new Set<(user: User | null) => void>();
    private static customTokenListeners = new Set<(token: string | null) => void>();

    private static getCustomSession(): CustomAuthResponse | null {
        try {
            const raw = localStorage.getItem(this.SESSION_KEY);
            if (!raw) return null;
            return JSON.parse(raw) as CustomAuthResponse;
        } catch {
            return null;
        }
    }

    private static setCustomSession(session: CustomAuthResponse): void {
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
        this.notifyCustomAuthListeners(session.user);
        this.notifyCustomTokenListeners(session.accessToken);
    }

    private static clearCustomSession(): void {
        localStorage.removeItem(this.SESSION_KEY);
        this.notifyCustomAuthListeners(null);
        this.notifyCustomTokenListeners(null);
    }

    private static notifyCustomAuthListeners(user: User | null): void {
        this.customAuthListeners.forEach(listener => listener(user));
    }

    private static notifyCustomTokenListeners(token: string | null): void {
        this.customTokenListeners.forEach(listener => listener(token));
    }

    private static async requestCustomAuth(path: string, body: Record<string, any>): Promise<CustomAuthResponse> {
        if (this.AUTH_MODE !== 'custom' || !this.AUTH_SERVER_URL) {
            throw new Error('Custom auth server is not available in this environment');
        }

        const response = await fetch(`${this.AUTH_SERVER_URL}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.error || payload?.message || 'Authentication failed');
        }
        // Normalize casing for any user objects before returning so callers
        // may safely rely on camelCase properties (companyId) regardless of
        // what the server returns (snake_case from FastAPI).
        return this.normalizePayload(payload) as CustomAuthResponse;
    }

    private static async customFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
        if (this.AUTH_MODE !== 'custom' || !this.AUTH_SERVER_URL) {
            throw new Error('Custom API server is not available in this environment');
        }

        const token = await this.getIdToken();
        const response = await fetch(`${this.AUTH_SERVER_URL}${path}`, {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(init.headers || {}),
            },
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.error || payload?.message || 'Request failed');
        }
        // also normalize any user records that may be returned by
        // authentication-related endpoints such as /me or /users
        return this.normalizePayload(payload) as T;
    }

    // ----- helpers --------------------------------------------------------

    /**
     * Convert API user object to our client-side `User` shape.
     * In particular `company_id` -> `companyId`.
     */
    private static normalizeUser(u: any): User {
        if (!u || typeof u !== 'object') return u;
        const normalized: any = { ...u };
        if (u.company_id !== undefined && normalized.companyId === undefined) {
            normalized.companyId = u.company_id;
        }
        return normalized as User;
    }

    /**
     * Walk a payload looking for `user` or `users` properties and normalize
     * them. This keeps both requestCustomAuth and customFetch in sync.
     */
    private static normalizePayload<T>(payload: T): T {
        if (!payload || typeof payload !== 'object') return payload;
        const p: any = payload as any;
        if (p.user) {
            p.user = this.normalizeUser(p.user);
        }
        if (Array.isArray(p.users)) {
            p.users = p.users.map((u: any) => this.normalizeUser(u));
        }
        return p as T;
    }

    private static async refreshCustomToken(): Promise<string | null> {
        const session = this.getCustomSession();
        if (!session?.refreshToken) return null;

        try {
            const response = await fetch(`${this.AUTH_SERVER_URL}/api/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refreshToken: session.refreshToken }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                this.clearCustomSession();
                return null;
            }

            const nextSession: CustomAuthResponse = {
                user: payload.user || session.user,
                accessToken: payload.accessToken,
                refreshToken: payload.refreshToken || session.refreshToken,
            };

            this.setCustomSession(nextSession);
            return nextSession.accessToken;
        } catch {
            return null;
        }
    }

    // Sign in with email and password
    static async signIn(email: string, password: string): Promise<User> {
        if (this.AUTH_MODE === 'custom') {
            const session = await this.requestCustomAuth('/api/auth/login', { email, password });
            this.setCustomSession(session);
            return session.user;
        }

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
        role: UserRole = UserRole.TECHNICIAN,
        companyId?: string
    ): Promise<User> {
        if (this.AUTH_MODE === 'custom') {
            const session = await this.requestCustomAuth('/api/auth/signup', { email, password, name, role, companyId });
            this.setCustomSession(session);
            return session.user;
        }

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
        if (this.AUTH_MODE === 'custom') {
            const session = this.getCustomSession();
            this.clearCustomSession();

            if (session?.refreshToken) {
                try {
                    await fetch(`${this.AUTH_SERVER_URL}/api/auth/logout`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ refreshToken: session.refreshToken }),
                    });
                } catch {
                    // Ignore logout network errors.
                }
            }
            return;
        }

        try {
            await signOut(auth);
        } catch (error) {
            console.error('Sign out error:', error);
            throw error;
        }
    }

    // Update user profile (name, phone, bio, avatar)
    static async updateUser(uid: string, data: Partial<Omit<User, 'id'>>): Promise<void> {
        if (this.AUTH_MODE === 'custom') {
            const payload = await this.customFetch<{ user: User }>(`/api/auth/users/${uid}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });

            const session = this.getCustomSession();
            if (session && session.user.id === uid) {
                this.setCustomSession({ ...session, user: payload.user });
            }
            return;
        }

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
        if (this.AUTH_MODE === 'custom') {
            throw new Error('Password reset is not configured for custom auth mode yet.');
        }

        try {
            await sendPasswordResetEmail(auth, email);
        } catch (error: any) {
            console.error('Password reset error:', error);
            throw new Error(this.getAuthErrorMessage(error.code));
        }
    }

    // Get user data from Firestore
    static async getUserData(uid: string): Promise<User | null> {
        if (this.AUTH_MODE === 'custom') {
            const session = this.getCustomSession();
            if (!session) return null;

            if (session.user.id === uid) {
                try {
                    const payload = await this.customFetch<{ user: User }>('/api/auth/me');
                    this.setCustomSession({ ...session, user: payload.user });
                    return payload.user;
                } catch {
                    return session.user;
                }
            }

            try {
                const payload = await this.customFetch<{ users: User[] }>('/api/auth/users');
                return payload.users.find((user) => user.id === uid) || null;
            } catch {
                return null;
            }
        }

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

    // Get all team members from Firestore
    static async getAllUsers(): Promise<User[]> {
        if (this.AUTH_MODE === 'custom') {
            try {
                const payload = await this.customFetch<{ users: User[] }>('/api/auth/users');
                return payload.users || [];
            } catch (error) {
                console.error('Error getting all users (custom):', error);
                return [];
            }
        }

        try {
            const snapshot = await getDocs(collection(db, Collections.USERS));
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User));
        } catch (error) {
            console.error('Error getting all users:', error);
            return [];
        }
    }

    // Update another user's role (admin only)
    static async updateUserRole(uid: string, role: UserRole): Promise<void> {
        if (this.AUTH_MODE === 'custom') {
            await this.customFetch(`/api/auth/users/${uid}/role`, {
                method: 'PATCH',
                body: JSON.stringify({ role }),
            });

            const session = this.getCustomSession();
            if (session && session.user.id === uid) {
                this.setCustomSession({ ...session, user: { ...session.user, role } });
            }
            return;
        }

        try {
            const docRef = doc(db, Collections.USERS, uid);
            await setDoc(docRef, { role }, { merge: true });
        } catch (error: any) {
            console.error('Update role error:', error);
            throw new Error('Failed to update user role');
        }
    }

    // Listen to auth state changes
    static onAuthStateChange(callback: (user: User | null) => void): () => void {
        if (this.AUTH_MODE === 'custom') {
            this.customAuthListeners.add(callback);
            callback(this.getCustomSession()?.user || null);

            return () => {
                this.customAuthListeners.delete(callback);
            };
        }

        return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
            if (firebaseUser) {
                const userData = await this.getUserData(firebaseUser.uid);
                callback(userData);
            } else {
                callback(null);
            }
        });
    }

    // Listen to ID token changes (token refresh / sign-in / sign-out)
    static onTokenChange(callback: (token: string | null) => void): () => void {
        if (this.AUTH_MODE === 'custom') {
            this.customTokenListeners.add(callback);
            callback(this.getCustomSession()?.accessToken || null);

            return () => {
                this.customTokenListeners.delete(callback);
            };
        }

        return onIdTokenChanged(auth, async (firebaseUser: FirebaseUser | null) => {
            if (!firebaseUser) {
                callback(null);
                return;
            }

            try {
                const token = await firebaseUser.getIdToken();
                callback(token);
            } catch {
                callback(null);
            }
        });
    }

    // Get Firebase JWT (ID token)
    static async getIdToken(forceRefresh: boolean = false): Promise<string | null> {
        if (this.AUTH_MODE === 'custom') {
            if (forceRefresh) {
                return this.refreshCustomToken();
            }
            return this.getCustomSession()?.accessToken || null;
        }

        if (!auth.currentUser) return null;

        try {
            return await auth.currentUser.getIdToken(forceRefresh);
        } catch (error) {
            console.error('Failed to get ID token:', error);
            return null;
        }
    }

    // Auto-refresh token on an interval (in addition to Firebase SDK internals)
    static startTokenAutoRefresh(intervalMs: number = 45 * 60 * 1000): () => void {
        if (this.AUTH_MODE === 'custom') {
            const intervalId = window.setInterval(async () => {
                await this.refreshCustomToken();
            }, intervalMs);

            this.refreshCustomToken().catch(() => undefined);

            return () => {
                window.clearInterval(intervalId);
            };
        }

        const intervalId = window.setInterval(async () => {
            if (!auth.currentUser) return;

            try {
                await auth.currentUser.getIdToken(true);
            } catch (error) {
                console.warn('Token refresh failed:', error);
            }
        }, intervalMs);

        return () => {
            window.clearInterval(intervalId);
        };
    }

    // Get current user
    static getCurrentUser(): FirebaseUser | null {
        if (this.AUTH_MODE === 'custom') {
            return null;
        }
        return auth.currentUser;
    }

    // Check if user is authenticated
    static isAuthenticated(): boolean {
        if (this.AUTH_MODE === 'custom') {
            return !!this.getCustomSession()?.accessToken;
        }
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
