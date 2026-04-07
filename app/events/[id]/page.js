'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';
import sheltersData from '@/data/shelters.json';

const EventMap = dynamic(() => import('@/components/EventMap'), { ssr: false });

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
  { key: 'urgent', label: 'דחוף', icon: '🔴', color: 'border-red-400 bg-red-50' },
  { key: 'task', label: 'משימה', icon: '✅', color: 'border-green-400 bg-green-50' },
];

const EVENT_TYPES = {
  general: { label: 'כללי', icon: '🚨', quickMessages: ['הגעתי לשטח', 'האזור נקי', 'צריך תגבורת', 'יש נפגעים', 'מפנים אזרחים'] },
  rocket: { label: 'רסיס/נפילה', icon: '🚀', quickMessages: ['נשמע פיצוץ', 'יש נזק ישיר', 'תושבים במקלטים', 'האזור נקי מרסיס', 'נמצא רסיס', 'אין נפגעים', 'מפנים אזרחים'] },
  earthquake: { label: 'רעידת אדמה', icon: '🌍', quickMessages: ['הגעתי לשטח', 'יש מבנה פגוע', 'לכודים תחת הריסות', 'צריך חילוץ', 'אזור מסוכן', 'מפנים אזרחים'] },
  fire: { label: 'שריפה', icon: '🔥', quickMessages: ['הגעתי לשטח', 'כיבוי הוזעקו', 'מפנים אזרחים', 'האש תחת שליטה', 'צריך תגבורת'] },
  mci: { label: 'אירוע רב נפגעים', icon: '🚑', quickMessages: ['הגעתי לשטח', 'יש נפגעים', 'אמבולנס הגיע', 'מטופל במקום', 'צריך ציוד נוסף', 'מפנים לבית חולים'] },
  security: { label: 'אירוע ביטחוני', icon: '🛡️', quickMessages: ['הגעתי לשטח', 'אזור לא מאובטח', 'משטרה במקום', 'צריך תגבורת', 'האזור נקי'] },
};

const TASK_STATUS = {
  pending: { label: 'ממתין', icon: '⏳', color: 'bg-yellow-100 text-yellow-700' },
  done: { label: 'הושלם', icon: '✅', color: 'bg-green-100 text-green-700' },
};

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id;
  const journalEndRef = useRef(null);
  const fileInputRef = useRef(null);

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
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showQuickMessages, setShowQuickMessages] = useState(false);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    fetchEvent();
    fetchUserInfo();
  }, [eventId]);

  // Refresh journal from Supabase directly (additive only - never removes entries)
  const refreshJournal = async () => {
    try {
      const { data } = await supabase
        .from('event_journal').select('*').eq('event_id', eventId).order('created_at', { ascending: true });
      if (data) {
        setJournal(prev => {
          // Build map of server entries by id
          const serverMap = new Map(data.map(e => [e.id, e]));
          // Keep optimistic entries that server doesn't have yet
          const optimistic = prev.filter(e => e._optimistic && !serverMap.has(e.id));
          return [...data, ...optimistic];
        });
      }
    } catch {}
  };

  // Realtime subscriptions
  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`event-all-${eventId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'event_journal',
      }, (payload) => {
        if (payload.new.event_id === eventId) {
          setJournal(prev => {
            if (prev.find(j => j.id === payload.new.id)) return prev;
            // Replace optimistic with real
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
        table: 'event_journal',
      }, (payload) => {
        if (payload.new.event_id === eventId) {
          setJournal(prev => prev.map(j => j.id === payload.new.id ? payload.new : j));
        }
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
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'emergency_events',
      }, (payload) => {
        if (payload.new.id === eventId) setEvent(payload.new);
      })
      .subscribe();

    // Light polling - only additive, every 10s
    const pollInterval = setInterval(() => refreshJournal(), 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
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
      const res = await fetch('/api/auth/verify', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        let name = data.fullName || data.username || '';
        // If still empty, fetch from user_profiles
        if (!name && data.userId) {
          const { data: profile } = await supabase
            .from('user_profiles').select('full_name').eq('id', data.userId).single();
          name = profile?.full_name || '';
        }
        setUserName(name || 'משתמש');
        setUserRole(data.role || '');
        setIsAdmin(data.role === 'admin' || data.isAdmin);
        return data;
      }
    } catch {}
    return null;
  };

  const fetchEvent = async () => {
    setLoading(true);
    try {
      // Load directly from Supabase - no caching issues
      const [eventRes, journalRes, participantsRes] = await Promise.all([
        supabase.from('emergency_events').select('*').eq('id', eventId).single(),
        supabase.from('event_journal').select('*').eq('event_id', eventId).order('created_at', { ascending: true }),
        supabase.from('event_participants').select('*').eq('event_id', eventId).order('joined_at'),
      ]);

      if (eventRes.data) {
        setEvent(eventRes.data);
        setJournal(journalRes.data || []);
        setParticipants(participantsRes.data || []);

        // Check if user is creator
        const authRes = await fetch('/api/auth/verify', { cache: 'no-store' });
        if (authRes.ok) {
          const authData = await authRes.json();
          setIsCreator(eventRes.data.created_by === authData.userId);
          setIsAdmin(authData.role === 'admin' || authData.isAdmin);
        }
      }
    } catch (error) {
      console.error('Failed to fetch event:', error);
    }
    setLoading(false);
  };

  const fetchParticipants = async () => {
    try {
      const { data } = await supabase
        .from('event_participants').select('*').eq('event_id', eventId).order('joined_at');
      if (data) setParticipants(data);
    } catch {}
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
    if (!selectedImage) return null;
    const formData = new FormData();
    formData.append('file', selectedImage);
    formData.append('event_id', eventId);
    const res = await fetch('/api/events/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) return data.url;
    throw new Error(data.error || 'Upload failed');
  };

  const handleSendEntry = async () => {
    if ((!newEntry.trim() && !selectedImage) || sending) return;
    const content = newEntry.trim();
    const type = entryType;
    const hasImage = !!selectedImage;
    
    // Show immediately (optimistic)
    const tempId = `temp-${Date.now()}`;
    setJournal(prev => [...prev, {
      id: tempId, event_id: eventId, author_name: userName, author_role: userRole,
      entry_type: type, content: content || (hasImage ? '📷 תמונה' : ''), image_url: imagePreview || null,
      task_status: type === 'task' ? 'pending' : null,
      created_at: new Date().toISOString(), _optimistic: true,
    }]);
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

      const res = await fetch(`/api/events/${eventId}/journal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: userName, author_role: userRole, entry_type: type,
          content: content || (imageUrl ? '📷 תמונה' : ''),
          image_url: imageUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setJournal(prev => prev.map(e => e.id === tempId ? data.data : e));
        setTimeout(() => refreshJournal(), 1000);
      } else {
        setJournal(prev => prev.filter(e => e.id !== tempId));
        setNewEntry(content);
        alert('שגיאה: ' + (data.error || 'לא ניתן לשלוח'));
      }
    } catch (error) {
      console.error('Failed to send entry:', error);
      setUploading(false);
      setJournal(prev => prev.filter(e => e.id !== tempId));
      setNewEntry(content);
    }
    setSending(false);
  };

  const sendQuickMessage = async (msg) => {
    setShowQuickMessages(false);
    const tempId = `temp-${Date.now()}`;
    setJournal(prev => [...prev, {
      id: tempId, event_id: eventId, author_name: userName, author_role: userRole,
      entry_type: 'quick', content: msg, created_at: new Date().toISOString(), _optimistic: true,
    }]);
    try {
      const res = await fetch(`/api/events/${eventId}/journal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author_name: userName, author_role: userRole, entry_type: 'quick', content: msg }),
      });
      const data = await res.json();
      if (data.success) setJournal(prev => prev.map(e => e.id === tempId ? data.data : e));
      else setJournal(prev => prev.filter(e => e.id !== tempId));
    } catch { setJournal(prev => prev.filter(e => e.id !== tempId)); }
  };

  const shareLocation = () => {
    if (!navigator.geolocation) { alert('הדפדפן לא תומך במיקום'); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const content = `📍 שיתף מיקום`;
      const tempId = `temp-${Date.now()}`;
      setJournal(prev => [...prev, {
        id: tempId, event_id: eventId, author_name: userName, author_role: userRole,
        entry_type: 'location', content, location_lat: latitude, location_lng: longitude,
        created_at: new Date().toISOString(), _optimistic: true,
      }]);
      try {
        const res = await fetch(`/api/events/${eventId}/journal`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author_name: userName, author_role: userRole, entry_type: 'location', content, location_lat: latitude, location_lng: longitude }),
        });
        const data = await res.json();
        if (data.success) setJournal(prev => prev.map(e => e.id === tempId ? data.data : e));
      } catch {}
    }, (err) => {
      if (err.code === 1) alert('גישת מיקום נחסמה. אנא אפשר מיקום בהגדרות הדפדפן ונסה שוב.');
      else alert('לא הצלחנו לקבל מיקום. נסה שוב בעוד רגע.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  };

  const togglePin = async (entryId, currentPinned) => {
    setJournal(prev => prev.map(e => e.id === entryId ? { ...e, is_pinned: !currentPinned } : e));
    await supabase.from('event_journal').update({ is_pinned: !currentPinned }).eq('id', entryId);
  };

  const completeTask = async (entryId) => {
    if (!confirm('סיימת את המשימה?')) return;
    setJournal(prev => prev.map(e => e.id === entryId ? { ...e, task_status: 'done', assigned_to: userName } : e));
    await supabase.from('event_journal').update({ task_status: 'done', assigned_to: userName }).eq('id', entryId);
  };

  const addMapMarker = async (lat, lng, note) => {
    const tempId = `temp-${Date.now()}`;
    setJournal(prev => [...prev, {
      id: tempId, event_id: eventId, author_name: userName, author_role: userRole,
      entry_type: 'map_marker', content: note, location_lat: lat, location_lng: lng,
      created_at: new Date().toISOString(), _optimistic: true,
    }]);
    try {
      const res = await fetch(`/api/events/${eventId}/journal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author_name: userName, author_role: userRole, entry_type: 'map_marker', content: note, location_lat: lat, location_lng: lng }),
      });
      const data = await res.json();
      if (data.success) setJournal(prev => prev.map(e => e.id === tempId ? data.data : e));
    } catch {}
  };

  const generateSummary = () => {
    const duration = Math.round((Date.now() - new Date(event.created_at).getTime()) / 60000);
    const hrs = Math.floor(duration / 60);
    const mins = duration % 60;
    const durationStr = hrs > 0 ? `${hrs} שעות ו-${mins} דקות` : `${mins} דקות`;
    const decisions = journal.filter(e => e.entry_type === 'decision');
    const urgents = journal.filter(e => e.entry_type === 'urgent');
    const tasks = journal.filter(e => e.entry_type === 'task');
    const tasksDone = tasks.filter(e => e.task_status === 'done');
    const images = journal.filter(e => e.image_url);
    const locations = journal.filter(e => e.entry_type === 'location');
    const uniqueAuthors = [...new Set(journal.map(e => e.author_name))];

    let summary = `📊 סיכום אירוע: ${event.title}\n`;
    summary += `⏱ משך: ${durationStr}\n`;
    summary += `👥 משתתפים: ${confirmedCount} | עדכונים: ${journal.length}\n`;
    summary += `📝 כותבים: ${uniqueAuthors.join(', ')}\n`;
    if (urgents.length > 0) summary += `🔴 הודעות דחופות: ${urgents.length}\n`;
    if (decisions.length > 0) summary += `⚖️ החלטות: ${decisions.length}\n`;
    if (tasks.length > 0) summary += `✅ משימות: ${tasksDone.length}/${tasks.length} הושלמו\n`;
    if (images.length > 0) summary += `📷 תמונות: ${images.length}\n`;
    if (locations.length > 0) summary += `📍 שיתופי מיקום: ${locations.length}\n`;
    if (decisions.length > 0) {
      summary += `\n⚖️ החלטות שהתקבלו:\n`;
      decisions.forEach(d => { summary += `  • ${d.content} (${d.author_name}, ${formatTime(d.created_at)})\n`; });
    }
    return summary;
  };

  const handleCloseEvent = async () => {
    try {
      const summary = generateSummary();
      await supabase.from('emergency_events').update({ summary }).eq('id', eventId);

      const res = await fetch('/api/events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eventId, status: 'closed' }),
      });
      const data = await res.json();
      if (data.success) {
        setEvent({ ...data.data, summary });
        setShowCloseConfirm(false);
      }
    } catch (error) {
      console.error('Failed to close event:', error);
    }
  };

  const copyInviteLink = () => {
    if (!event) return;
    const sev = SEVERITY_MAP[event.severity] || SEVERITY_MAP.medium;
    const url = `${window.location.origin}/event/join/${event.invite_token}`;
    const time = new Date(event.created_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    const message = `🚨 הזמנה לאירוע חירום\n\n📋 ${event.title}\n${sev.icon} רמת חומרה: ${sev.label}\n🕐 נפתח: ${time}\n${event.description ? `📝 ${event.description}\n` : ''}\n👉 להצטרפות: ${url}`;
    navigator.clipboard.writeText(message).then(() => {
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
      {/* Header - mobile friendly */}
      <header className={`text-white shadow-lg ${event.status === 'active' ? 'bg-red-700' : 'bg-gray-600'}`}>
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {event.status === 'active' && <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse flex-shrink-0" />}
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold truncate">{event.title}</h1>
                <div className="flex items-center gap-2 text-xs opacity-90 mt-0.5 flex-wrap">
                  <span className={`px-1.5 py-0.5 rounded font-bold ${sev.color}`}>{sev.icon} {sev.label}</span>
                  <span className="hidden sm:inline">נפתח {formatDateTime(event.created_at)}</span>
                  <span>👥 {confirmedCount}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <button onClick={handlePrint} className="bg-white/20 hover:bg-white/30 p-2 sm:px-3 sm:py-2 rounded-lg text-sm font-bold transition-colors" title="הדפס">
                🖨️<span className="hidden sm:inline"> הדפס</span>
              </button>
              <button onClick={copyInviteLink} className="bg-white/20 hover:bg-white/30 p-2 sm:px-3 sm:py-2 rounded-lg text-sm font-bold transition-colors" title="העתק לינק">
                {linkCopied ? '✅' : '🔗'}<span className="hidden sm:inline">{linkCopied ? ' הועתק!' : ' הזמנה'}</span>
              </button>
              <button onClick={() => setShowParticipants(!showParticipants)} className="bg-white/20 hover:bg-white/30 p-2 sm:px-3 sm:py-2 rounded-lg text-sm font-bold transition-colors" title="משתתפים">
                👥
              </button>
              {event.status === 'active' && (isCreator || isAdmin) && (
                <button onClick={() => setShowCloseConfirm(true)} className="bg-gray-800 hover:bg-gray-900 p-2 sm:px-3 sm:py-2 rounded-lg text-sm font-bold transition-colors" title="סגור אירוע">
                  🔒
                </button>
              )}
              <button onClick={() => router.push('/events')} className="bg-white/20 hover:bg-white/30 p-2 sm:px-3 sm:py-2 rounded-lg text-sm font-bold transition-colors">
                ←
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

      {/* Pinned messages */}
      {journal.filter(e => e.is_pinned).length > 0 && (
        <div className="bg-amber-50 border-b border-amber-300 px-3 py-2">
          <div className="max-w-6xl mx-auto space-y-1">
            {journal.filter(e => e.is_pinned).map(entry => (
              <div key={`pin-${entry.id}`} className="flex items-center gap-2 text-sm">
                <span className="text-amber-600 font-bold">📌</span>
                <span className="font-bold text-amber-900">{entry.author_name}:</span>
                <span className="text-amber-800 flex-1">{entry.content}</span>
                <span className="text-xs text-amber-500">{formatTime(entry.created_at)}</span>
                {(isCreator || isAdmin) && (
                  <button onClick={() => togglePin(entry.id, true)} className="text-xs text-amber-400 hover:text-red-500">✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Map toggle + map */}
      <div className="max-w-6xl mx-auto w-full px-3">
        <button
          onClick={() => setShowMap(!showMap)}
          className={`w-full text-center text-xs py-1.5 font-bold rounded-t-lg border-b transition-colors ${
            showMap ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          🗺️ {showMap ? 'סגור מפה' : 'פתח מפה'}
          {journal.filter(e => e.entry_type === 'map_marker' || e.entry_type === 'location').length > 0 && (
            <span className="mr-1 bg-white/20 px-1.5 rounded text-xs">
              {journal.filter(e => e.entry_type === 'map_marker' || e.entry_type === 'location').length} סימונים
            </span>
          )}
        </button>
        {showMap && (
          <div className="border border-t-0 rounded-b-lg p-2 bg-white shadow-sm mb-1">
            <EventMap
              journal={journal}
              onAddMarker={addMapMarker}
              isActive={event.status === 'active'}
              shelters={sheltersData}
            />
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col sm:flex-row max-w-6xl mx-auto w-full min-h-0">
        {/* Journal - main area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Journal entries */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
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

                const isLocation = entry.entry_type === 'location';
                const isQuick = entry.entry_type === 'quick';
                const isTask = entry.entry_type === 'task';
                const isMapMarker = entry.entry_type === 'map_marker';
                const taskSt = isTask && entry.task_status ? TASK_STATUS[entry.task_status] : null;

                return (
                  <div key={entry.id} className={`border-r-4 rounded-lg p-3 shadow-sm relative group ${
                    entry.is_pinned ? 'ring-2 ring-amber-400 ' : ''
                  }${isMapMarker ? 'border-rose-400 bg-rose-50' : isQuick ? 'border-teal-400 bg-teal-50' : typeInfo?.color || 'border-gray-300 bg-white'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm">{isMapMarker ? '🗺️' : isQuick ? '⚡' : isLocation ? '📍' : typeInfo?.icon}</span>
                        <span className="font-bold text-gray-900 text-sm">{entry.author_name}</span>
                        {entry.author_role && (
                          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">{entry.author_role}</span>
                        )}
                        <span className="text-xs bg-white/50 text-gray-500 px-2 py-0.5 rounded">
                          {isMapMarker ? 'סימון מפה' : isQuick ? 'מהיר' : isLocation ? 'מיקום' : typeInfo?.label}
                        </span>
                        {entry.is_pinned && <span className="text-xs text-amber-600">📌</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        {(isCreator || isAdmin) && event.status === 'active' && !entry._optimistic && (
                          <button
                            onClick={() => togglePin(entry.id, entry.is_pinned)}
                            className="opacity-0 group-hover:opacity-100 text-xs text-gray-400 hover:text-amber-600 transition-opacity"
                            title={entry.is_pinned ? 'בטל הצמדה' : 'הצמד'}
                          >
                            📌
                          </button>
                        )}
                        <span className="text-xs text-gray-400 font-mono">{formatTime(entry.created_at)}</span>
                      </div>
                    </div>
                    {entry.content && <p className="text-sm text-gray-800 whitespace-pre-wrap mt-1">{entry.content}</p>}
                    {(isLocation || isMapMarker) && entry.location_lat && (
                      <a
                        href={`https://www.google.com/maps?q=${entry.location_lat},${entry.location_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-1 text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        🗺️ פתח במפה ({entry.location_lat.toFixed(4)}, {entry.location_lng.toFixed(4)})
                      </a>
                    )}
                    {entry.image_url && (
                      <div className="mt-2">
                        <img
                          src={entry.image_url}
                          alt="תמונה מצורפת"
                          className="max-w-full sm:max-w-sm rounded-lg border shadow-sm cursor-pointer"
                          onClick={() => window.open(entry.image_url, '_blank')}
                        />
                      </div>
                    )}
                    {isTask && taskSt && (
                      <div className="mt-2">
                        {entry.task_status === 'done' ? (
                          <span className="text-xs px-2 py-1 rounded font-bold bg-green-100 text-green-700">✅ בוצע ע״י {entry.assigned_to || 'לא ידוע'}</span>
                        ) : (
                          event.status === 'active' ? (
                            <button onClick={() => completeTask(entry.id)}
                              className="text-xs px-3 py-1.5 rounded-lg font-bold bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border border-yellow-300 transition-colors">
                              ⏳ ממתין - לחץ לסיום
                            </button>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded font-bold bg-yellow-100 text-yellow-700">⏳ ממתין</span>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={journalEndRef} />
          </div>

          {/* Input area */}
          {event.status === 'active' ? (
            <div className="border-t bg-white p-3 sm:p-4 shadow-lg">
              {/* Quick messages panel */}
              {showQuickMessages && (
                <div className="mb-2 bg-teal-50 rounded-lg p-2 border border-teal-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-teal-700">⚡ הודעות מהירות</span>
                    <button onClick={() => setShowQuickMessages(false)} className="text-xs text-teal-500">✕</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(EVENT_TYPES[event.event_type] || EVENT_TYPES.general).quickMessages.map(msg => (
                      <button key={msg} onClick={() => sendQuickMessage(msg)}
                        className="bg-white hover:bg-teal-100 border border-teal-300 text-teal-800 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors">
                        {msg}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-1.5 sm:gap-2 mb-2 sm:mb-3 overflow-x-auto">
                <button
                  onClick={() => setEntryType(entryType === 'urgent' ? 'update' : 'urgent')}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    entryType === 'urgent' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  🔴 דחוף
                </button>
                <button onClick={shareLocation}
                  className="px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 whitespace-nowrap">
                  📍 מיקום
                </button>
                <button
                  onClick={() => setShowQuickMessages(!showQuickMessages)}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    showQuickMessages ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  ⚡ מהיר
                </button>
                <button
                  onClick={() => setEntryType(entryType === 'task' ? 'update' : 'task')}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    entryType === 'task' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  ✅ משימה
                </button>
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
                  className="flex-1 px-3 sm:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none resize-none text-sm"
                />
                <button
                  onClick={handleSendEntry}
                  disabled={(!newEntry.trim() && !selectedImage) || sending}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold px-4 sm:px-6 rounded-lg transition-colors flex items-center"
                >
                  {uploading ? '⏫' : sending ? '⏳' : '📤'}
                </button>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                כותב כ: <strong>{userName}</strong>
              </div>
            </div>
          ) : (
            <div className="border-t bg-gray-200 p-4">
              <div className="text-center">
                <p className="text-gray-500 font-bold">🔒 האירוע סגור - לא ניתן להוסיף עדכונים</p>
                <p className="text-gray-400 text-sm mt-1">נסגר ב-{formatDateTime(event.closed_at)} ע״י {event.closed_by_name}</p>
              </div>
              {event.summary && (
                <div className="mt-3 bg-white rounded-lg p-3 border max-w-2xl mx-auto">
                  <h4 className="text-sm font-bold text-gray-700 mb-1">📊 סיכום אירוע</h4>
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans">{event.summary}</pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Participants sidebar / mobile overlay */}
        {showParticipants && (
          <div className="fixed sm:relative inset-0 sm:inset-auto z-40 sm:z-auto sm:w-72 bg-white sm:border-r overflow-y-auto shadow-lg">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                👥 משתתפים ({confirmedCount})
              </h3>
              <button onClick={() => setShowParticipants(false)} className="sm:hidden bg-gray-200 hover:bg-gray-300 rounded-full w-8 h-8 flex items-center justify-center text-gray-600 font-bold">✕</button>
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
