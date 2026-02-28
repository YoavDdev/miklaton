'use client';
import { useState } from 'react';

export default function GeneralNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newNotification, setNewNotification] = useState({
    title: '',
    message: '',
    type: 'info', // info, warning, urgent
    author: 'מוקדן'
  });

  const addNotification = () => {
    if (!newNotification.title || !newNotification.message) {
      alert('נא למלא כותרת ותוכן ההודעה');
      return;
    }

    const notification = {
      id: Date.now(),
      ...newNotification,
      timestamp: new Date().toISOString()
    };

    setNotifications([notification, ...notifications]);
    setNewNotification({ title: '', message: '', type: 'info', author: 'מוקדן' });
    setShowForm(false);
  };

  const deleteNotification = (id) => {
    if (confirm('האם למחוק הודעה זו?')) {
      setNotifications(notifications.filter(n => n.id !== id));
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
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
        >
          {showForm ? '✕ ביטול' : '➕ הוסף הודעה'}
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4 border-2 border-blue-300">
          <h3 className="font-bold text-lg mb-3">הודעה חדשה</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-bold mb-1">כותרת ההודעה:</label>
              <input
                type="text"
                value={newNotification.title}
                onChange={(e) => setNewNotification({...newNotification, title: e.target.value})}
                className="w-full p-2 border rounded-lg"
                placeholder="לדוגמה: פתיחת מקלטים ציבוריים"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">תוכן ההודעה:</label>
              <textarea
                value={newNotification.message}
                onChange={(e) => setNewNotification({...newNotification, message: e.target.value})}
                className="w-full p-2 border rounded-lg h-24"
                placeholder="הנחיות מפורטות למוקדנים..."
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">סוג הודעה:</label>
              <select
                value={newNotification.type}
                onChange={(e) => setNewNotification({...newNotification, type: e.target.value})}
                className="w-full p-2 border rounded-lg"
              >
                <option value="info">מידע כללי</option>
                <option value="warning">אזהרה</option>
                <option value="urgent">דחוף</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">שם המפרסם:</label>
              <input
                type="text"
                value={newNotification.author}
                onChange={(e) => setNewNotification({...newNotification, author: e.target.value})}
                className="w-full p-2 border rounded-lg"
                placeholder="שם המוקדן"
              />
            </div>

            <button
              onClick={addNotification}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition-colors"
            >
              ✓ פרסם הודעה
            </button>
          </div>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-lg">אין הודעות כלליות כרגע</p>
          <p className="text-sm mt-2">לחץ על "הוסף הודעה" לפרסום הנחיות למוקדנים</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`rounded-lg p-4 border-r-4 ${getTypeStyle(notification.type)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{getTypeIcon(notification.type)}</span>
                    <h3 className="font-bold text-lg">{notification.title}</h3>
                  </div>
                  <p className="whitespace-pre-wrap mb-2">{notification.message}</p>
                  <div className="text-sm opacity-75">
                    <span>פורסם על ידי: {notification.author}</span>
                    <span className="mx-2">•</span>
                    <span>{new Date(notification.timestamp).toLocaleString('he-IL')}</span>
                  </div>
                </div>
                <button
                  onClick={() => deleteNotification(notification.id)}
                  className="text-red-600 hover:text-red-800 font-bold ml-2"
                  title="מחק הודעה"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
