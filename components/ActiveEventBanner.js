'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const SEVERITY_MAP = {
  low: { label: 'נמוך', color: 'bg-blue-600', icon: 'ℹ️' },
  medium: { label: 'בינוני', color: 'bg-yellow-600', icon: '⚠️' },
  high: { label: 'גבוה', color: 'bg-orange-600', icon: '🔶' },
  critical: { label: 'קריטי', color: 'bg-red-700', icon: '🚨' },
};

export default function ActiveEventBanner() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', description: '', severity: 'medium', event_type: 'general' });
  const toastIdRef = useRef(0);
  const knownEntryIdsRef = useRef(new Set());
  const seededEventsRef = useRef(new Set());

  useEffect(() => {
    fetchActiveEvents();

    // Poll for active events (and their journal) every 30s instead of realtime
    const interval = setInterval(fetchActiveEvents, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchActiveEvents = async () => {
    try {
      const res = await fetch('/api/events?status=active');
      const { data } = await res.json();
      const activeEvents = data || [];
      setEvents(activeEvents);

      if (activeEvents.length === 0) return;

      // Fetch details (including journal) for each active event in the same tick
      for (const ev of activeEvents) {
        try {
          const detailRes = await fetch(`/api/events/${ev.id}`);
          const detailJson = await detailRes.json();
          if (!detailJson.success) continue;

          const journal = detailJson.data.journal || [];
          // Last-seen entries are tracked per-event so we only toast for entries
          // that arrived since the previous poll, not every historical entry
          // the first time we see a given event (avoids a toast flood when a
          // new event with pre-existing journal entries becomes active).
          const isFirstSightingOfEvent = !seededEventsRef.current.has(ev.id);

          journal.forEach(entry => {
            if (knownEntryIdsRef.current.has(entry.id)) return;
            knownEntryIdsRef.current.add(entry.id);

            // Skip toasting for entries discovered the first time we see this event
            if (isFirstSightingOfEvent) return;
            if (entry.entry_type === 'system') return;

            const id = ++toastIdRef.current;
            const typeIcon = entry.entry_type === 'urgent' ? '🔴' : entry.entry_type === 'task' ? '✅' : entry.entry_type === 'location' ? '📍' : entry.entry_type === 'map_marker' ? '🗺️' : '📝';
            setToasts(prev => [...prev, {
              id,
              text: `${typeIcon} ${entry.author_name}: ${entry.content?.slice(0, 60) || 'עדכון חדש'}`,
              eventTitle: ev.title,
            }]);

            // Auto-dismiss after 5 seconds
            setTimeout(() => {
              setToasts(prev => prev.filter(t => t.id !== id));
            }, 5000);
          });

          seededEventsRef.current.add(ev.id);
        } catch {}
      }
    } catch {}
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
        setShowCreateModal(false);
        setNewEvent({ title: '', description: '', severity: 'medium', event_type: 'general' });
        router.push(`/events/${data.data.id}`);
      }
    } catch {}
    setCreating(false);
  };

  const formatTime = (d) => new Date(d).toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit',
  });

  if (events.length === 0 && toasts.length === 0 && !showCreateModal) {
    return null;
  }

  return (
    <>
      {/* Toast notifications */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-[90%] max-w-md" dir="rtl">
        {toasts.map(t => (
          <div
            key={t.id}
            className="bg-gray-900 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 animate-slideDown border border-gray-700"
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-400 font-medium mb-0.5">{t.eventTitle}</div>
              <div className="text-sm font-medium truncate">{t.text}</div>
            </div>
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
          </div>
        ))}
      </div>

      {/* Active events banner */}
      {events.length > 0 && (
        <div className="bg-red-600 text-white" dir="rtl">
          {events.map(ev => {
            const sev = SEVERITY_MAP[ev.severity] || SEVERITY_MAP.medium;
            return (
              <div key={ev.id} className="max-w-7xl mx-auto px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="animate-pulse text-lg">🚨</span>
                  <span className="font-bold text-sm sm:text-base truncate">אירוע פעיל: {ev.title}</span>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded hidden sm:inline">{sev.icon} {sev.label}</span>
                  <span className="text-xs text-red-200 hidden sm:inline">• {formatTime(ev.created_at)}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => router.push(`/events/${ev.id}`)}
                    className="bg-white text-red-700 hover:bg-red-50 font-bold px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-colors shadow"
                  >
                    🔗 כניסה לאירוע
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create event modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">🚨 פתיחת אירוע חדש</h3>
            <div className="space-y-3">
              <input
                value={newEvent.title}
                onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))}
                placeholder="שם האירוע"
                className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-right focus:border-red-500 outline-none"
              />
              <textarea
                value={newEvent.description}
                onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))}
                placeholder="תיאור (אופציונלי)"
                className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-right focus:border-red-500 outline-none resize-none"
                rows={2}
              />
              <div className="flex gap-3">
                <select
                  value={newEvent.severity}
                  onChange={e => setNewEvent(p => ({ ...p, severity: e.target.value }))}
                  className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-2.5 text-right focus:border-red-500 outline-none"
                >
                  <option value="low">ℹ️ נמוך</option>
                  <option value="medium">⚠️ בינוני</option>
                  <option value="high">🔶 גבוה</option>
                  <option value="critical">🚨 קריטי</option>
                </select>
                <select
                  value={newEvent.event_type}
                  onChange={e => setNewEvent(p => ({ ...p, event_type: e.target.value }))}
                  className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-2.5 text-right focus:border-red-500 outline-none"
                >
                  <option value="general">🚨 כללי</option>
                  <option value="rocket">🚀 רסיס/נפילה</option>
                  <option value="earthquake">🌍 רעידת אדמה</option>
                  <option value="fire">🔥 שריפה</option>
                  <option value="mci">🚑 רב נפגעים</option>
                  <option value="security">🛡️ ביטחוני</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleCreate}
                disabled={creating || !newEvent.title.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-lg disabled:opacity-50 transition-colors"
              >
                {creating ? '⏳ פותח...' : '🚨 פתח אירוע'}
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700 transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS animation */}
      <style jsx>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
