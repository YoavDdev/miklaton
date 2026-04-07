'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const SEVERITY_MAP = {
  low: { label: 'נמוך', color: 'bg-blue-100 text-blue-800', icon: 'ℹ️' },
  medium: { label: 'בינוני', color: 'bg-yellow-100 text-yellow-800', icon: '⚠️' },
  high: { label: 'גבוה', color: 'bg-orange-100 text-orange-800', icon: '🔶' },
  critical: { label: 'קריטי', color: 'bg-red-100 text-red-800', icon: '🚨' },
};

const ENTRY_TYPES = [
  { key: 'update', label: 'עדכון', icon: '📝', color: 'border-blue-400 bg-blue-50' },
  { key: 'urgent', label: 'דחוף', icon: '🔴', color: 'border-red-400 bg-red-50' },
  { key: 'decision', label: 'החלטה', icon: '⚖️', color: 'border-purple-400 bg-purple-50' },
  { key: 'task', label: 'משימה', icon: '✅', color: 'border-green-400 bg-green-50' },
];

export default function LiveJournalPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = params.token;
  const phone = searchParams.get('phone') || (typeof window !== 'undefined' ? localStorage.getItem('miklaton_phone') : '') || '';
  const journalEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const [event, setEvent] = useState(null);
  const [journal, setJournal] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [participant, setParticipant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newEntry, setNewEntry] = useState('');
  const [entryType, setEntryType] = useState('update');
  const [sending, setSending] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    initPage();
  }, [token, phone]);

  // Additive journal refresh (never removes entries)
  const refreshJournal = async (eid) => {
    try {
      const { data } = await supabase
        .from('event_journal').select('*').eq('event_id', eid).order('created_at', { ascending: true });
      if (data) {
        setJournal(prev => {
          const serverMap = new Map(data.map(e => [e.id, e]));
          const optimistic = prev.filter(e => e._optimistic && !serverMap.has(e.id));
          return [...data, ...optimistic];
        });
      }
    } catch {}
  };

  // Realtime
  useEffect(() => {
    if (!event?.id) return;
    const eventId = event.id;

    const channel = supabase
      .channel(`live-all-${eventId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'event_journal',
      }, (payload) => {
        if (payload.new.event_id === eventId) {
          setJournal(prev => {
            if (prev.find(j => j.id === payload.new.id)) return prev;
            const idx = prev.findIndex(j => j._optimistic && j.content === payload.new.content);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = payload.new;
              return updated;
            }
            return [...prev, payload.new];
          });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'emergency_events',
      }, (payload) => {
        if (payload.new.id === eventId) setEvent(payload.new);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'event_participants',
      }, async (payload) => {
        const rec = payload.new || payload.old;
        if (rec?.event_id === eventId) {
          const { data } = await supabase.from('event_participants').select('*').eq('event_id', eventId).order('joined_at');
          if (data) setParticipants(data);
        }
      })
      .subscribe();

    // Light additive polling every 10s
    const pollInterval = setInterval(() => refreshJournal(eventId), 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [event?.id]);

  useEffect(() => {
    if (journal.length > 0) {
      setTimeout(() => {
        journalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  }, [journal.length]);

  const initPage = async () => {
    setLoading(true);
    try {
      // First find event by token
      const { data: eventData, error: eventError } = await supabase
        .from('emergency_events')
        .select('*')
        .eq('invite_token', token)
        .single();

      if (eventError || !eventData) {
        setLoading(false);
        return;
      }

      setEvent(eventData);

      // Fetch journal and participants
      const [journalRes, participantsRes] = await Promise.all([
        supabase.from('event_journal').select('*').eq('event_id', eventData.id).order('created_at', { ascending: true }),
        supabase.from('event_participants').select('*').eq('event_id', eventData.id).order('joined_at'),
      ]);

      setJournal(journalRes.data || []);
      setParticipants(participantsRes.data || []);

      // Find current participant by phone
      if (phone) {
        const normalizedPhone = phone.replace(/[-\s]/g, '');
        const found = participantsRes.data?.find(p => p.phone?.replace(/[-\s]/g, '') === normalizedPhone);
        setParticipant(found || null);
      }
    } catch (error) {
      console.error('Failed to load event:', error);
    }
    setLoading(false);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('התמונה גדולה מדי (מקסימום 10MB)');
      return;
    }
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadImage = async () => {
    if (!selectedImage || !event) return null;
    const formData = new FormData();
    formData.append('file', selectedImage);
    formData.append('event_id', event.id);
    const res = await fetch('/api/events/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) return data.url;
    throw new Error(data.error || 'Upload failed');
  };

  const handleSendEntry = async () => {
    if ((!newEntry.trim() && !selectedImage) || sending || !participant) return;
    const content = newEntry.trim();
    const type = entryType;
    const hasImage = !!selectedImage;

    // Optimistic update
    const optimisticEntry = {
      id: `temp-${Date.now()}`,
      event_id: event.id,
      author_name: participant.display_name,
      author_role: participant.department || participant.role || '',
      entry_type: type,
      content: content || (hasImage ? '📷 תמונה' : ''),
      image_url: imagePreview || null,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setJournal(prev => [...prev, optimisticEntry]);
    setNewEntry('');
    setEntryType('update');
    removeImage();
    setSending(true);

    try {
      let imageUrl = null;
      if (hasImage) {
        setUploading(true);
        imageUrl = await uploadImage();
        setUploading(false);
      }

      const res = await fetch(`/api/events/${event.id}/journal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: participant.display_name,
          author_role: participant.department || participant.role || undefined,
          entry_type: type,
          content: content || (imageUrl ? '📷 תמונה' : ''),
          image_url: imageUrl,
          participant_id: participant.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setJournal(prev => prev.map(e => e.id === optimisticEntry.id ? data.data : e));
        setTimeout(() => refreshJournal(event.id), 1000);
      } else {
        setJournal(prev => prev.filter(e => e.id !== optimisticEntry.id));
        setNewEntry(content);
      }
    } catch (error) {
      console.error('Failed to send entry:', error);
      setUploading(false);
      setJournal(prev => prev.filter(e => e.id !== optimisticEntry.id));
      setNewEntry(content);
    }
    setSending(false);
  };

  const handlePrint = () => {
    if (!event) return;
    const sev = SEVERITY_MAP[event.severity] || SEVERITY_MAP.medium;

    const journalRows = journal.map(entry => {
      const time = new Date(entry.created_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const date = new Date(entry.created_at).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const typeInfo = ENTRY_TYPES.find(t => t.key === entry.entry_type);
      return `<tr>
        <td class="time-cell">${date}<br>${time}</td>
        <td class="author-cell">${entry.author_name}${entry.author_role ? `<br><span class="role">${entry.author_role}</span>` : ''}</td>
        <td class="type-cell">${typeInfo?.icon || '📝'} ${typeInfo?.label || 'עדכון'}</td>
        <td class="content-cell">${entry.content}</td>
      </tr>`;
    }).join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <title>יומן אירוע - ${event.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; direction: rtl; max-width: 210mm; margin: 0 auto; padding: 8mm; }
    @page { margin: 8mm; size: A4 portrait; }
    h1 { font-size: 16px; text-align: center; margin-bottom: 4px; }
    .meta { font-size: 9px; color: #666; text-align: center; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #333; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #333; color: white; padding: 4px 6px; text-align: right; font-size: 9px; }
    td { border: 1px solid #ccc; padding: 3px 6px; font-size: 9px; vertical-align: top; }
    .time-cell { width: 12%; white-space: nowrap; font-family: monospace; font-size: 8px; }
    .author-cell { width: 15%; font-weight: bold; }
    .type-cell { width: 10%; text-align: center; }
    .content-cell { width: 63%; }
    .role { font-weight: normal; font-size: 7px; color: #666; }
    tr { page-break-inside: avoid; }
  </style>
</head>
<body>
  <h1>🚨 יומן אירוע חירום - ${event.title}</h1>
  <div class="meta">
    ${sev.icon} ${sev.label} | נפתח: ${new Date(event.created_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })} 
    ${event.status === 'closed' ? `| נסגר: ${new Date(event.closed_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}` : '| ⬤ פעיל'}
    | ${journal.length} רשומות | הופק: ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}
  </div>
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">🚨</div>
          <p className="text-lg text-gray-500">טוען אירוע...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="text-5xl mb-4">❌</div>
          <p className="text-lg text-gray-500">אירוע לא נמצא</p>
        </div>
      </div>
    );
  }

  const sev = SEVERITY_MAP[event.severity] || SEVERITY_MAP.medium;
  const confirmedCount = participants.filter(p => p.status === 'confirmed').length;

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden" dir="rtl">
      {/* Header - mobile friendly */}
      <header className={`text-white shadow-lg ${event.status === 'active' ? 'bg-red-700' : 'bg-gray-600'}`}>
        <div className="max-w-4xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {event.status === 'active' && <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse flex-shrink-0" />}
              <div className="min-w-0">
                <h1 className="text-base font-bold truncate">{event.title}</h1>
                <div className="flex items-center gap-2 text-xs opacity-90 mt-0.5 flex-wrap">
                  <span className={`px-1.5 py-0.5 rounded font-bold ${sev.color}`}>{sev.icon} {sev.label}</span>
                  <span>👥 {confirmedCount}</span>
                  {participant && <span className="truncate">👤 {participant.display_name}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={handlePrint} className="bg-white/20 hover:bg-white/30 p-2 rounded-lg text-sm font-bold transition-colors">
                🖨️
              </button>
              <button onClick={() => setShowParticipants(!showParticipants)} className="bg-white/20 hover:bg-white/30 p-2 rounded-lg text-sm font-bold transition-colors">
                👥
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Participants panel */}
      {showParticipants && (
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-4xl mx-auto px-3 py-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-gray-700 text-sm">👥 משתתפים ({confirmedCount})</h3>
              <button onClick={() => setShowParticipants(false)} className="text-gray-400 text-xs">סגור</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {participants.filter(p => p.status === 'confirmed').map(p => (
                <span key={p.id} className="bg-green-50 border border-green-200 text-green-800 text-xs px-2 py-1 rounded-lg font-medium">
                  {p.display_name}{p.department ? ` (${p.department})` : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Journal */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-4xl mx-auto px-3 py-3 space-y-2">
          {journal.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">📋</div>
              <p className="font-medium">היומן ריק</p>
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
                    </div>
                    <span className="text-xs text-gray-400 font-mono">{formatTime(entry.created_at)}</span>
                  </div>
                  {entry.content && <p className="text-sm text-gray-800 whitespace-pre-wrap mt-1">{entry.content}</p>}
                  {entry.image_url && (
                    <div className="mt-2">
                      <img
                        src={entry.image_url}
                        alt="תמונה מצורפת"
                        className="max-w-full sm:max-w-xs rounded-lg border shadow-sm cursor-pointer"
                        onClick={() => window.open(entry.image_url, '_blank')}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={journalEndRef} />
        </div>
      </div>

      {/* Input area */}
      {event.status === 'active' && participant ? (
        <div className="border-t bg-white p-3 shadow-lg safe-area-bottom">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-1.5 mb-2 overflow-x-auto">
              {ENTRY_TYPES.map(type => (
                <button
                  key={type.key}
                  onClick={() => setEntryType(type.key)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
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
            {imagePreview && (
              <div className="mb-2 relative inline-block">
                <img src={imagePreview} alt="תצוגה מקדימה" className="h-20 rounded-lg border" />
                <button onClick={removeImage} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">✕</button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold px-3 rounded-lg transition-colors text-lg"
                title="צלם או בחר תמונה"
              >
                📷
              </button>
              <textarea
                value={newEntry}
                onChange={(e) => setNewEntry(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendEntry();
                  }
                }}
                placeholder="כתוב עדכון..."
                rows={2}
                className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none resize-none text-sm"
              />
              <button
                onClick={handleSendEntry}
                disabled={(!newEntry.trim() && !selectedImage) || sending}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold px-4 rounded-lg transition-colors"
              >
                {uploading ? '⏫' : sending ? '⏳' : '📤'}
              </button>
            </div>
          </div>
        </div>
      ) : event.status === 'closed' ? (
        <div className="border-t bg-gray-200 p-3 text-center">
          <p className="text-gray-500 font-bold text-sm">🔒 האירוע סגור</p>
        </div>
      ) : !participant ? (
        <div className="border-t bg-yellow-50 p-3 text-center">
          <p className="text-yellow-700 font-bold text-sm">צפייה בלבד - לא מזוהה כמשתתף</p>
          <button
            onClick={() => router.push(`/event/join/${token}`)}
            className="mt-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold px-6 py-2 rounded-lg text-sm transition-colors"
          >
            הצטרף לאירוע
          </button>
        </div>
      ) : null}
    </div>
  );
}
