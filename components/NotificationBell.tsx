import React, { useState, useEffect, useRef } from 'react';
import { Bell, Info, CheckCircle, AlertTriangle, AlertCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { store } from '../services/store';
import { InAppNotification } from '../types';

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial fetch
    setNotifications(store.getNotifications());

    // Listen for updates (In a real app, we'd use an event emitter or observer pattern on the store)
    const interval = setInterval(() => {
      setNotifications(store.getNotifications());
    }, 5000);

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      clearInterval(interval);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAsRead = (id: string) => {
    store.markNotificationAsRead(id);
    setNotifications(store.getNotifications());
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle size={14} className="text-green-500" />;
      case 'warning': return <AlertTriangle size={14} className="text-yellow-500" />;
      case 'error': return <AlertCircle size={14} className="text-red-500" />;
      default: return <Info size={14} className="text-blue-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:text-blue-600 transition-colors focus:outline-none rounded-full hover:bg-blue-50"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 z-50 animate-in fade-in slide-in-from-top-4 duration-300 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
            {unreadCount > 0 ? (
              <button 
                onClick={() => notifications.forEach(n => !n.isRead && handleMarkAsRead(n.id))}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold transition-colors flex items-center gap-1"
              >
                <CheckCircle size={12} /> Mark all read
              </button>
            ) : (
              <span className="text-xs text-gray-400">All caught up</span>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                  <Bell size={24} className="text-gray-300" />
                </div>
                <p className="text-sm text-gray-500">No notifications yet</p>
                <p className="text-xs text-gray-400 mt-1">We'll notify you when something important happens.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.slice(0, 5).map((notification) => (
                  <div 
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50/80 transition-colors cursor-pointer group ${!notification.isRead ? 'bg-blue-50/40 relative' : ''}`}
                    onClick={() => handleMarkAsRead(notification.id)}
                  >
                    {!notification.isRead && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full" />
                    )}
                    <div className="flex gap-3">
                      <div className="mt-0.5 flex-shrink-0">
                        {getTypeIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-0.5">
                          <p className={`text-sm tracking-tight truncate ${!notification.isRead ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                            {notification.title}
                          </p>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2 mt-0.5">
                            {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{notification.message}</p>
                        {notification.link && (
                          <Link to={notification.link} className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 mt-2 hover:underline">
                            View details <ExternalLink size={10} />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-2 bg-gray-50/80 border-t border-gray-100">
            <Link 
              to="/notifications" 
              onClick={() => setIsOpen(false)}
              className="block w-full py-2 text-center text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 rounded-lg transition-colors"
            >
              View All Notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
