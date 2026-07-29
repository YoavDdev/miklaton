'use client';
import { useState, useEffect } from 'react';

// Operator-facing notifications board: operators can add and delete messages
// that show for everyone (and on the /screen display), via /api/notifications.
export default function OperatorNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [sending, setSending] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!title.trim() || !message.trim()) {
      alert('יש למלא כותרת ותוכן');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          type: urgent ? 'urgent' : 'info',
          author: 'מוקדן'
        })
      });
      const data = await res.json();
      if (data.success) {
        setTitle('');
        setMessage('');
        setUrgent(false);
        setShowForm(false);
        loadNotifications();
      } else {
        alert('שגיאה: ' + (data.error || 'לא ניתן לפרסם'));
      }
    } catch {
      alert('שגיאת תקשורת');
    }
    setSending(false);
  };

  const handleDelete = async (id, msgTitle) => {
    if (!confirm(`למחוק את ההודעה "${msgTitle}"?`)) return;
    try {
      const res = await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setNotifications(prev => prev.filter(n => n.id !== id));
      } else {
        alert('שגיאה במחיקה');
      }
    } catch {
      alert('שגיאת תקשורת');
    }
  };

  const typeStyle = (type) => {
    switch (type) {
      case 'urgent': return 'bg-red-600 text-white border-red-700';
      case 'warning': return 'bg-yellow-100 text-yellow-900 border-yellow-500';
      default: return 'bg-blue-100 text-blue-900 border-blue-500';
    }
  };
  const typeIcon = (type) => (type === 'urgent' ? '🚨' : type === 'warning' ? '⚠️' : 'ℹ️');

  return (
    <div className="space-y-3" dir="rtl">
      {/* Add message toggle / form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors"
        >
          ＋ הוסף הודעה
        </button>
      ) : (
        <div className="bg-gray-50 border-2 border-blue-200 rounded-lg p-3 space-y-2">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="כותרת ההודעה"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
          />
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={3}
            placeholder="תוכן ההודעה..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none text-gray-900"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} className="w-4 h-4" />
            🔴 הודעה דחופה
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={sending}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-60"
            >
              {sending ? 'מפרסם...' : '📤 פרסם לכולם'}
            </button>
            <button
              onClick={() => { setShowForm(false); setTitle(''); setMessage(''); setUrgent(false); }}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-4 text-gray-400 text-sm">טוען...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-4 text-gray-500 text-sm">אין הודעות כרגע</div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {notifications.map(n => (
            <div key={n.id} className={`rounded-lg p-3 border-r-4 ${typeStyle(n.type)}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 mb-1 flex-1 min-w-0">
                  <span>{typeIcon(n.type)}</span>
                  <h3 className="font-bold text-sm truncate">{n.title}</h3>
                </div>
                <button
                  onClick={() => handleDelete(n.id, n.title)}
                  className="text-lg leading-none opacity-70 hover:opacity-100 shrink-0"
                  title="מחק הודעה"
                >
                  🗑️
                </button>
              </div>
              <p className="text-xs opacity-90 whitespace-pre-wrap">{n.message}</p>
              <div className="text-[11px] opacity-75 mt-1">
                {n.author} • {new Date(n.created_at).toLocaleString('he-IL')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
