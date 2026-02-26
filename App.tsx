import React, { useState, useEffect, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { store } from './services/store';
import { seedFirestore } from './services/seeder';
import { AuthService } from './services/auth';
import { companyProfile as companyProfileService } from './services/companyProfile';
import { emailService } from './services/emailService';
import { User, UserRole } from './types';
import { AuthProvider, useAuth } from './components/AuthContext';
import { Permission } from './services/rbac';

// Lazy Load Pages
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Jobs = React.lazy(() => import('./pages/Jobs').then(module => ({ default: module.Jobs })));
const Customers = React.lazy(() => import('./pages/Customers').then(module => ({ default: module.Customers })));
const Vehicles = React.lazy(() => import('./pages/Vehicles').then(module => ({ default: module.Vehicles })));
const Inventory = React.lazy(() => import('./pages/Inventory').then(module => ({ default: module.Inventory })));
const Diagnostics = React.lazy(() => import('./pages/Diagnostics').then(module => ({ default: module.Diagnostics })));
const EVFleet = React.lazy(() => import('./pages/EVFleet').then(module => ({ default: module.EVFleet })));
const Analytics = React.lazy(() => import('./pages/Analytics').then(module => ({ default: module.Analytics })));
const Schedule = React.lazy(() => import('./pages/Schedule').then(module => ({ default: module.Schedule })));
const Sales = React.lazy(() => import('./pages/Invoices').then(module => ({ default: module.Sales })));
const Settings = React.lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));

/** Renders children only if user has permission, otherwise redirects to / */
const ProtectedRoute: React.FC<{ permission: Permission; children: React.ReactNode }> = ({ permission, children }) => {
  const { can } = useAuth();
  if (!can(permission)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

import { signInWithGoogle } from './services/googleAuth';
const Login = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const user = await signInWithGoogle();
      onLogin({
        id: user.uid,
        name: user.displayName || '',
        email: user.email || '',
        role: UserRole.TECHNICIAN,
        avatar: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=random`
      });
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let user: User;
      if (isSignUp) {
        user = await AuthService.signUp(email, password, name);
      } else {
        user = await AuthService.signIn(email, password);
      }
      onLogin(user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[url('/bg-blur.jpg')] bg-cover bg-center bg-no-repeat relative">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-0" />
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-2xl p-10 border border-white/30">
          <div className="flex justify-center mb-6">
            <img
              src="/wms-logo1.png"
              alt="WMS Logo"
              className="h-28 w-auto object-contain drop-shadow-lg animate-bounce"
            />
          </div>
          <h2 className="text-3xl font-extrabold text-center text-gray-900 mb-2 tracking-tight drop-shadow">Welcome to Workshop Manager</h2>
          <p className="text-center text-gray-600 mb-8 text-lg">
            {isSignUp ? 'Sign up to manage your workshop' : 'Sign in to access your dashboard'}
          </p>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm text-center shadow">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white/80"
                  placeholder="John Doe"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white/80"
                placeholder="admin@workshop.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white/80"
                placeholder="••••••••"
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? (isSignUp ? 'Creating Account...' : 'Signing In...') : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          <div className="my-6 flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-300" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-300" />
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 rounded-xl shadow-lg transition-all duration-200 text-lg disabled:opacity-60"
          >
            <svg className="h-6 w-6" viewBox="0 0 48 48"><g><path fill="#4285F4" d="M24 9.5c3.54 0 6.36 1.53 7.82 2.81l5.77-5.62C34.36 3.7 29.67 1.5 24 1.5 14.82 1.5 6.98 7.6 3.69 15.44l6.91 5.37C12.1 15.01 17.56 9.5 24 9.5z"/><path fill="#34A853" d="M46.1 24.5c0-1.64-.15-3.22-.43-4.74H24v9.24h12.4c-.54 2.9-2.18 5.36-4.64 7.04l7.18 5.59C43.98 37.13 46.1 31.23 46.1 24.5z"/><path fill="#FBBC05" d="M10.6 28.13a14.5 14.5 0 0 1 0-8.26l-6.91-5.37A23.97 23.97 0 0 0 0 24c0 3.93.94 7.65 2.6 10.91l7.18-5.59z"/><path fill="#EA4335" d="M24 46.5c6.48 0 11.93-2.14 15.9-5.82l-7.18-5.59c-2.01 1.35-4.6 2.16-8.72 2.16-6.44 0-11.9-5.51-13.4-12.91l-7.18 5.59C6.98 40.4 14.82 46.5 24 46.5z"/></g></svg>
            {googleLoading ? 'Signing in...' : 'Sign in with Google'}
          </button>

          <div className="mt-6 text-center text-sm text-gray-600">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"} {' '}
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
          <div className="mt-8 text-center text-xs text-gray-400">
            <span>By signing in, you agree to our <a href="#" className="underline hover:text-blue-700">Terms of Service</a> and <a href="#" className="underline hover:text-blue-700">Privacy Policy</a>.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [storeReady, setStoreReady] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Initialize Firestore-backed store on mount
  useEffect(() => {
    store.init()
      .then(() => setStoreReady(true))
      .catch(() => setStoreReady(true)); // fallback to localStorage cache
  }, []);

  // Check for session persistence
  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChange((user) => {
      setUser(user);
      setAuthChecked(true);
      // When user logs in, load company profile and prime the email service
      if (user) {
        companyProfileService.getProfile()
          .then(profile => {
            emailService.setCompanyInfo({
              name: profile.name,
              email: profile.contact.email,
              phone: profile.contact.phone,
              address: `${profile.address.street}, ${profile.address.city}`,
            });
          })
          .catch(() => {/* non-critical, use defaults */});
      }
    });
    return () => unsubscribe();
  }, []);

  // Maintain secure JWT token lifecycle
  useEffect(() => {
    const stopAutoRefresh = AuthService.startTokenAutoRefresh();
    return () => stopAutoRefresh();
  }, []);

  const handleLogin = (user: User) => {
    setUser(user);
    // No need to set localStorage manually as onAuthStateChange handles persistence
  };

  const handleLogout = async () => {
    await AuthService.signOutUser();
    setUser(null);
  };

  if (!authChecked) {
    // Wait for Firebase to restore session
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-sm text-gray-400">Checking authentication…</p>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (!storeReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-sm text-gray-400">Syncing data...</p>
      </div>
    );
  }

  return (
    <AuthProvider user={user}>
      <Router>
        <Layout user={user} onLogout={handleLogout}>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/jobs" element={<ProtectedRoute permission={Permission.VIEW_JOBS}><Jobs /></ProtectedRoute>} />
                <Route path="/schedule" element={<ProtectedRoute permission={Permission.VIEW_SCHEDULE}><Schedule /></ProtectedRoute>} />
                <Route path="/customers" element={<ProtectedRoute permission={Permission.VIEW_CUSTOMERS}><Customers /></ProtectedRoute>} />
                <Route path="/vehicles" element={<ProtectedRoute permission={Permission.VIEW_VEHICLES}><Vehicles /></ProtectedRoute>} />
                <Route path="/inventory" element={<ProtectedRoute permission={Permission.VIEW_INVENTORY}><Inventory /></ProtectedRoute>} />
                <Route path="/diagnostics" element={<ProtectedRoute permission={Permission.RUN_DIAGNOSTICS}><Diagnostics /></ProtectedRoute>} />
                <Route path="/ev-fleet" element={<ProtectedRoute permission={Permission.VIEW_EV_FLEET}><EVFleet /></ProtectedRoute>} />
                <Route path="/sales" element={<ProtectedRoute permission={Permission.VIEW_INVOICES}><Sales /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute permission={Permission.VIEW_REPORTS}><Analytics /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute permission={Permission.VIEW_SETTINGS}><Settings /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Layout>
      </Router>
    </AuthProvider>
  );
};

export default App;
