import React, { useState, useEffect, Suspense } from 'react';
import { signInWithGoogle } from './services/googleAuth';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { store } from './services/store';
// import { seedFirestore } from './services/seeder';
import { AuthService } from './services/auth';
import { FirestoreService } from './services/firestore';
import { companyProfile as companyProfileService } from './services/companyProfile';
import { emailService } from './services/emailService';
import { User, UserRole, Company } from './types';
import { AuthProvider, useAuth } from './components/AuthContext';
import { ThemeProvider } from './components/ThemeContext';
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

// Admin Pages
const Companies = React.lazy(() => import('./pages/Companies'));
const UsersManagement = React.lazy(() => import('./pages/UsersManagement'));
const RolesPermissions = React.lazy(() => import('./pages/RolesPermissions'));
const UserInvitations = React.lazy(() => import('./pages/UserInvitations') as Promise<{ default: React.ComponentType<any> }>);

// Public Pages
const AcceptInvitation = React.lazy(() => import('./pages/AcceptInvitation'));

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

const Login = ({ onLogin, companies, selectedCompany, setSelectedCompany }: { onLogin: (user: User) => void; companies: Company[]; selectedCompany: string; setSelectedCompany: (v: string) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // signup state
  const [signupName, setSignupName] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [signingUp, setSigningUp] = useState(false);
  const [signupError, setSignupError] = useState('');


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user: User = await AuthService.signIn(email, password);
      onLogin(user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError('');
    if (password !== signupConfirm) {
      setSignupError('Passwords do not match');
      return;
    }
    setSigningUp(true);
    try {
      const user = await AuthService.signUp(email, password, signupName, UserRole.TECHNICIAN, selectedCompany);
      onLogin(user);
    } catch (err: any) {
      setSignupError(err.message || 'Registration failed');
    } finally {
      setSigningUp(false);
    }
  };

  const [isLoginMode, setIsLoginMode] = useState(true);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[url('/bg-blur.jpg')] bg-cover bg-center relative">
      <div className="absolute inset-0 bg-blue-800/60" />
      <div className="relative z-10 w-full max-w-4xl flex shadow-2xl rounded-lg overflow-hidden">
        {/* left panel with car image and social/signup */}
        <div
          className="hidden lg:flex w-1/2 bg-cover bg-center relative"
          style={{ backgroundImage: "url('/car.avif')" }}
        >
          <div className="absolute inset-0 bg-blue-900/75 flex flex-col items-center justify-center text-white p-12 text-center">
            <h1 className="text-4xl font-bold mb-6">Workshop Management System</h1>
            <p className="text-lg text-blue-100 mb-8">
              Manage your workshop efficiently with our all-in-one solution for jobs, inventory, and customer relations.
            </p>
            <div className="space-y-4 w-full max-w-xs">
              <p className="text-sm opacity-80">{isLoginMode ? "Don't have an account?" : "Already have an account?"}</p>
              <button
                onClick={() => setIsLoginMode(!isLoginMode)}
                className="w-full py-2 border-2 border-white/50 rounded-lg hover:bg-white/10 transition-colors font-semibold"
              >
                {isLoginMode ? 'CREATE ACCOUNT' : 'BACK TO LOGIN'}
              </button>
            </div>
          </div>
        </div>

        {/* right panel with form */}
        <div className="w-full lg:w-1/2 bg-white p-8 flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="flex justify-center mb-6">
              <img src="/wms-logo.png" alt="Workshop Management System" className="h-16 w-auto" />
            </div>
            
            {isLoginMode ? (
              <>
                <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">Welcome Back</h2>
                {error && (
                  <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm text-center shadow">{error}</div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Email"
                  />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Password"
                    minLength={6}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="remember"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 cursor-pointer"
                    />
                    <label htmlFor="remember" className="text-gray-600 text-sm">Remember Me</label>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50"
                  >
                    {loading ? 'LOGIN...' : 'LOGIN'}
                  </button>
                  
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500 italic">or continue with</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading}
                    className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-2 hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 48 48">
                      <g>
                        <path fill="#4285F4" d="M24 9.5c3.54 0 6.36 1.53 7.82 2.81l5.77-5.62C34.36 3.7 29.67 1.5 24 1.5 14.82 1.5 6.98 7.6 3.69 15.44l6.91 5.37C12.1 15.01 17.56 9.5 24 9.5z"/>
                        <path fill="#34A853" d="M46.1 24.5c0-1.64-.15-3.22-.43-4.74H24v9.24h12.4c-.54 2.9-2.18 5.36-4.64 7.04l7.18 5.59C43.98 37.13 46.1 31.23 46.1 24.5z"/>
                        <path fill="#FBBC05" d="M10.6 28.13a14.5 14.5 0 0 1 0-8.26l-6.91-5.37A23.97 23.97 0 0 0 0 24c0 3.93.94 7.65 2.6 10.91l7.18-5.59z"/>
                        <path fill="#EA4335" d="M24 46.5c6.48 0 11.93-2.14 15.9-5.82l-7.18-5.59c-2.01 1.35-4.6 2.16-8.72 2.16-6.44 0-11.9-5.51-13.4-12.91l-7.18 5.59C6.98 40.4 14.82 46.5 24 46.5z"/>
                      </g>
                    </svg>
                    {googleLoading ? 'Signing in...' : 'Sign in with Google'}
                  </button>

                  <div className="text-center mt-4">
                    <button type="button" className="text-gray-600 text-sm hover:text-blue-600">
                      Forgot Password?
                    </button>
                  </div>
                  <div className="text-center mt-2 lg:hidden">
                    <button 
                      type="button" 
                      onClick={() => setIsLoginMode(false)}
                      className="text-blue-600 text-sm font-semibold"
                    >
                      Don't have an account? Sign Up
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">Create Account</h2>
                {signupError && (
                  <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm text-center shadow">{signupError}</div>
                )}
                <form onSubmit={handleSignup} className="space-y-4">
                  <input
                    type="text"
                    required
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Full Name"
                  />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Email"
                  />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Password"
                    minLength={6}
                  />
                  <input
                    type="password"
                    required
                    value={signupConfirm}
                    onChange={(e) => setSignupConfirm(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Confirm Password"
                    minLength={6}
                  />
                  {/* company selection */}
                  {companies.length > 0 && (
                    <select
                      required
                      value={selectedCompany}
                      onChange={e => setSelectedCompany(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Select Company</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                  <button
                    type="submit"
                    disabled={signingUp}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50"
                  >
                    {signingUp ? 'CREATING ACCOUNT...' : 'REGISTER'}
                  </button>
                  <div className="text-center mt-2 lg:hidden">
                    <button 
                      type="button" 
                      onClick={() => setIsLoginMode(true)}
                      className="text-blue-600 text-sm font-semibold"
                    >
                      Already have an account? Login
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [storeReady, setStoreReady] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Initialize Firestore-backed store on mount
  useEffect(() => {
    store.init()
      .then(() => setStoreReady(true))
      .catch(() => setStoreReady(true)); // fallback to localStorage cache
  }, []);

  // load companies for registration dropdown
  useEffect(() => {
    FirestoreService.getAll<Company>('companies')
      .then(setCompanies)
      .catch(() => setCompanies([]));
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
    return <Login onLogin={handleLogin} companies={companies} selectedCompany={selectedCompany} setSelectedCompany={setSelectedCompany} />;
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
    <ThemeProvider>
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
                {/* System Admin Routes */}
                <Route path="/admin/companies" element={<ProtectedRoute permission={Permission.MANAGE_SYSTEM}><Companies currentUser={user} /></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute permission={Permission.MANAGE_SYSTEM}><UsersManagement currentUser={user} /></ProtectedRoute>} />
                <Route path="/admin/roles" element={<ProtectedRoute permission={Permission.MANAGE_SYSTEM}><RolesPermissions /></ProtectedRoute>} />
                <Route path="/admin/invitations" element={<ProtectedRoute permission={Permission.MANAGE_SYSTEM}><UserInvitations /></ProtectedRoute>} />
                {/* Public Routes */}
                <Route path="/accept-invitation/:token" element={<AcceptInvitation />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </Layout>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
