import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Trash2, 
  CheckCheck,
  Search,
  Filter,
  ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { store } from '../services/store';
import { InAppNotification } from '../types';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

export const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setNotifications(store.getNotifications());
  }, []);

  const handleMarkAsRead = (id: string) => {
    store.markNotificationAsRead(id);
    setNotifications(store.getNotifications());
  };

  const handleMarkAllAsRead = () => {
    notifications.forEach(n => {
      if (!n.isRead) store.markNotificationAsRead(n.id);
    });
    setNotifications(store.getNotifications());
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="text-green-500" size={20} />;
      case 'warning': return <AlertTriangle className="text-yellow-500" size={20} />;
      case 'error': return <AlertCircle className="text-red-500" size={20} />;
      default: return <Info className="text-blue-500" size={20} />;
    }
  };

  const filteredNotifications = notifications
    .filter(n => filter === 'all' || !n.isRead)
    .filter(n => 
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      n.message.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500">Stay updated with your workshop activity</p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-2"
            >
              <CheckCheck size={16} /> Mark all as read
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-1.5 w-full sm:w-64 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
            <Search size={18} className="text-gray-400" />
            <input 
              type="text" 
              placeholder="Search notifications..." 
              className="border-none focus:ring-0 text-sm w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
            <button 
              onClick={() => setFilter('all')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filter === 'all' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              All {notifications.length > 0 && <span className="ml-1 opacity-60">({notifications.length})</span>}
            </button>
            <button 
              onClick={() => setFilter('unread')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filter === 'unread' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Unread {unreadCount > 0 && <span className="ml-1 text-red-500 font-bold">({unreadCount})</span>}
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {filteredNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-gray-400 mb-4">
                <Bell size={32} />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No notifications found</h3>
              <p className="text-gray-500 max-w-sm mx-auto mt-1">
                {searchQuery || filter === 'unread' 
                  ? "Try adjusting your filters or search query." 
                  : "You're all caught up! New notifications will appear here."}
              </p>
            </div>
          ) : (
            filteredNotifications.map((n) => (
              <div 
                key={n.id} 
                className={`p-6 hover:bg-gray-50 transition-colors flex gap-4 ${!n.isRead ? 'bg-blue-50/20' : ''}`}
              >
                <div className="mt-1 flex-shrink-0">
                  {getTypeIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h4 className={`text-base font-bold text-gray-900 truncate ${!n.isRead ? '' : 'font-semibold'}`}>
                        {n.title}
                      </h4>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
                      )}
                    </div>
                    <span className="text-sm text-gray-400 whitespace-nowrap">
                      {new Date(n.createdAt).toLocaleDateString()} at {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-gray-600 mt-1 leading-relaxed">
                    {n.message}
                  </p>
                  <div className="flex items-center mt-3 gap-4">
                    {n.link && (
                      <Link 
                        to={n.link} 
                        className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                      >
                        Action Required <ExternalLink size={14} />
                      </Link>
                    )}
                    {!n.isRead && (
                      <button 
                        onClick={() => handleMarkAsRead(n.id)}
                        className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;
