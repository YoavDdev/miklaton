'use client';
import { useState, useEffect } from 'react';

export default function ReadOnlyNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await fetch('/api/notifications');
      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeStyle = (type) => {
    switch(type) {
      case 'urgent':
        return 'bg-red-600 text-white border-red-700';
      case 'warning':
        return 'bg-yellow-100 text-yellow-900 border-yellow-500';
      case 'info':
      default:
        return 'bg-blue-100 text-blue-900 border-blue-500';
    }
  };

  const getTypeIcon = (type) => {
    switch(type) {
      case 'urgent':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          📢 הודעות והנחיות כלליות
        </h2>
        <button
          onClick={loadNotifications}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
        >
          🔄 רענן
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-300 rounded w-1/3 mx-auto"></div>
          </div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-lg">אין הודעות כלליות כרגע</p>
          <p className="text-sm mt-2">ההודעות מתעדכנות אוטומטית כל 10 שניות</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`rounded-lg p-4 border-r-4 ${getTypeStyle(notification.type)}`}
            >
              <div className="flex items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{getTypeIcon(notification.type)}</span>
                    <h3 className="font-bold text-lg">{notification.title}</h3>
                  </div>
                  <p className="whitespace-pre-wrap mb-2 text-base leading-relaxed">{notification.message}</p>
                  <div className="text-sm opacity-75">
                    <span>פורסם על ידי: {notification.author}</span>
                    <span className="mx-2">•</span>
                    <span>{new Date(notification.created_at).toLocaleString('he-IL')}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
