'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const EVENT_TYPES = {
  general: { label: 'כללי', icon: '🚨' },
  rocket: { label: 'רסיס/נפילה', icon: '🚀' },
  earthquake: { label: 'רעידת אדמה', icon: '🌍' },
  fire: { label: 'שריפה', icon: '🔥' },
  mci: { label: 'רב נפגעים', icon: '🚑' },
  security: { label: 'ביטחוני', icon: '🛡️' },
};

const SEVERITY_MAP = {
  low: { label: 'נמוך', color: 'bg-blue-100 text-blue-800', icon: 'ℹ️' },
  medium: { label: 'בינוני', color: 'bg-yellow-100 text-yellow-800', icon: '⚠️' },
  high: { label: 'גבוה', color: 'bg-orange-100 text-orange-800', icon: '🔶' },
  critical: { label: 'קריטי', color: 'bg-red-100 text-red-800', icon: '🚨' },
};

const ROLE_REDIRECTS = {
  ceo: '/ceo',
  call_center_manager: '/call-center-manager',
  sector_manager: '/sector-manager',
  operator: '/operator',
  inspector: '/inspector',
  shelter_manager: '/shelter-manager',
  admin: '/admin/users',
};

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState('active');
  const [newEvent, setNewEvent] = useState({ title: '', description: '', severity: 'medium', event_type: 'general' });
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    fetchEvents();
    fetchUserRole();
  }, [filter]);

  const fetchUserRole = async () => {
    try {
      const res = await fetch('/api/auth/verify');
      if (res.ok) {
        const data = await res.json();
        setUserRole(data.role || '');
      }
    } catch {}
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events${filter ? `?status=${filter}` : ''}`);
      const data = await res.json();
      if (data.success) setEvents(data.data || []);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newEvent.title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEvent),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreate(false);
        setNewEvent({ title: '', description: '', severity: 'medium', event_type: 'general' });
        router.push(`/events/${data.data.id}`);
      }
    } catch (error) {
      console.error('Failed to create event:', error);
    }
    setCreating(false);
  };

  const handleDelete = async (id, title) => {
    if (!confirm(`למחוק את האירוע "${title}"?\nפעולה זו בלתי הפיכה!`)) return;
    try {
      const res = await fetch('/api/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setEvents(prev => prev.filter(e => e.id !== id));
      } else {
        alert(data.error || 'שגיאה במחיקה');
      }
    } catch {
      alert('שגיאה במחיקה');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-red-700 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">🚨 יומן אירועים</h1>
              <p className="text-red-200 text-xs sm:text-sm mt-0.5">מקלטון - יהוד-מונוסון</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowCreate(true)}
                className="bg-white text-red-700 hover:bg-red-50 font-bold px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg transition-colors flex items-center gap-1 sm:gap-2 shadow text-sm"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">פתח אירוע חדש</span>
                <span className="sm:hidden">+ חדש</span>
              </button>
              <button
                onClick={() => router.push(ROLE_REDIRECTS[userRole] || '/operator')}
                className="bg-red-800 hover:bg-red-900 p-2 sm:px-4 sm:py-2.5 rounded-lg font-semibold transition-colors text-sm"
              >
                ←<span className="hidden sm:inline"> חזרה</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'active', label: '🔴 פעילים' },
            { key: 'closed', label: '📁 ארכיון' },
            { key: '', label: '📋 הכל' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                filter === tab.key
                  ? 'bg-red-700 text-white shadow'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Events list */}
        {loading ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-4xl mb-3 animate-pulse">⏳</div>
            <p className="text-lg font-medium">טוען אירועים...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-lg font-medium">
              {filter === 'active' ? 'אין אירועים פעילים' : filter === 'closed' ? 'אין אירועים בארכיון' : 'אין אירועים'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map(event => {
              const sev = SEVERITY_MAP[event.severity] || SEVERITY_MAP.medium;
              return (
                <div
                  key={event.id}
                  onClick={() => router.push(`/events/${event.id}`)}
                  className={`bg-white rounded-xl shadow-sm border-2 p-5 cursor-pointer hover:shadow-md transition-all ${
                    event.status === 'active' ? 'border-red-300 hover:border-red-400' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {event.status === 'active' && (
                          <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                        )}
                        <h3 className="text-lg font-bold text-gray-900">{event.title}</h3>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${sev.color}`}>
                          {sev.icon} {sev.label}
                        </span>
                      </div>
                      {event.description && (
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{event.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>נפתח: {formatDate(event.created_at)}</span>
                        <span>ע״י: {event.created_by_name}</span>
                        {event.status === 'closed' && (
                          <span className="text-gray-400">נסגר: {formatDate(event.closed_at)}</span>
                        )}
                      </div>
                    </div>
                    <div className="mr-4 flex items-center gap-2">
                      {event.status === 'active' ? (
                        <span className="bg-red-100 text-red-700 text-sm px-3 py-1.5 rounded-lg font-bold">פעיל</span>
                      ) : (
                        <>
                          <span className="bg-gray-100 text-gray-600 text-sm px-3 py-1.5 rounded-lg font-bold">סגור</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(event.id, event.title);
                            }}
                            className="bg-red-50 hover:bg-red-100 text-red-600 text-sm p-1.5 rounded-lg transition-colors"
                            title="מחק אירוע"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" dir="rtl">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                🚨 פתיחת אירוע חירום חדש
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">כותרת האירוע *</label>
                  <input
                    type="text"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder="לדוגמה: אזעקה באזור יהוד"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-lg"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">תיאור</label>
                  <textarea
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    placeholder="פרטים נוספים על האירוע..."
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">סוג אירוע</label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(EVENT_TYPES).map(([key, val]) => (
                      <button
                        key={key}
                        onClick={() => setNewEvent({ ...newEvent, event_type: key })}
                        className={`py-2 rounded-lg text-sm font-bold transition-all border-2 ${
                          newEvent.event_type === key
                            ? 'bg-gray-800 text-white border-gray-800'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {val.icon} {val.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">רמת חומרה</label>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(SEVERITY_MAP).map(([key, val]) => (
                      <button
                        key={key}
                        onClick={() => setNewEvent({ ...newEvent, severity: key })}
                        className={`py-2.5 rounded-lg text-sm font-bold transition-all border-2 ${
                          newEvent.severity === key
                            ? key === 'critical' ? 'bg-red-600 text-white border-red-600'
                            : key === 'high' ? 'bg-orange-500 text-white border-orange-500'
                            : key === 'medium' ? 'bg-yellow-500 text-white border-yellow-500'
                            : 'bg-blue-500 text-white border-blue-500'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {val.icon} {val.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCreate}
                  disabled={!newEvent.title.trim() || creating}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition-colors text-lg"
                >
                  {creating ? 'פותח אירוע...' : '🚨 פתח אירוע'}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg transition-colors"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
