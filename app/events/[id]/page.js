'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';
import sheltersData from '@/data/shelters.json';
import StatusSelector, { FIELD_STATUSES } from '@/components/StatusSelector';
import toast from 'react-hot-toast';

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
  const [myFieldStatus, setMyFieldStatus] = useState('ready');
  const [myParticipantId, setMyParticipantId] = useState(null);
  const [showInitialStatusModal, setShowInitialStatusModal] = useState(false);
  const [eventLocations, setEventLocations] = useState([]);
  const [roadBlocks, setRoadBlocks] = useState([]);

  // Save map data to database
  const saveMapData = async (locations, blocks) => {
    try {
      const { data, error } = await supabase
        .from('emergency_events')
        .update({
          event_locations: locations,
          road_blocks: blocks
        })
        .eq('id', eventId)
        .select('event_locations, road_blocks')
        .single();

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving map data:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchEvent();
    fetchUserInfo();
    fetchParticipants();
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
        
        // Load map data
        setEventLocations(eventRes.data.event_locations || []);
        setRoadBlocks(eventRes.data.road_blocks || []);

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
      if (data) {
        // Fix participants with UUID as display_name
        for (const participant of data) {
          if (participant.display_name && participant.display_name.match(/^[0-9a-f-]{36}$/i)) {
            // This is a UUID, fetch the real name
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('full_name')
              .eq('id', participant.user_id)
              .single();
            
            if (profile?.full_name) {
              // Update the participant with the real name
              await supabase
                .from('event_participants')
                .update({ display_name: profile.full_name })
                .eq('id', participant.id);
              
              participant.display_name = profile.full_name;
            }
          }
        }
        
        setParticipants(data);
        // Find current user's participant record
        try {
          const authRes = await fetch('/api/auth/verify');
          if (authRes.ok) {
            const authData = await authRes.json();
            const myRecord = data.find(p => p.user_id === authData.userId);
            if (myRecord) {
              setMyParticipantId(myRecord.id);
              const status = myRecord.field_status || 'ready';
              setMyFieldStatus(status);
              
              // If user has no status yet (null or undefined), show initial status modal
              if (!myRecord.field_status) {
                setShowInitialStatusModal(true);
              }
            }
          }
        } catch (authError) {
          console.log('Auth check failed:', authError);
        }
      }
    } catch (error) {
      console.error('Failed to fetch participants:', error);
    }
  };

  const updateMyFieldStatus = async (newStatus) => {
    if (!myParticipantId) return;
    setMyFieldStatus(newStatus);
    try {
      await supabase
        .from('event_participants')
        .update({ 
          field_status: newStatus, 
          field_status_updated_at: new Date().toISOString() 
        })
        .eq('id', myParticipantId);
      
      // Add system message with status encoded in content
      const displayName = userName || 'משתמש';
      const requestBody = {
        author_name: displayName,
        author_role: userRole,
        entry_type: 'system',
        content: `STATUS:${newStatus}:${displayName}`,
      };
      
      await fetch(`/api/events/${eventId}/journal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      // Refresh journal to show the new message
      await refreshJournal();
    } catch (err) {
      console.error('Failed to update field status:', err);
    }
  };

  const handleJoinEvent = async () => {
    try {
      const authRes = await fetch('/api/auth/verify');
      if (!authRes.ok) {
        alert('עליך להתחבר קודם');
        return;
      }
      
      const authData = await authRes.json();
      
      // Don't send UUID as display_name - let the API fetch the real name
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const displayName = (authData.name && !uuidRegex.test(authData.name)) ? authData.name : null;
      
      const res = await fetch(`/api/events/${eventId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: authData.userId,
          display_name: displayName,
          role: authData.role || 'participant',
          department: authData.department || null,
          phone: authData.phone || null,
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        // Refresh participants to get the new record
        await fetchParticipants();
        // Refresh journal to show the join message (API already added it)
        await refreshJournal();
      } else {
        alert(data.error || 'שגיאה בהצטרפות לאירוע');
      }
    } catch (err) {
      console.error('Failed to join event:', err);
      alert('שגיאה בהצטרפות לאירוע');
    }
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
          author_field_status: myFieldStatus,
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
        body: JSON.stringify({ author_name: userName, author_role: userRole, entry_type: 'quick', content: msg, author_field_status: myFieldStatus }),
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
          body: JSON.stringify({ author_name: userName, author_role: userRole, entry_type: 'location', content, location_lat: latitude, location_lng: longitude, author_field_status: myFieldStatus }),
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
        body: JSON.stringify({ author_name: userName, author_role: userRole, entry_type: 'map_marker', content: note, location_lat: lat, location_lng: lng, author_field_status: myFieldStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setJournal(prev => prev.filter(e => e.id !== tempId).concat(data.data));
      }
    } catch (error) {
      console.error('Failed to add marker:', error);
      await refreshJournal();
    }
  };

  const deleteMapMarker = async (markerId) => {
    toast((t) => (
      <div dir="rtl" className="text-center">
        <p className="font-bold mb-3">🗑️ למחוק את הסימון הזה?</p>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                // Optimistic delete
                setJournal(prev => prev.filter(e => e.id !== markerId));
                
                // Delete from database
                const { error } = await supabase
                  .from('event_journal')
                  .delete()
                  .eq('id', markerId);
                
                if (error) {
                  console.error('Error deleting marker:', error);
                  await refreshJournal();
                } else {
                  toast.success('✅ הסימון נמחק!', {
                    duration: 2000,
                    style: { direction: 'rtl' }
                  });
                }
              } catch (error) {
                console.error('Failed to delete marker:', error);
                await refreshJournal();
              }
            }}
            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700"
          >
            מחק
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-600"
          >
            ביטול
          </button>
        </div>
      </div>
    ), {
      duration: 5000,
      position: 'top-center',
    });
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

  const buildPrintHTML = () => {
    if (!event) return '';
    const sev = SEVERITY_MAP[event.severity] || SEVERITY_MAP.medium;

    const journalRows = journal.map(entry => {
      const time = new Date(entry.created_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const date = new Date(entry.created_at).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const typeLabel = ENTRY_TYPES.find(t => t.key === entry.entry_type)?.label || 'עדכון';
      const typeIcon = ENTRY_TYPES.find(t => t.key === entry.entry_type)?.icon || '📝';
      const statusData = entry.author_field_status ? FIELD_STATUSES[entry.author_field_status] : null;
      const statusIcon = statusData?.icon || '';
      const statusLabel = statusData?.label || '';
      return `<tr>
        <td class="time-cell">${date}<br>${time}</td>
        <td class="author-cell">${entry.author_name} ${statusIcon}${statusLabel ? `<br><span class="status-label">${statusLabel}</span>` : ''}${entry.author_role ? `<br><span class="role">${entry.author_role}</span>` : ''}</td>
        <td class="type-cell">${typeIcon} ${typeLabel}</td>
        <td class="content-cell">${entry.content}</td>
      </tr>`;
    }).join('');

    const participantsList = participants
      .filter(p => p.status === 'confirmed')
      .map(p => `<li>${p.display_name}${p.department ? ` (${p.department})` : ''}${p.phone ? ` - ${p.phone}` : ''}</li>`)
      .join('');

    return `<!DOCTYPE html>
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
    .status-label { font-weight: normal; font-size: 7px; color: #2196F3; }
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
</html>`;
  };

  const openSummaryPage = () => {
    const htmlContent = buildPrintHTML();
    
// Add print button to the page
    const htmlWithPrintButton = htmlContent.replace(
      '</style>',
      `
    @media print {
      .no-print { display: none !important; }
    }
  </style>`
    ).replace(
      '</body>',
      `
  <div class="no-print" style="text-align: center; margin-top: 20px; padding: 20px; border-top: 2px solid #333;">
    <button onclick="window.print()" style="background: #2563eb; color: white; padding: 12px 32px; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-left: 10px;">
      🖨️ הדפס דף זה
    </button>
    <button onclick="window.close()" style="background: #6b7280; color: white; padding: 12px 32px; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      סגור
    </button>
  </div>
</body>`
    );
    
    const summaryWindow = window.open('', '_blank');
    summaryWindow.document.write(htmlWithPrintButton);
    summaryWindow.document.close();
    summaryWindow.focus();
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
              <button onClick={openSummaryPage} className="bg-white/20 hover:bg-white/30 p-2 sm:px-3 sm:py-2 rounded-lg text-sm font-bold transition-colors" title="סיכום האירוע">
                📄<span className="hidden sm:inline"> סיכום</span>
              </button>
              <button onClick={copyInviteLink} className="bg-white/20 hover:bg-white/30 p-2 sm:px-3 sm:py-2 rounded-lg text-sm font-bold transition-colors" title="העתק לינק">
                {linkCopied ? '✅' : '🔗'}<span className="hidden sm:inline">{linkCopied ? ' הועתק!' : ' הזמנה'}</span>
              </button>
              <button onClick={() => setShowParticipants(!showParticipants)} className="lg:hidden bg-white/20 hover:bg-white/30 p-2 sm:px-3 sm:py-2 rounded-lg text-sm font-bold transition-colors" title="משתתפים">
                👥
              </button>
              {event.status === 'active' && (isCreator || isAdmin || userRole === 'operator') && (
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

      {/* My Status Selector - Enhanced & Clear */}
      {event.status === 'active' ? (
        myParticipantId ? (
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b-2 border-indigo-200 px-3 py-3 shadow-sm">
            <div className="max-w-6xl mx-auto">
              <StatusSelector 
                currentStatus={myFieldStatus}
                onStatusChange={updateMyFieldStatus}
                compact
              />
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border-b border-yellow-200 px-3 py-2">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <div className="text-sm text-yellow-800">
                ⚠️ עליך להצטרף לאירוע כדי לעדכן סטטוס
              </div>
              <button 
                onClick={handleJoinEvent}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors"
              >
                הצטרף לאירוע
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="bg-gray-50 border-b border-gray-200 px-3 py-2">
          <div className="max-w-6xl mx-auto text-sm text-gray-600">
            📋 סטטוסים זמינים רק באירוע פעיל
          </div>
        </div>
      )}

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

      {/* Desktop: 3 columns | Mobile: Stack */}
      <div className="flex-1 flex flex-col lg:flex-row w-full min-h-0 max-w-screen-2xl mx-auto">
        
        {/* Column 1 (Desktop Right): Participants - Hidden on mobile, shown on lg+ */}
        <div className="hidden lg:flex lg:w-1/5 flex-col border-l-2 border-gray-200 bg-gray-50 overflow-y-auto shadow-xl">
          <div className="sticky top-0 p-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white z-10 shadow-md">
            <h3 className="font-bold flex items-center gap-2 text-sm">
              👥 משתתפים ({confirmedCount})
            </h3>
          </div>
          <div className="p-2 space-y-2">
            {participants.map(p => {
              const fieldStatus = p.field_status || 'ready';
              const statusData = FIELD_STATUSES[fieldStatus];
              return (
                <div key={p.id} className={`text-xs p-2 rounded-lg border ${
                  p.status === 'confirmed' ? 'bg-white border-blue-200' :
                  p.status === 'declined' ? 'bg-red-50 border-red-200 opacity-60' :
                  'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-bold text-gray-900 truncate">{p.display_name}</div>
                    {p.status === 'confirmed' && statusData && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${statusData.color}`}>
                        {statusData.icon}
                      </span>
                    )}
                  </div>
                  {p.department && <div className="text-[10px] text-gray-500 truncate">{p.department}</div>}
                  {p.role && <div className="text-[10px] text-gray-400 truncate">{p.role}</div>}
                  <div className="text-[10px] mt-1">
                    {p.status === 'confirmed' ? (
                      <span className="text-green-600">✅ {statusData?.label}</span>
                    ) : p.status === 'declined' ? (
                      <span className="text-red-600">❌ סירב</span>
                    ) : (
                      <span className="text-yellow-600">⏳ ממתין</span>
                    )}
                  </div>
                </div>
              );
            })}
            {participants.length === 0 && (
              <p className="text-center text-gray-400 text-xs py-4">אין משתתפים</p>
            )}
          </div>
        </div>

        {/* Column 2 (Center): Journal & Input */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Journal entries */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
            {/* Map on mobile/tablet only */}
            <div className="lg:hidden mb-3 -mx-1 sm:-mx-2">
              <div className="border-2 border-blue-200 rounded-xl p-3 bg-gradient-to-br from-white to-blue-50 shadow-lg">
                <EventMap
                  journal={journal}
                  onAddMarker={addMapMarker}
                  onDeleteMarker={deleteMapMarker}
                  isActive={event.status === 'active'}
                  shelters={sheltersData}
                  eventLocations={eventLocations}
                  onAddEventLocation={async (location) => {
                    const newLocations = [...eventLocations, location];
                    setEventLocations(newLocations);
                    await saveMapData(newLocations, roadBlocks);
                  }}
                  onRemoveEventLocation={async (id) => {
                    const newLocations = eventLocations.filter(loc => loc.id !== id);
                    setEventLocations(newLocations);
                    await saveMapData(newLocations, roadBlocks);
                  }}
                  roadBlocks={roadBlocks}
                  onAddRoadBlock={async (points, note) => {
                    const newBlocks = [...roadBlocks, { points, note: note || 'חסימת כביש', id: Date.now() }];
                    setRoadBlocks(newBlocks);
                    await saveMapData(eventLocations, newBlocks);
                  }}
                  onRemoveRoadBlock={async (id) => {
                    const newBlocks = roadBlocks.filter(block => block.id !== id);
                    setRoadBlocks(newBlocks);
                    await saveMapData(eventLocations, newBlocks);
                  }}
                />
                {/* Map usage hint */}
                <div className="mt-2 flex items-center gap-2 text-xs text-blue-700 bg-blue-100 px-3 py-2 rounded-lg" dir="rtl">
                  <span className="text-base">💡</span>
                  <span className="font-medium">לחץ על המפה כדי להפעיל זום • גלילה רגילה תזיז את הדף</span>
                </div>
              </div>
            </div>

            {/* Journal entries */}
            {journal.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-3">📋</div>
                <p className="font-medium">היומן ריק - הוסף את העדכון הראשון</p>
              </div>
            ) : (
              <>
                {journal.map(entry => {
                const typeInfo = ENTRY_TYPES.find(t => t.key === entry.entry_type);
                const isSystem = entry.entry_type === 'system';
                
                // Check if this is a status update message
                if (isSystem && entry.content?.startsWith('STATUS:')) {
                  const match = entry.content.match(/^STATUS:([^:]+):(.+)$/);
                  if (match) {
                    const [, statusCode, displayName] = match;
                    const statusData = FIELD_STATUSES[statusCode];
                    const statusIcon = statusData?.icon || '📋';
                    const statusLabel = statusData?.label || statusCode;
                    return (
                      <div key={entry.id} className="text-center py-1">
                        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                          {displayName} {statusIcon} עדכן סטטוס: {statusLabel} • {formatTime(entry.created_at)}
                        </span>
                      </div>
                    );
                  }
                }

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

                // Use historical status saved in the entry, not current participant status
                const authorStatus = entry.author_field_status;
                const authorStatusData = authorStatus ? FIELD_STATUSES[authorStatus] : null;

                return (
                  <div key={entry.id} className={`border-r-4 rounded-lg p-3 shadow-sm relative group ${
                    entry.is_pinned ? 'ring-2 ring-amber-400 ' : ''
                  }${isMapMarker ? 'border-rose-400 bg-rose-50' : isQuick ? 'border-teal-400 bg-teal-50' : typeInfo?.color || 'border-gray-300 bg-white'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm">{isMapMarker ? '🗺️' : isQuick ? '⚡' : isLocation ? '📍' : typeInfo?.icon}</span>
                        <span className="font-bold text-gray-900 text-sm">
                          {entry.author_name}
                        </span>
                        {authorStatusData && (
                          <span className={`text-xs px-2 py-0.5 rounded ${authorStatusData.color}`}>
                            {authorStatusData.icon} {authorStatusData.label}
                          </span>
                        )}
                        <span className="text-xs bg-white/50 text-gray-500 px-2 py-0.5 rounded">
                          {isMapMarker ? 'סימון מפה' : isQuick ? 'מהיר' : isLocation ? 'מיקום' : typeInfo?.label}
                        </span>
                        {entry.is_pinned && <span className="text-xs text-amber-600">📌</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        {(isCreator || isAdmin || userRole === 'operator') && event.status === 'active' && !entry._optimistic && (
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
              })}
              </>
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

        {/* Column 3 (Desktop Left): Map - Hidden on mobile */}
        <div className="hidden lg:flex lg:w-[30%] flex-col border-r-2 border-blue-200 bg-gradient-to-br from-white to-blue-50 overflow-y-auto shadow-xl">
          <div className="sticky top-0 p-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white z-10 shadow-md">
            <h3 className="font-bold text-sm flex items-center gap-2">
              🗺️ מפת האירוע
            </h3>
          </div>
          <div className="p-3 flex-1 flex flex-col">
            <EventMap
              className="h-full"
              journal={journal}
              onAddMarker={addMapMarker}
              onDeleteMarker={deleteMapMarker}
              isActive={event.status === 'active'}
              shelters={sheltersData}
              eventLocations={eventLocations}
              onAddEventLocation={async (location) => {
                const newLocations = [...eventLocations, location];
                setEventLocations(newLocations);
                await saveMapData(newLocations, roadBlocks);
              }}
              onRemoveEventLocation={async (id) => {
                const newLocations = eventLocations.filter(loc => loc.id !== id);
                setEventLocations(newLocations);
                await saveMapData(newLocations, roadBlocks);
              }}
              roadBlocks={roadBlocks}
              onAddRoadBlock={async (points, note) => {
                const newBlocks = [...roadBlocks, { points, note: note || 'חסימת כביש', id: Date.now() }];
                setRoadBlocks(newBlocks);
                await saveMapData(eventLocations, newBlocks);
              }}
              onRemoveRoadBlock={async (id) => {
                const newBlocks = roadBlocks.filter(block => block.id !== id);
                setRoadBlocks(newBlocks);
                await saveMapData(eventLocations, newBlocks);
              }}
            />
            <div className="mt-2 text-[10px] text-blue-700 bg-blue-100 px-2 py-1.5 rounded-lg" dir="rtl">
              💡 לחץ על המפה להפעלת זום
            </div>
          </div>
        </div>

        {/* Mobile Participants Overlay - Only shown when button clicked on mobile */}
        {showParticipants && (
          <div className="lg:hidden fixed inset-0 z-40 bg-white overflow-y-auto shadow-lg">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                👥 משתתפים ({confirmedCount})
              </h3>
              <button onClick={() => setShowParticipants(false)} className="sm:hidden bg-gray-200 hover:bg-gray-300 rounded-full w-8 h-8 flex items-center justify-center text-gray-600 font-bold">✕</button>
            </div>
            <div className="p-3 space-y-2">
              {participants.map(p => {
                const fieldStatus = p.field_status || 'ready';
                const statusData = FIELD_STATUSES[fieldStatus];
                return (
                  <div key={p.id} className={`text-sm p-2.5 rounded-lg border ${
                    p.status === 'confirmed' ? 'bg-white border-gray-200' :
                    p.status === 'declined' ? 'bg-red-50 border-red-200 opacity-60' :
                    'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-gray-900">{p.display_name}</div>
                      {p.status === 'confirmed' && statusData && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${statusData.color}`}>
                          {statusData.icon}
                        </span>
                      )}
                    </div>
                    {p.department && <div className="text-xs text-gray-500">{p.department}</div>}
                    {p.role && <div className="text-xs text-gray-400">{p.role}</div>}
                    {p.phone && <div className="text-xs text-gray-400" dir="ltr">{p.phone}</div>}
                    <div className="text-xs mt-1 flex items-center gap-2">
                      {p.status === 'confirmed' ? (
                        <>
                          <span className="text-green-600">✅</span>
                          {statusData && <span className="text-gray-600">{statusData.label}</span>}
                        </>
                      ) : p.status === 'declined' ? (
                        <span className="text-red-600">❌ סירב</span>
                      ) : (
                        <span className="text-yellow-600">⏳ ממתין</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {participants.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-4">אין משתתפים עדיין</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Initial status selection modal */}
      {showInitialStatusModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8" dir="rtl">
            <h3 className="text-2xl font-bold text-gray-900 mb-2 text-center">👋 ברוכים הבאים!</h3>
            <p className="text-gray-600 mb-6 text-center">לפני שמתחילים, אנא בחר את הסטטוס הנוכחי שלך:</p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              {Object.entries(FIELD_STATUSES).map(([key, status]) => (
                <button
                  key={key}
                  onClick={async () => {
                    await updateMyFieldStatus(key);
                    setShowInitialStatusModal(false);
                  }}
                  className={`p-4 rounded-xl border-2 transition-all hover:scale-105 ${
                    myFieldStatus === key
                      ? `${status.color} border-blue-500 shadow-lg`
                      : 'bg-gray-50 border-gray-300 hover:border-blue-300'
                  }`}
                >
                  <div className="text-3xl mb-2">{status.icon}</div>
                  <div className="font-bold text-sm">{status.label}</div>
                </button>
              ))}
            </div>
            
            <p className="text-xs text-gray-500 text-center">
              תוכל לשנות את הסטטוס שלך בכל עת מהסרגל העליון
            </p>
          </div>
        </div>
      )}

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
