
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Wrench, 
  Users, 
  Car, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Bell,
  Package,
  Activity,
  BatteryCharging,
  BarChart3,
  WifiOff,
  CalendarDays,
  FileText,
  ChevronUp,
  ChevronDown,
  User as UserIcon,
  Building2,
  Shield,
  Sun,
  Moon
} from 'lucide-react';
import { User } from '../types';
import { VoiceAssistant } from './VoiceAssistant';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { Permission } from '../services/rbac';
import { ROLE_COLORS, ROLE_LABELS } from '../services/rbac';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
}

const NavItem = ({ to, icon: Icon, label, active }: { to: string, icon: any, label: string, active: boolean }) => (
  <Link
    to={to}
    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors mb-1 ${
      active 
        ? 'bg-blue-600 text-white shadow-md' 
        : 'text-gray-400 hover:bg-slate-800 hover:text-white'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </Link>
);

// Theme Toggle Button for menu
const ThemeToggleButton: React.FC = () => {
  const { resolvedTheme, toggleTheme } = useTheme();
  return (
    <button 
      onClick={toggleTheme}
      className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors"
    >
      {resolvedTheme === 'light' ? (
        <>
          <Moon size={16} className="text-slate-400" /> Dark Mode
        </>
      ) : (
        <>
          <Sun size={16} className="text-yellow-400" /> Light Mode
        </>
      )}
    </button>
  );
};

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { can } = useAuth();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Click outside handler for user menu
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-xs font-bold text-center py-1 z-50 flex items-center justify-center gap-2">
          <WifiOff size={14} />
          <span>YOU ARE CURRENTLY OFFLINE. CHANGES WILL BE SAVED LOCALLY.</span>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-30 w-72 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-20 px-6 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center justify-center w-full">
            <img
              src="/wms-logo.png"
              alt="WMS Logo"
              className="h-16 w-auto object-contain"
            />
          </div>
          <button onClick={toggleSidebar} className="lg:hidden text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="px-4 py-6 overflow-y-auto h-[calc(100vh-9rem)]">
          <div className="mb-6 px-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Operations</p>
            <nav>
              <NavItem to="/" icon={LayoutDashboard} label="Dashboard" active={location.pathname === '/'} />
              {can(Permission.VIEW_JOBS) && <NavItem to="/jobs" icon={Wrench} label="Jobs & Workflow" active={location.pathname === '/jobs'} />}
              {can(Permission.VIEW_SCHEDULE) && <NavItem to="/schedule" icon={CalendarDays} label="Schedule" active={location.pathname === '/schedule'} />}
              {can(Permission.RUN_DIAGNOSTICS) && <NavItem to="/diagnostics" icon={Activity} label="Diagnostics" active={location.pathname === '/diagnostics'} />}
              {can(Permission.VIEW_INVENTORY) && <NavItem to="/inventory" icon={Package} label="Inventory" active={location.pathname === '/inventory'} />}
            </nav>
          </div>

          <div className="mb-6 px-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Management</p>
            <nav>
              {can(Permission.VIEW_CUSTOMERS) && <NavItem to="/customers" icon={Users} label="Customers" active={location.pathname === '/customers'} />}
              {can(Permission.VIEW_VEHICLES) && <NavItem to="/vehicles" icon={Car} label="Fleet & Vehicles" active={location.pathname === '/vehicles'} />}
              {can(Permission.VIEW_EV_FLEET) && <NavItem to="/ev-fleet" icon={BatteryCharging} label="EV Fleet Manager" active={location.pathname === '/ev-fleet'} />}
              {can(Permission.VIEW_INVOICES) && <NavItem to="/sales" icon={FileText} label="Sales & Quotes" active={location.pathname === '/sales'} />}
            </nav>
          </div>

          <div className="px-4">
             <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">System</p>
             <nav>
              {can(Permission.VIEW_REPORTS) && <NavItem to="/analytics" icon={BarChart3} label="Analytics" active={location.pathname === '/analytics'} />}
              <NavItem to="/settings" icon={Settings} label="Settings" active={location.pathname === '/settings'} />
             </nav>
          </div>

          {/* Admin Section - Only visible to System Admins */}
          {can(Permission.MANAGE_SYSTEM) && (
            <div className="mt-6 px-4">
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Administration</p>
              <nav>
                <NavItem to="/admin/companies" icon={Building2} label="Companies" active={location.pathname === '/admin/companies'} />
                <NavItem to="/admin/users" icon={Users} label="All Users" active={location.pathname === '/admin/users'} />
                <NavItem to="/admin/roles" icon={Shield} label="Roles & Permissions" active={location.pathname === '/admin/roles'} />
              </nav>
            </div>
          )}
        </div>

        {/* User Menu Footer */}
        <div ref={userMenuRef} className="absolute bottom-0 left-0 w-full p-4 bg-slate-950 border-t border-slate-800">
          
          {/* Dropdown Menu */}
          {isUserMenuOpen && (
            <div className="absolute bottom-full left-0 w-full mb-2 px-4 z-50">
               <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
                  <div className="p-4 border-b border-slate-700 bg-slate-800/50">
                      <p className="text-sm font-bold text-white truncate">{user?.name}</p>
                      <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                      <div className="mt-2 flex items-center gap-2">
                         {user?.role && (() => {
                           const rc = ROLE_COLORS[user.role];
                           return (
                             <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border tracking-wider ${rc.bg} ${rc.text} ${rc.border}`}>
                               {ROLE_LABELS[user.role]}
                             </span>
                           );
                         })()}
                      </div>
                  </div>
                  
                  <div className="p-1 space-y-0.5">
                      <Link 
                        to="/settings" 
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors"
                      >
                         <UserIcon size={16} className="text-slate-400" /> Personal Details
                      </Link>
                      <Link 
                        to="/settings" 
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors"
                      >
                         <Settings size={16} className="text-slate-400" /> Settings
                      </Link>
                      <ThemeToggleButton />
                      <div className="h-px bg-slate-700 my-1 mx-2"></div>
                      <button 
                        onClick={() => { onLogout(); setIsUserMenuOpen(false); }}
                        className="flex items-center gap-3 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-950/30 hover:text-red-300 rounded-lg transition-colors"
                      >
                         <LogOut size={16} /> Logout
                      </button>
                  </div>
               </div>
            </div>
          )}

          {/* Toggle Button */}
          <button 
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className={`flex items-center justify-between w-full p-2 rounded-xl transition-all duration-200 group ${
              isUserMenuOpen ? 'bg-slate-800 ring-1 ring-slate-700' : 'hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center space-x-3">
              <img 
                src={user?.avatar || "https://picsum.photos/100"} 
                alt="User" 
                className="w-10 h-10 rounded-full border-2 border-slate-700 group-hover:border-slate-500 transition-colors"
              />
              <div className="text-left overflow-hidden">
                <p className="text-sm font-semibold text-slate-200 group-hover:text-white truncate transition-colors">{user?.name}</p>
                <p className="text-xs text-slate-500 group-hover:text-slate-400 truncate capitalize">{user?.role.toLowerCase()}</p>
              </div>
            </div>
            <div className="text-slate-500 group-hover:text-white transition-colors">
                {isUserMenuOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </div>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <button onClick={toggleSidebar} className="lg:hidden text-gray-500 focus:outline-none">
            <Menu size={24} />
          </button>

          <div className="flex-1 flex justify-end items-center space-x-4">
             <button className="relative p-2 text-gray-400 hover:text-gray-500">
               <Bell size={20} />
               <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
             </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>

        {/* Voice Assistant Overlay */}
        <VoiceAssistant />
      </div>
    </div>
  );
};
