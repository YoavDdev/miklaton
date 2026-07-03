'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const DAYS_HEB = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

function formatDateForDB(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function ScreenPage() {
  const [zoom, setZoom] = useState(1.5);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [warMode, setWarMode] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [securityEntries, setSecurityEntries] = useState([]);
  const [dutyRoster, setDutyRoster] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [shabbatTimes, setShabbatTimes] = useState(null);
  const [weather, setWeather] = useState(null);
  const [securityDeptId, setSecurityDeptId] = useState(null);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Read zoom from URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const z = parseFloat(params.get('zoom'));
    if (!isNaN(z) && z > 0.5 && z <= 3) {
      setZoom(z);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000); // refresh every 30 seconds

    // Realtime war mode
    const channel = supabase
      .channel('screen_war_mode')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'war_mode' },
        (payload) => setWarMode(payload.new.is_active || false)
      )
      .subscribe();

    // Realtime notifications
    const notifChannel = supabase
      .channel('screen_notifications')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'general_notifications' },
        () => fetchNotifications()
      )
      .subscribe();

    // Realtime security daily order
    const securityChannel = supabase
      .channel('screen_security_daily_order')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'security_daily_order_entries' },
        () => {
          if (securityDeptId) fetchSecurityStatus();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(securityChannel);
    };
  }, []);

  useEffect(() => {
    if (securityDeptId) fetchSecurityStatus();
  }, [securityDeptId]);

  const fetchAll = async () => {
    await Promise.all([
      fetchWarMode(),
      fetchNotifications(),
      fetchDepartments(),
      fetchDutyRoster(),
      fetchShabbatTimes(),
      fetchWeather(),
      securityDeptId ? fetchSecurityStatus() : Promise.resolve()
    ]);
  };

  const fetchWarMode = async () => {
    try {
      const res = await fetch('/api/war-mode');
      const data = await res.json();
      if (data.success && data.data) setWarMode(data.data.is_active || false);
    } catch {}
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch {}
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments');
      const data = await res.json();
      if (data.success) {
        const secDept = data.data?.find(d => d.name?.includes('בטחון'));
        if (secDept) {
          setSecurityDeptId(secDept.id);
        }
      }
    } catch {}
  };

  const fetchSecurityStatus = async () => {
    try {
      const today = new Date();
      const todayStr = formatDateForDB(today);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDateForDB(yesterday);

      const [todayRes, yesterdayRes] = await Promise.all([
        fetch(`/api/security-daily-order?department_id=${securityDeptId}&order_date=${todayStr}`),
        fetch(`/api/security-daily-order?department_id=${securityDeptId}&order_date=${yesterdayStr}`)
      ]);

      const todayData = await todayRes.json();
      const yesterdayData = await yesterdayRes.json();

      let allEntries = [];
      if (todayData.success && todayData.entries) {
        allEntries = [...todayData.entries];
      }
      // Add yesterday's overnight shifts that are still active or already ended
      if (yesterdayData.success && yesterdayData.entries) {
        const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();
        const overnightEntries = yesterdayData.entries.filter(e => {
          const [sh, sm] = e.start_time.split(':').map(Number);
          const [eh, em] = e.end_time.split(':').map(Number);
          const start = sh * 60 + sm;
          const end = eh * 60 + em;
          // Only include if it actually spans midnight and either still active this morning
          // or already ended today but not yet restarted for the new shift
          if (end >= start) return false;
          return currentMinutes < end || currentMinutes < start;
        });
        allEntries = [...allEntries, ...overnightEntries.map(e => ({ ...e, _fromYesterday: true }))];
      }
      
      // Remove duplicate entries (same staff, times, category, role)
      const seen = new Set();
      const deduped = allEntries.filter(e => {
        const key = `${e.staff_id}|${e.start_time}|${e.end_time}|${e.category}|${e.role_title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      
      setSecurityEntries(deduped);
    } catch {}
  };

  const fetchDutyRoster = async () => {
    try {
      const weekStart = formatDateForDB(getWeekStart(new Date()));
      const [rosterRes, contactsRes] = await Promise.all([
        fetch(`/api/duty-roster?week_start_date=${weekStart}`),
        fetch('/api/contacts')
      ]);
      const rosterData = await rosterRes.json();
      const contactsData = await contactsRes.json();
      if (rosterData.success) setDutyRoster(rosterData.data || []);
      if (contactsData.success) setContacts(contactsData.data || []);
    } catch {}
  };

  const fetchShabbatTimes = async () => {
    try {
      // Use Hebcal API for shabbat times in Hebrew
      const res = await fetch(`https://www.hebcal.com/shabbat?cfg=json&geonameid=293397&m=50&lg=h`);
      const data = await res.json();
      if (data.items) {
        const candles = data.items.find(i => i.category === 'candles');
        const havdalah = data.items.find(i => i.category === 'havdalah');
        const parasha = data.items.find(i => i.category === 'parashat');
        setShabbatTimes({
          date: candles ? new Date(candles.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' }) : null,
          candles: candles ? new Date(candles.date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : null,
          havdalah: havdalah ? new Date(havdalah.date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : null,
          parasha: parasha?.hebrew || parasha?.title || null
        });
      }
    } catch {}
  };

  const fetchWeather = async () => {
    try {
      // Open-Meteo free weather API for Yehud area, Israel
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=32.0333&longitude=34.8833&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=Asia/Jerusalem&forecast_days=1`);
      const data = await res.json();
      if (data.current) {
        setWeather(data.current);
      }
    } catch {}
  };

  const getWeatherInfo = (code) => {
    // WMO Weather interpretation codes
    const map = {
      0: { label: 'בהיר', icon: '☀️' },
      1: { label: 'בהיר בעיקר', icon: '🌤️' },
      2: { label: 'מעונן חלקית', icon: '⛅' },
      3: { label: 'מעונן', icon: '☁️' },
      45: { label: 'ערפל', icon: '🌫️' },
      48: { label: 'ערפל', icon: '🌫️' },
      51: { label: 'טפטוף קל', icon: '🌦️' },
      53: { label: 'טפטוף', icon: '🌦️' },
      55: { label: 'טפטוף כבד', icon: '🌧️' },
      61: { label: 'גשם קל', icon: '🌧️' },
      63: { label: 'גשם', icon: '🌧️' },
      65: { label: 'גשם כבד', icon: '🌧️' },
      71: { label: 'שלג קל', icon: '🌨️' },
      73: { label: 'שלג', icon: '🌨️' },
      75: { label: 'שלג כבד', icon: '❄️' },
      80: { label: 'ממטרים', icon: '🌦️' },
      81: { label: 'ממטרים', icon: '🌧️' },
      82: { label: 'ממטרים כבדים', icon: '🌧️' },
      95: { label: 'סופת רעמים', icon: '⛈️' },
      96: { label: 'סופת רעמים', icon: '⛈️' },
      99: { label: 'סופת רעמים', icon: '⛈️' }
    };
    return map[code] || { label: 'לא ידוע', icon: '❓' };
  };

  // Determine active security entries
  const now = currentTime;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Daily cemetery gate reminder: 19:00-19:30
  const isCemeteryReminderActive = now.getHours() === 19 && now.getMinutes() < 30;

  const isActive = (startTime, endTime) => {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const start = sh * 60 + sm;
    let end = eh * 60 + em;
    if (end < start) return currentMinutes >= start || currentMinutes < end;
    return currentMinutes >= start && currentMinutes < end;
  };

  const activeSecurityNow = securityEntries.filter(e => isActive(e.start_time, e.end_time));

  // Today's on-call contacts
  const todayDay = now.getDay();
  const todayDuty = dutyRoster.filter(d => d.day_of_week === todayDay);
  const currentDuty = todayDuty.filter(d => {
    if (d.start_hour === d.end_hour) return true; // 24h
    if (d.end_hour < d.start_hour) {
      return now.getHours() >= d.start_hour || now.getHours() < d.end_hour;
    }
    return now.getHours() >= d.start_hour && now.getHours() < d.end_hour;
  });

  // Urgent notifications first
  const urgentNotifs = notifications.filter(n => n.type === 'urgent');
  const regularNotifs = notifications.filter(n => n.type !== 'urgent').slice(0, 5);

  return (
    <div
      className="h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden"
      dir="rtl"
      style={{ zoom }}
    >
      
      {/* War Mode Banner */}
      {warMode && (
        <div className="bg-red-600 text-white text-center py-3 text-lg font-black animate-pulse">
          🚨 מצב חירום פעיל 🚨
        </div>
      )}

      {/* Daily Cemetery Gate Reminder */}
      {isCemeteryReminderActive && (
        <div className="bg-red-700 text-white text-center py-4 border-b-4 border-red-500 animate-pulse">
          <div className="text-2xl font-black flex items-center justify-center gap-3">
            <span>🪦</span>
            <span>לוודא ששער בית העלמין סגור!</span>
            <span>🪦</span>
          </div>
          <div className="text-sm text-red-200 mt-1">
            תזכורת יומית בין 19:00 ל-19:30
          </div>
        </div>
      )}

      {/* Header - Time & Date */}
      <header className={`px-8 py-4 border-b ${isCemeteryReminderActive ? 'bg-red-900/40 border-red-500/50' : 'border-white/10'}`}>
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className={`text-5xl font-black tracking-tight font-mono ${isCemeteryReminderActive ? 'text-red-400 animate-pulse' : ''}`}>
              {currentTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="border-r border-white/20 pr-6">
              <div className="text-lg font-bold">
                יום {DAYS_HEB[currentTime.getDay()]}
              </div>
              <div className="text-sm text-gray-300">
                {currentTime.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Weather - in the middle */}
          {weather && (
            <div className="flex items-center gap-4 bg-blue-900/30 rounded-xl px-5 py-3 border border-blue-500/30">
              <span className="text-4xl">{getWeatherInfo(weather.weather_code).icon}</span>
              <div className="text-sm">
                <div className="font-bold text-white text-lg">{Math.round(weather.temperature_2m)}°</div>
                <div className="text-blue-200">{getWeatherInfo(weather.weather_code).label}</div>
              </div>
              <div className="text-xs text-blue-300 border-r border-blue-500/30 pr-3 mr-2">
                <div>תחושה: {Math.round(weather.apparent_temperature)}°</div>
                <div>לחות: {weather.relative_humidity_2m}%</div>
                <div>רוח: {weather.wind_speed_10m} קמ"ש</div>
              </div>
            </div>
          )}

          {/* Shabbat Times - on the left side */}
          {shabbatTimes && (
            <div className="flex items-center gap-4 bg-white/5 rounded-xl px-5 py-3 border border-white/10">
              <span className="text-2xl">🕯️</span>
              <div className="text-sm">
                {shabbatTimes.parasha && <div className="font-bold text-yellow-300">{shabbatTimes.parasha}</div>}
                <div className="text-xs text-gray-400 mb-1">
                  {shabbatTimes.date && <span>תאריך: {shabbatTimes.date}</span>}
                </div>
                <div className="flex gap-3 text-gray-300">
                  {shabbatTimes.candles && <span>כניסה: <strong className="text-white">{shabbatTimes.candles}</strong></span>}
                  {shabbatTimes.havdalah && <span>יציאה: <strong className="text-white">{shabbatTimes.havdalah}</strong></span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 w-full px-8 py-6 grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0">
        
        {/* Left Column - Notifications */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
          
          {/* Urgent Notifications */}
          {urgentNotifs.length > 0 && (
            <div className="flex flex-col gap-3 shrink-0">
              {urgentNotifs.map(n => (
                <div key={n.id} className="bg-red-900/60 border-2 border-red-500 rounded-xl p-5 animate-pulse">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">🚨</span>
                    <div>
                      <h3 className="text-xl font-black text-red-100">{n.title}</h3>
                      <p className="text-red-200 mt-1 text-lg">{n.message}</p>
                      <p className="text-red-400 text-xs mt-2">{n.author} • {new Date(n.created_at).toLocaleString('he-IL')}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Regular Notifications */}
          {regularNotifs.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden flex flex-col min-h-0">
              <div className="px-5 py-3 bg-white/5 border-b border-white/10 flex items-center gap-2 shrink-0">
                <span className="text-xl">📢</span>
                <h2 className="font-bold text-lg">הודעות והנחיות</h2>
              </div>
              <div className="divide-y divide-white/5 overflow-y-auto">
                {regularNotifs.map(n => (
                  <div key={n.id} className="px-5 py-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-white">{n.title}</h4>
                        <p className="text-gray-300 text-sm mt-1">{n.message}</p>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap mr-4">
                        {new Date(n.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Emergency On-Call - visible always but emphasized in war mode */}
          {warMode && currentDuty.length > 0 && (
            <div className="bg-red-900/30 border-2 border-red-600 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-red-900/50 border-b border-red-600 flex items-center gap-2">
                <span className="text-xl">🚨</span>
                <h2 className="font-bold text-lg text-red-100">כוננים במצב חירום - עכשיו</h2>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentDuty.map((duty, idx) => {
                  const contact = contacts.find(c => c.id === duty.contact_id);
                  if (!contact) return null;
                  return (
                    <div key={idx} className="bg-red-900/40 border border-red-700 rounded-lg px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white">{contact.full_name}</div>
                        <div className="text-xs text-red-300">
                          {contact.departments?.name} • {String(duty.start_hour).padStart(2,'0')}:00-{String(duty.end_hour).padStart(2,'0')}:00
                        </div>
                      </div>
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="text-xl">📞</a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Security Status */}
        <div className="flex flex-col gap-4 min-h-0">

          {/* Security Field Status */}
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden flex flex-col min-h-0">
            <div className="px-5 py-3 bg-gradient-to-l from-green-900/50 to-green-800/50 border-b border-white/10 flex items-center gap-2 shrink-0">
              <span className="text-xl">🛡️</span>
              <h2 className="font-bold">ביטחון - כרגע בשטח</h2>
              <span className="mr-auto text-xs text-green-400 bg-green-900/50 px-2 py-0.5 rounded-full">
                {activeSecurityNow.length} פעילים
              </span>
            </div>
            
            {activeSecurityNow.length > 0 ? (
              <div className="p-3 space-y-2 overflow-y-auto">
                {activeSecurityNow.map((entry, idx) => (
                  <div key={idx} className="bg-green-900/20 border border-green-800/50 rounded-lg px-4 py-3 flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-sm truncate">
                        {entry.staff_name || entry.staff?.full_name || 'לא שובץ'}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-2">
                        <span>{entry.start_time}-{entry.end_time}</span>
                        <span className="text-green-400">{entry.role_title}</span>
                      </div>
                    </div>
                    {entry.vehicle && (
                      <span className="text-xs bg-green-900/50 text-green-300 px-2 py-1 rounded font-medium">
                        🚗 {entry.vehicle}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center">
                <div className="text-3xl mb-2">⚠️</div>
                <div className="text-red-400 font-bold text-sm mb-1">
                  לוודא מול מנהל שמשמרות מודכנות
                </div>
                <div className="text-gray-500 text-xs">
                  אין נתוני משמרת כרגע
                </div>
              </div>
            )}
          </div>

          {/* On-Call Today - only in emergency mode */}
          {warMode && todayDuty.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-white/5 border-b border-white/10 flex items-center gap-2">
                <span className="text-xl">�</span>
                <h2 className="font-bold">כוננים היום - יום {DAYS_HEB[todayDay]}</h2>
              </div>
              <div className="p-3 space-y-1 max-h-[300px] overflow-y-auto">
                {todayDuty.map((duty, idx) => {
                  const contact = contacts.find(c => c.id === duty.contact_id);
                  if (!contact) return null;
                  const isNow = currentDuty.some(d => d.id === duty.id);
                  return (
                    <div key={idx} className={`rounded-lg px-3 py-2 flex items-center justify-between text-sm ${
                      isNow ? 'bg-blue-900/30 border border-blue-700' : 'bg-white/5'
                    }`}>
                      <div className="flex items-center gap-2">
                        {isNow && <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>}
                        <span className="font-medium text-white">{contact.full_name}</span>
                        <span className="text-xs text-gray-500">{contact.departments?.name}</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {duty.start_hour === duty.end_hour ? '24 שעות' : 
                          `${String(duty.start_hour).padStart(2,'0')}:00-${String(duty.end_hour).padStart(2,'0')}:00`
                        }
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
