import React, { useState, useEffect, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { store } from './services/store';
import { seedFirestore } from './services/seeder';
import { AuthService } from './services/auth';
import { User } from './types';

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

const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

const Login = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <img
            src="/wms-logo1.png"
            alt="WMS Logo"
            className="h-52 w-auto object-contain"
          />
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </h2>
        <p className="text-center text-gray-500 mb-8">
          {isSignUp ? 'Sign up to manage your workshop' : 'Please sign in to access your dashboard'}
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm text-center">
            {error}
          </div>
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
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
              minLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"} {' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Settings = () => (
  <div className="space-y-6">
    <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="font-bold mb-4 text-lg border-b pb-2">Workshop Profile</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Workshop Name</label>
            <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md p-2" defaultValue="AutoFlow Workshop" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <textarea className="mt-1 block w-full border border-gray-300 rounded-md p-2" defaultValue="123 Mechanic Lane, Tech City" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">VAT Number</label>
            <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md p-2" defaultValue="VAT-99887766" />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="font-bold mb-4 text-lg border-b pb-2">Data Management</h3>
        <p className="text-gray-500 mb-4 text-sm">Manage your application data.</p>
        <div className="space-y-3">
          <button
            onClick={async () => {
              if (confirm('This will populate the database with sample data. Continue?')) {
                try {
                  await seedFirestore();
                  alert('Database seeded successfully!');
                  window.location.reload();
                } catch (e) {
                  alert('Error seeding database: ' + e);
                }
              }
            }}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded w-full font-medium"
          >
            Seed Database (Sample Data)
          </button>

          <button
            onClick={() => { if (confirm('Are you sure? This will reset local storage.')) { store.reset(); window.location.reload(); } }}
            className="px-4 py-2 border border-red-500 text-red-600 rounded hover:bg-red-50 w-full"
          >
            Reset Local Application Data
          </button>
        </div>
      </div>
    </div>
  </div>
)

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  // Check for session persistence
  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChange((user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = (user: User) => {
    setUser(user);
    // No need to set localStorage manually as onAuthStateChange handles persistence
  };

  const handleLogout = async () => {
    await AuthService.signOutUser();
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <Layout user={user} onLogout={handleLogout}>
        <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/vehicles" element={<Vehicles />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/diagnostics" element={<Diagnostics />} />
              <Route path="/ev-fleet" element={<EVFleet />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </Layout>
    </Router>
  );
};

export default App;
