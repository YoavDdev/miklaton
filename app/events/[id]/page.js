'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const SEVERITY_MAP = {
  low: { label: 'נמוך', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: 'ℹ️' },
  medium: { label: 'בינוני', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: '⚠️' },
  high: { label: 'גבוה', color: 'bg-orange-100 text-orange-800 border-orange-300', icon: '🔶' },
  critical: { label: 'קריטי', color: 'bg-red-100 text-red-800 border-red-300', icon: '🚨' },
};

const ENTRY_TYPES = [
  { key: 'update', label: 'עדכון', icon: '📝', color: 'border-blue-400 bg-blue-50' },
  { key: 'urgent', label: 'דחוף', icon: '🔴', color: 'border-red-400 bg-red-50' },
  { key: 'decision', label: 'החלטה', icon: '⚖️', color: 'border-purple-400 bg-purple-50' },
  { key: 'task', label: 'משימה', icon: '✅', color: 'border-green-400 bg-green-50' },
];

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id;
  const journalEndRef = useRef(null);

  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [journal, setJournal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEntry, setNewEntry] = useState('');
  const [entryType, setEntryType] = useState('update');
  const [sending, setSending] = useState(false);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [showParticipants, setShowParticipants] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchEvent();
    fetchUserInfo();
  }, [eventId]);

  // Realtime subscriptions
  useEffect(() => {
    if (!eventId) return;

    const journalChannel = supabase
      .channel(`journal-${eventId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'event_journal',
        filter: `event_id=eq.${eventId}`,
      }, (payload) => {
        setJournal(prev => [...prev, payload.new]);
        setTimeout(() => journalEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      })
      .subscribe();

    const participantsChannel = supabase
      .channel(`participants-${eventId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'event_participants',
        filter: `event_id=eq.${eventId}`,
      }, () => {
        // Refetch participants on any change
        fetchParticipants();
      })
      .subscribe();

    const eventChannel = supabase
      .channel(`event-${eventId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'emergency_events',
        filter: `id=eq.${eventId}`,
      }, (payload) => {
        setEvent(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(journalChannel);
      supabase.removeChannel(participantsChannel);
      supabase.removeChannel(eventChannel);
    };
  }, [eventId]);

  // Auto-scroll on new entries
  useEffect(() => {
    if (journal.length > 0) {
      setTimeout(() => {
        journalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  }, [journal.length]);

  const fetchUserInfo = async () => {
    try {
      const res = await fetch('/api/auth/verify');
      if (res.ok) {
        const data = await res.json();
        setUserName(data.fullName || data.username || 'לא ידוע');
        setUserRole(data.role || '');
        setIsAdmin(data.role === 'admin');
      }
    } catch {}
  };

  const fetchEvent = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}`);
      const data = await res.json();
      if (data.success) {
        setEvent(data.data.event);
        setParticipants(data.data.participants);
        setJournal(data.data.journal);

        // Check if user is creator
        const authRes = await fetch('/api/auth/verify');
        if (authRes.ok) {
          const authData = await authRes.json();
          setIsCreator(data.data.event.created_by === authData.userId);
          setIsAdmin(authData.role === 'admin');
        }
      }
    } catch (error) {
      console.error('Failed to fetch event:', error);
    }
    setLoading(false);
  };

  const fetchParticipants = async () => {
    try {
      const res = await fetch(`/api/events/${eventId}`);
      const data = await res.json();
      if (data.success) {
        setParticipants(data.data.participants);
      }
    } catch {}
  };

  const handleSendEntry = async () => {
    if (!newEntry.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/events/${eventId}/journal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: userName,
          author_role: userRole,
          entry_type: entryType,
          content: newEntry.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewEntry('');
        setEntryType('update');
      }
    } catch (error) {
      console.error('Failed to send entry:', error);
    }
    setSending(false);
  };

  const handleCloseEvent = async () => {
    try {
      const res = await fetch('/api/events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eventId, status: 'closed' }),
      });
      const data = await res.json();
      if (data.success) {
        setEvent(data.data);
        setShowCloseConfirm(false);
      }
    } catch (error) {
      console.error('Failed to close event:', error);
    }
  };

  const copyInviteLink = () => {
    if (!event) return;
    const url = `${window.location.origin}/event/join/${event.invite_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const handlePrint = () => {
    if (!event) return;
    const sev = SEVERITY_MAP[event.severity] || SEVERITY_MAP.medium;

    const journalRows = journal.map(entry => {
      const time = new Date(entry.created_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const date = new Date(entry.created_at).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const typeLabel = ENTRY_TYPES.find(t => t.key === entry.entry_type)?.label || 'עדכון';
      const typeIcon = ENTRY_TYPES.find(t => t.key === entry.entry_type)?.icon || '📝';
      return `<tr>
        <td class="time-cell">${date}<br>${time}</td>
        <td class="author-cell">${entry.author_name}${entry.author_role ? `<br><span class="role">${entry.author_role}</span>` : ''}</td>
        <td class="type-cell">${typeIcon} ${typeLabel}</td>
        <td class="content-cell">${entry.content}</td>
      </tr>`;
    }).join('');

    const participantsList = participants
      .filter(p => p.status === 'confirmed')
      .map(p => `<li>${p.display_name}${p.department ? ` (${p.department})` : ''}${p.phone ? ` - ${p.phone}` : ''}</li>`)
      .join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <title>יומן אירוע - ${event.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; direction: rtl; max-width: 210mm; margin: 0 auto; padding: 8mm; font-size: 10px; }
    @page { margin: 8mm; size: A4 portrait; }
    h1 { font-size: 16px; text-align: center; margin-bottom: 2px; }
    .meta { font-size: 9px; color: #666; text-align: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #333; }
    .severity { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 9px; }
    .severity-critical { background: #fee; color: #c00; }
    .severity-high { background: #fff3e0; color: #e65100; }
    .severity-medium { background: #fffde7; color: #f57f17; }
    .severity-low { background: #e3f2fd; color: #1565c0; }
    .description { font-size: 10px; margin-bottom: 8px; padding: 4px 8px; background: #f5f5f5; border-radius: 4px; }
    h2 { font-size: 12px; margin: 8px 0 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { background: #333; color: white; padding: 4px 6px; text-align: right; font-size: 9px; }
    td { border: 1px solid #ccc; padding: 3px 6px; font-size: 9px; vertical-align: top; }
    .time-cell { width: 12%; white-space: nowrap; font-family: monospace; font-size: 8px; }
    .author-cell { width: 15%; font-weight: bold; }
    .type-cell { width: 10%; text-align: center; }
    .content-cell { width: 63%; }
    .role { font-weight: normal; font-size: 7px; color: #666; }
    ul { padding-right: 16px; font-size: 9px; }
    li { margin-bottom: 2px; }
    tr { page-break-inside: avoid; }
  </style>
</head>
<body>
  <h1>🚨 יומן אירוע חירום</h1>
  <div class="meta">
    <strong>${event.title}</strong> | 
    <span class="severity severity-${event.severity}">${sev.icon} ${sev.label}</span> | 
    נפתח: ${new Date(event.created_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })} ע"י ${event.created_by_name}
    ${event.status === 'closed' ? ` | נסגר: ${new Date(event.closed_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })} ע"י ${event.closed_by_name}` : ' | ⬤ פעיל'}
    <br>הופק: ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}
  </div>
  ${event.description ? `<div class="description">${event.description}</div>` : ''}
  
  <h2>👥 משתתפים (${participants.filter(p => p.status === 'confirmed').length})</h2>
  <ul>${participantsList}</ul>
  
  <h2>📋 יומן אירוע (${journal.length} רשומות)</h2>
  <table>
    <thead><tr><th>זמן</th><th>כותב</th><th>סוג</th><th>תוכן</th></tr></thead>
    <tbody>${journalRows}</tbody>
  </table>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateTime = (dateStr) => {
    return new Date(dateStr).toLocaleString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">🚨</div>
          <p className="text-lg text-gray-500 font-medium">טוען אירוע...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="text-5xl mb-4">❌</div>
          <p className="text-lg text-gray-500 font-medium">אירוע לא נמצא</p>
          <button onClick={() => router.push('/events')} className="mt-4 bg-red-600 text-white px-6 py-2 rounded-lg font-bold">
            חזרה לרשימה
          </button>
        </div>
      </div>
    );
  }

  const sev = SEVERITY_MAP[event.severity] || SEVERITY_MAP.medium;
  const confirmedCount = participants.filter(p => p.status === 'confirmed').length;

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden" dir="rtl">
      {/* Header */}
      <header className={`text-white shadow-lg ${event.status === 'active' ? 'bg-red-700' : 'bg-gray-600'}`}>
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {event.status === 'active' && <span className="w-3 h-3 bg-white rounded-full animate-pulse" />}
              <div>
                <h1 className="text-xl font-bold">{event.title}</h1>
                <div className="flex items-center gap-3 text-sm opacity-90 mt-0.5">
                  <span className={`text-xs px-2 py-0.5 rounded font-bold ${sev.color}`}>{sev.icon} {sev.label}</span>
                  <span>נפתח {formatDateTime(event.created_at)}</span>
                  <span>👥 {confirmedCount} משתתפים</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handlePrint} className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-1">
                🖨️ הדפס
              </button>
              <button
                onClick={copyInviteLink}
                className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-1"
              >
                {linkCopied ? '✅ הועתק!' : '🔗 העתק לינק הזמנה'}
              </button>
              <button
                onClick={() => setShowParticipants(!showParticipants)}
                className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg text-sm font-bold transition-colors"
              >
                👥 משתתפים
              </button>
              {event.status === 'active' && (isCreator || isAdmin) && (
                <button
                  onClick={() => setShowCloseConfirm(true)}
                  className="bg-gray-800 hover:bg-gray-900 px-3 py-2 rounded-lg text-sm font-bold transition-colors"
                >
                  🔒 סגור אירוע
                </button>
              )}
              <button onClick={() => router.push('/events')} className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg text-sm font-bold transition-colors">
                ← חזרה
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Description banner */}
      {event.description && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
          <p className="max-w-6xl mx-auto text-sm text-yellow-800">{event.description}</p>
        </div>
      )}

      <div className="flex-1 flex max-w-6xl mx-auto w-full min-h-0">
        {/* Journal - main area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Journal entries */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {journal.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-3">📋</div>
                <p className="font-medium">היומן ריק - הוסף את העדכון הראשון</p>
              </div>
            ) : (
              journal.map(entry => {
                const typeInfo = ENTRY_TYPES.find(t => t.key === entry.entry_type);
                const isSystem = entry.entry_type === 'system';

                if (isSystem) {
                  return (
                    <div key={entry.id} className="text-center py-1">
                      <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                        {entry.content} • {formatTime(entry.created_at)}
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={entry.id} className={`border-r-4 rounded-lg p-3 shadow-sm ${typeInfo?.color || 'border-gray-300 bg-white'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">{typeInfo?.icon}</span>
                        <span className="font-bold text-gray-900 text-sm">{entry.author_name}</span>
                        {entry.author_role && (
                          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">{entry.author_role}</span>
                        )}
                        <span className="text-xs bg-white/50 text-gray-500 px-2 py-0.5 rounded">{typeInfo?.label}</span>
                      </div>
                      <span className="text-xs text-gray-400 font-mono">{formatTime(entry.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap mt-1">{entry.content}</p>
                  </div>
                );
              })
            )}
            <div ref={journalEndRef} />
          </div>

          {/* Input area */}
          {event.status === 'active' ? (
            <div className="border-t bg-white p-4 shadow-lg">
              <div className="flex gap-2 mb-3">
                {ENTRY_TYPES.map(type => (
                  <button
                    key={type.key}
                    onClick={() => setEntryType(type.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      entryType === type.key
                        ? type.key === 'urgent' ? 'bg-red-600 text-white'
                        : type.key === 'decision' ? 'bg-purple-600 text-white'
                        : type.key === 'task' ? 'bg-green-600 text-white'
                        : 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {type.icon} {type.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <textarea
                  value={newEntry}
                  onChange={(e) => setNewEntry(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendEntry();
                    }
                  }}
                  placeholder="כתוב עדכון... (Enter לשליחה, Shift+Enter לשורה חדשה)"
                  rows={2}
                  className="flex-1 px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none resize-none text-sm"
                />
                <button
                  onClick={handleSendEntry}
                  disabled={!newEntry.trim() || sending}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold px-6 rounded-lg transition-colors flex items-center gap-1"
                >
                  {sending ? '⏳' : '📤'} שלח
                </button>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                כותב כ: <strong>{userName}</strong>
              </div>
            </div>
          ) : (
            <div className="border-t bg-gray-200 p-4 text-center">
              <p className="text-gray-500 font-bold">🔒 האירוע סגור - לא ניתן להוסיף עדכונים</p>
              <p className="text-gray-400 text-sm mt-1">נסגר ב-{formatDateTime(event.closed_at)} ע״י {event.closed_by_name}</p>
            </div>
          )}
        </div>

        {/* Participants sidebar */}
        {showParticipants && (
          <div className="w-72 border-r bg-white overflow-y-auto shadow-lg">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                👥 משתתפים ({confirmedCount})
              </h3>
            </div>
            <div className="p-3 space-y-2">
              {participants.map(p => (
                <div key={p.id} className={`text-sm p-2.5 rounded-lg border ${
                  p.status === 'confirmed' ? 'bg-green-50 border-green-200' :
                  p.status === 'declined' ? 'bg-red-50 border-red-200 opacity-60' :
                  'bg-gray-50 border-gray-200'
                }`}>
                  <div className="font-bold text-gray-900">{p.display_name}</div>
                  {p.department && <div className="text-xs text-gray-500">{p.department}</div>}
                  {p.role && <div className="text-xs text-gray-400">{p.role}</div>}
                  {p.phone && <div className="text-xs text-gray-400" dir="ltr">{p.phone}</div>}
                  <div className="text-xs mt-1">
                    {p.status === 'confirmed' ? '✅ אישר' : p.status === 'declined' ? '❌ סירב' : '⏳ ממתין'}
                  </div>
                </div>
              ))}
              {participants.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-4">אין משתתפים עדיין</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Close confirmation modal */}
      {showCloseConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" dir="rtl">
            <h3 className="text-xl font-bold text-gray-900 mb-3">🔒 סגירת אירוע</h3>
            <p className="text-gray-600 mb-6">האם אתה בטוח שברצונך לסגור את האירוע? לא יהיה ניתן להוסיף עדכונים נוספים.</p>
            <div className="flex gap-3">
              <button
                onClick={handleCloseEvent}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors"
              >
                כן, סגור אירוע
              </button>
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 rounded-lg transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
