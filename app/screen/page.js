'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getMunicipalityId } from '@/lib/municipality';
import WeatherAlertBar from '@/components/WeatherAlertBar';
import AutoRefresh from '@/components/AutoRefresh';

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

function formatVacationDateRange(start, end) {
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  const fmt = (d) =>
    `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `מ-${fmt(startDate)} עד ${fmt(endDate)}`;
}

function isWithinLast24Hours(isoDate) {
  if (!isoDate) return false;
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return now - then < 24 * 60 * 60 * 1000;
}

export default function ScreenPage() {
  const [zoom, setZoom] = useState(1.5);
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Hard refresh the page every day at 06:00
  useEffect(() => {
    const scheduleDailyReload = () => {
      const now = new Date();
      const target = new Date(now);
      target.setHours(6, 0, 0, 0);
      if (target <= now) {
        target.setDate(target.getDate() + 1);
      }
      const msUntilTarget = target.getTime() - now.getTime();
      return setTimeout(() => window.location.reload(), msUntilTarget);
    };

    const timeout = scheduleDailyReload();
    return () => clearTimeout(timeout);
  }, []);
  const [warMode, setWarMode] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [securityEntries, setSecurityEntries] = useState([]);
  const [lastSecurityUpdate, setLastSecurityUpdate] = useState(null);
  const [dutyRoster, setDutyRoster] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [shabbatTimes, setShabbatTimes] = useState(null);
  const [weather, setWeather] = useState(null);
  const [securityDeptId, setSecurityDeptId] = useState(null);
  const securityDeptIdRef = useRef(securityDeptId);
  useEffect(() => {
    securityDeptIdRef.current = securityDeptId;
  }, [securityDeptId]);
  const [staffOnBreak, setStaffOnBreak] = useState({}); // { staff_id: { startTime: timestamp, duration: 30 } }
  const [statusModal, setStatusModal] = useState({ open: false, staffId: null, staffName: null });
  const [timingMode, setTimingMode] = useState('immediate');
  const [vacations, setVacations] = useState([]);
  const [actionMenu, setActionMenu] = useState({ open: false, entry: null }); // quick action menu on staff card
  const [shiftChangeModal, setShiftChangeModal] = useState({ open: false, entry: null, type: null }); // 'end_time_change', 'time_change', 'removed'

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load breaks from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('security_staff_breaks');
      if (saved) {
        const breaks = JSON.parse(saved);
        // Clean expired breaks
        const now = Date.now();
        const active = {};
        Object.entries(breaks).forEach(([staffId, breakData]) => {
          const elapsed = now - breakData.startTime;
          if (elapsed < breakData.duration * 60 * 1000) {
            active[staffId] = breakData;
          }
        });
        setStaffOnBreak(active);
      }
    } catch {}
  }, []);

  // Save breaks to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('security_staff_breaks', JSON.stringify(staffOnBreak));
    } catch {}
  }, [staffOnBreak]);

  // Auto-cleanup expired breaks every 10 seconds
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setStaffOnBreak(prev => {
        const updated = { ...prev };
        let changed = false;
        Object.entries(updated).forEach(([staffId, statusData]) => {
          let shouldRemove = false;
          
          // Scheduled status
          if (statusData.isScheduled) {
            if (now > statusData.scheduledEnd) {
              shouldRemove = true;
            }
          } 
          // Immediate status
          else if (statusData.startTime && statusData.duration) {
            const elapsed = now - statusData.startTime;
            if (elapsed >= statusData.duration * 60 * 1000) {
              shouldRemove = true;
            }
          }
          
          if (shouldRemove) {
            delete updated[staffId];
            changed = true;
          }
        });
        return changed ? updated : prev;
      });
    }, 10000);
    return () => clearInterval(cleanup);
  }, []);

  // Date change detector - refresh when new day starts
  useEffect(() => {
    let lastDate = formatDateForDB(new Date());
    
    const checkDateChange = () => {
      const currentDate = formatDateForDB(new Date());
      if (currentDate !== lastDate) {
        console.log('New day detected! Refreshing all data...', lastDate, '->', currentDate);
        lastDate = currentDate;
        fetchAll();
      }
    };

    // Check every 60 seconds (aligned with main refresh)
    const dateChecker = setInterval(checkDateChange, 60000);
    return () => clearInterval(dateChecker);
  }, []);

  // Page Visibility: refresh when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Screen became visible - refreshing data');
        fetchAll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);


  // Read zoom and municipality_id from URL, save to localStorage
  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    const z = parseFloat(params.get('zoom'));
    if (!isNaN(z) && z > 0.5 && z <= 3) {
      setZoom(z);
    }
    // If municipality_id is in URL, save it to localStorage so all API calls use the correct ID
    const mid = params.get('municipality_id');
    if (mid) {
      localStorage.setItem('municipality_id', mid);
    }
  }, []);

  // Static data - fetch once on mount
  useEffect(() => {
    fetchDepartments();
    fetchShabbatTimes();
  }, []);

  // Weather - fetch on mount and refresh every 5 minutes
  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Initial load + polling + realtime
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10000); // refresh critical data every 10 seconds

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

    // Realtime vacations from category contacts
    const vacationChannel = supabase
      .channel('screen_vacations')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'call_category_contacts' },
        () => fetchVacations()
      )
      .subscribe();

    // Realtime direct on-call contact vacations
    const directVacationChannel = supabase
      .channel('screen_direct_vacations')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'on_call_contacts' },
        () => fetchVacations()
      )
      .subscribe();

    // Realtime duty roster changes
    const rosterChannel = supabase
      .channel('screen_duty_roster')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'duty_roster' },
        () => fetchDutyRoster()
      )
      .subscribe();

    // Realtime contacts changes
    const contactsChannel = supabase
      .channel('screen_contacts')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        () => fetchDutyRoster()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(vacationChannel);
      supabase.removeChannel(directVacationChannel);
      supabase.removeChannel(rosterChannel);
      supabase.removeChannel(contactsChannel);
    };
  }, []);

  useEffect(() => {
    if (securityDeptId) fetchSecurityStatus();
  }, [securityDeptId]);

  // Realtime security daily order - only after securityDeptId is loaded
  useEffect(() => {
    if (!securityDeptId) return;

    const securityChannel = supabase
      .channel('screen_security_daily_order')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'security_daily_order_entries' },
        () => fetchSecurityStatus()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'security_daily_orders' },
        () => fetchSecurityStatus()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(securityChannel);
    };
  }, [securityDeptId]);

  const fetchAll = async () => {
    await Promise.all([
      fetchWarMode(),
      fetchNotifications(),
      fetchDutyRoster(),
      fetchVacations(),
      securityDeptIdRef.current ? fetchSecurityStatus() : Promise.resolve()
    ]);
    // Update timestamp to show screen is actively checking
    setLastSecurityUpdate(new Date());
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
      const deptId = securityDeptIdRef.current;
      if (!deptId) return;
      const today = new Date();
      const todayStr = formatDateForDB(today);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDateForDB(yesterday);

      const [todayRes, yesterdayRes] = await Promise.all([
        fetch(`/api/security-daily-order?department_id=${deptId}&order_date=${todayStr}`),
        fetch(`/api/security-daily-order?department_id=${deptId}&order_date=${yesterdayStr}`)
      ]);

      const todayData = await todayRes.json();
      const yesterdayData = await yesterdayRes.json();

      let allEntries = [];
      if (todayData.success && todayData.entries) {
        // Mark today's entries
        allEntries = [...todayData.entries.map(e => ({ ...e, _fromToday: true }))];
      }
      // Add yesterday's overnight shifts that are still active
      if (yesterdayData.success && yesterdayData.entries) {
        const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();
        const overnightEntries = yesterdayData.entries.filter(e => {
          const [sh, sm] = e.start_time.split(':').map(Number);
          const [eh, em] = e.end_time.split(':').map(Number);
          const start = sh * 60 + sm;
          const end = eh * 60 + em;
          // Only include overnight shifts (end < start) that haven't ended yet
          if (end >= start) return false;
          return currentMinutes < end;
        });
        allEntries = [...allEntries, ...overnightEntries.map(e => ({ ...e, _fromYesterday: true }))];
      }
      
      // If same staff has same category and start time from weekly schedule and daily order,
      // prefer the daily order override (the one with earlier end time)
      const deduped = allEntries.filter((e, index, self) => {
        const duplicates = self.filter(item =>
          item.staff_id === e.staff_id &&
          item.category === e.category &&
          item.start_time === e.start_time
        );
        if (duplicates.length > 1) {
          const toMinutes = (time) => time.split(':').map(Number).reduce((h, m) => h * 60 + m, 0);
          const minEnd = Math.min(...duplicates.map(d => toMinutes(d.end_time)));
          return toMinutes(e.end_time) === minEnd;
        }
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
          candleDate: candles ? new Date(candles.date) : null,
          havdalahDate: havdalah ? new Date(havdalah.date) : null,
          parasha: parasha?.hebrew || parasha?.title || null
        });
      }
    } catch {}
  };

  const fetchWeather = async () => {
    try {
      const res = await fetch('/api/weather');
      const data = await res.json();
      if (data.success && data.current) {
        setWeather({ current: data.current, daily: data.daily || [], alerts: data.alerts || [] });
      }
    } catch {}
  };

  const fetchVacations = async () => {
    try {
      // Priority: URL param → localStorage → env var → hardcoded fallback
      const urlParams = new URLSearchParams(window.location.search);
      const municipalityId = urlParams.get('municipality_id') 
        || localStorage.getItem('municipality_id') 
        || process.env.NEXT_PUBLIC_MUNICIPALITY_ID
        || '023b5984-7097-4f03-a8dd-7ef7e29a4bc4';
      const res = await fetch(`/api/vacations?municipality_id=${municipalityId}&include_recently_returned=true`);
      const data = await res.json();
      if (data.success) {
        // Group by person (same name/phone) to avoid duplicates
        const grouped = {};
        (data.vacations || []).forEach(vac => {
          const key = `${vac.external_name}_${vac.external_phone}`;
          if (!grouped[key]) {
            grouped[key] = {
              name: vac.external_name,
              phone: vac.external_phone,
              vacation_start: vac.vacation_start,
              vacation_end: vac.vacation_end,
              vacation_reason: vac.vacation_reason,
              on_vacation: vac.on_vacation,
              updated_at: vac.updated_at,
              categories: []
            };
          }
          if (vac.call_category?.name) {
            grouped[key].categories.push(vac.call_category.name);
          }
        });
        setVacations(Object.values(grouped));
      }
    } catch (err) {
      console.error('Error fetching vacations:', err);
    }
  };

  const submitShiftChange = async (entryId, changeType, data = {}) => {
    try {
      const res = await fetch('/api/security-daily-order/entry', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_id: entryId,
          change_type: changeType,
          ...data
        })
      });
      const result = await res.json();
      if (result.success) {
        // Refresh security data to reflect the change
        await fetchSecurityStatus();
        setShiftChangeModal({ open: false, entry: null, type: null });
        setActionMenu({ open: false, entry: null });
      } else {
        alert('שגיאה: ' + (result.error || 'לא ניתן לבצע את השינוי'));
      }
    } catch (err) {
      alert('שגיאת תקשורת');
    }
  };

  const toggleStaffBreak = (staffId) => {
    setStaffOnBreak(prev => {
      const updated = { ...prev };
      if (updated[staffId]) {
        // End break
        delete updated[staffId];
      } else {
        // Start 30-minute break
        updated[staffId] = {
          type: 'break',
          startTime: Date.now(),
          duration: 30,
          note: ''
        };
      }
      return updated;
    });
  };

  const setStaffStatus = (staffId, statusData) => {
    setStaffOnBreak(prev => ({
      ...prev,
      [staffId]: statusData
    }));
  };

  const isStatusActive = (statusData) => {
    if (!statusData) return false;
    
    const now = Date.now();
    
    // Scheduled status
    if (statusData.isScheduled) {
      return now >= statusData.scheduledStart && now <= statusData.scheduledEnd;
    }
    
    // Immediate status
    if (statusData.startTime && statusData.duration) {
      const elapsed = now - statusData.startTime;
      const totalDuration = statusData.duration * 60 * 1000;
      return elapsed < totalDuration;
    }
    
    return false;
  };

  const getBreakTimeRemaining = (staffId) => {
    const breakData = staffOnBreak[staffId];
    if (!breakData) return null;
    
    const now = Date.now();
    
    // Scheduled status
    if (breakData.isScheduled) {
      if (now < breakData.scheduledStart || now > breakData.scheduledEnd) {
        return null; // Not in time range yet or already passed
      }
      const remaining = breakData.scheduledEnd - now;
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    
    // Immediate status
    const elapsed = now - breakData.startTime;
    const remaining = breakData.duration * 60 * 1000 - elapsed;
    
    if (remaining <= 0) return null;
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const getStatusInfo = (statusType, customNote = '') => {
    const statusMap = {
      break: { icon: '☕', label: 'בהפסקה', color: 'orange' },
      custom: { icon: '⚡', label: customNote || 'סטטוס מיוחד', color: 'purple' }
    };
    return statusMap[statusType] || statusMap.break;
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

  // Daily cemetery gate reminder: 19:00-19:10
  const isCemeteryReminderActive = now.getHours() === 19 && now.getMinutes() < 10;

  const isActive = (startTime, endTime, fromYesterday = false) => {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const start = sh * 60 + sm;
    let end = eh * 60 + em;
    
    // Handle overnight shifts (e.g., 18:00 - 03:00)
    if (end < start) {
      if (fromYesterday) {
        // Shift started yesterday - only active if we haven't passed end time yet
        return currentMinutes < end;
      } else {
        // Shift starts today - only active if we've passed start time
        return currentMinutes >= start;
      }
    }
    
    // Regular shift - active if between start and end
    return currentMinutes >= start && currentMinutes < end;
  };

  const activeSecurityNow = securityEntries.filter(e => {
    // For removed entries, use original times to keep them visible until their original shift ends
    const startT = e.is_removed && e.original_start_time ? e.original_start_time : e.start_time;
    const endT = e.is_removed && e.original_end_time ? e.original_end_time : e.end_time;
    return isActive(startT, endT, e._fromYesterday);
  });

  // Upcoming shifts in the next 12 hours (not currently active)
  const upcomingSecurityShifts = securityEntries.filter(e => {
    const startT = e.is_removed && e.original_start_time ? e.original_start_time : e.start_time;
    const endT = e.is_removed && e.original_end_time ? e.original_end_time : e.end_time;
    if (isActive(startT, endT, e._fromYesterday)) return false;
    if (e._fromYesterday) return false;
    const [sh, sm] = e.start_time.split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    // Only show shifts that haven't started yet
    if (startMinutes <= currentMinutes) return false;
    // Within 12 hours from now
    const minutesUntilStart = startMinutes - currentMinutes;
    return minutesUntilStart <= 12 * 60;
  });

  // Shabbat window: 2 hours before candle lighting until 2 hours after havdalah
  const isShabbatRestricted = (() => {
    if (!shabbatTimes?.candleDate || !shabbatTimes?.havdalahDate) return false;
    const start = new Date(shabbatTimes.candleDate.getTime() - 2 * 60 * 60 * 1000);
    const end = new Date(shabbatTimes.havdalahDate.getTime() + 2 * 60 * 60 * 1000);
    return now >= start && now <= end;
  })();

  // Today's on-call contacts
  const todayDay = now.getDay();
  const todayDuty = dutyRoster.filter(d => {
    if (d.day_of_week !== todayDay) return false;
    const contact = contacts.find(c => c.id === d.contact_id);
    if (isShabbatRestricted && contact?.shabbat_observer) return false;
    return true;
  });
  const currentDuty = todayDuty.filter(d => {
    if (d.start_hour === d.end_hour) return true; // 24h
    if (d.end_hour < d.start_hour) {
      return now.getHours() >= d.start_hour || now.getHours() < d.end_hour;
    }
    return now.getHours() >= d.start_hour && now.getHours() < d.end_hour;
  });

  // Urgent notifications first
  const urgentNotifs = notifications.filter(n => n.type === 'urgent');
  const regularNotifs = notifications.filter(n => n.type !== 'urgent').slice(0, 4);

  return (
    <div
      className="flex flex-row bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden"
      dir="rtl"
      style={mounted ? { zoom, height: `calc(100vh / ${zoom})`, width: `calc(100vw / ${zoom})` } : { height: '100vh' }}
      suppressHydrationWarning
    >
      <AutoRefresh />

      {/* LEFT SIDE - Header + Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* War Mode Banner */}
        {warMode && (
          <div className="bg-red-600 text-white text-center py-2 text-lg font-black animate-pulse shrink-0">
            🚨 מצב חירום פעיל 🚨
          </div>
        )}

        {/* Daily Cemetery Gate Reminder */}
        {isCemeteryReminderActive && (
          <div className="bg-red-700 text-white text-center py-2 border-b-2 border-red-500 animate-pulse shrink-0">
            <div className="text-xl font-black flex items-center justify-center gap-3">
              <span>🪦</span>
              <span>לוודא ששער בית העלמין סגור!</span>
              <span>🪦</span>
            </div>
          </div>
        )}

        {/* Header - Time & Date & Weather - single row */}
        <header className={`px-8 py-3 shrink-0 ${isCemeteryReminderActive ? 'bg-red-900/40' : ''}`}>
          <div className="flex items-center gap-6">
            {/* Clock */}
            <div className={`text-5xl font-black tracking-tight font-mono leading-none ${isCemeteryReminderActive ? 'text-red-400 animate-pulse' : 'text-white'}`} suppressHydrationWarning>
              {currentTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            {/* Date */}
            <div className="border-r border-white/20 pr-5">
              <div className="text-base font-bold text-white">
                יום {DAYS_HEB[currentTime.getDay()]}
              </div>
              <div className="text-xs text-gray-400">
                {currentTime.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>

            {/* Weather - fills remaining header space */}
            {weather && (
              <div className={`flex items-center gap-5 rounded-xl px-4 py-2 border flex-1 ${weather.alerts?.length > 0 ? 'bg-red-900/20 border-red-500/40' : 'bg-white/5 border-white/10'}`}>
                {/* Current */}
                <div className="flex items-center gap-2">
                  <span className="text-4xl">{getWeatherInfo(weather.current.weather_code).icon}</span>
                  <div>
                    <div className="font-black text-white text-2xl leading-none">{Math.round(weather.current.temperature_2m)}°</div>
                    <div className={`text-xs mt-0.5 ${weather.alerts?.length > 0 ? 'text-red-200' : 'text-gray-400'}`}>{getWeatherInfo(weather.current.weather_code).label}</div>
                  </div>
                </div>

                {/* Details */}
                <div className={`border-r pr-4 space-y-0.5 text-xs ${weather.alerts?.length > 0 ? 'text-red-200 border-red-500/30' : 'text-gray-400 border-white/10'}`}>
                  <div>🌡️ תחושה {Math.round(weather.current.apparent_temperature)}°</div>
                  <div>💧 לחות {weather.current.relative_humidity_2m}%</div>
                  <div>💨 רוח {Math.round(weather.current.wind_speed_10m)} קמ"ש</div>
                </div>

                {/* Forecast */}
                <div className={`flex items-center gap-4 border-r pr-4 ${weather.alerts?.length > 0 ? 'border-red-500/30' : 'border-white/10'}`}>
                  {weather.daily?.slice(1, 4).map((d, i) => {
                    const dayName = ['מחר', 'מחרתיים', 'עוד 3'][i];
                    return (
                      <div key={i} className="text-center">
                        <div className={`text-[10px] font-bold ${weather.alerts?.length > 0 ? 'text-red-200' : 'text-gray-400'}`}>{dayName}</div>
                        <div className="text-lg leading-none">{getWeatherInfo(d.code).icon}</div>
                        <div className={`text-[10px] font-mono ${weather.alerts?.length > 0 ? 'text-red-200' : 'text-gray-500'}`}>{Math.round(d.max)}°/{Math.round(d.min)}°</div>
                      </div>
                    );
                  })}
                </div>

                {/* Alerts */}
                {weather.alerts?.length > 0 && (
                  <div className="text-xs text-red-100 font-bold">
                    {weather.alerts.map((a, i) => <div key={i}>⚠️ {a.text}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <WeatherAlertBar alerts={weather?.alerts} />

        {/* Main Content Area */}
        <div className="flex-1 px-8 pb-4 flex flex-col gap-4 min-h-0 overflow-hidden">

          {/* Vacation Section */}
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden shrink-0">
            <div className="px-4 py-2 bg-gradient-to-l from-orange-900/30 to-transparent border-b border-white/5 flex items-center gap-2">
              <span className="text-base">🏖️</span>
              <h2 className="font-bold text-sm text-orange-100">בחופש</h2>
              <span className="text-[10px] bg-orange-800/50 text-orange-200 px-1.5 py-0.5 rounded-full">{vacations.filter(v => v.on_vacation !== false).length}</span>
            </div>
            <div className="px-3 py-2">
              {vacations.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {vacations.map((vac, idx) => {
                    const isReturned = vac.on_vacation === false;
                    const isNew = !isReturned && isWithinLast24Hours(vac.updated_at);
                    const dateRange = formatVacationDateRange(vac.vacation_start, vac.vacation_end);
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border text-sm ${
                          isReturned
                            ? 'bg-green-900/30 border-green-700/40'
                            : isNew
                              ? 'bg-orange-700/40 border-orange-400 ring-1 ring-orange-400 animate-pulse'
                              : 'bg-white/5 border-white/10'
                        }`}
                      >
                        <span className={`font-semibold ${isReturned ? 'text-green-200' : 'text-white'}`}>{vac.name}</span>
                        <span className={`text-xs ${isReturned ? 'text-green-400' : 'text-gray-400'}`}>{dateRange}</span>
                        {isNew && <span className="text-xs font-bold text-orange-200">🔥 חדש</span>}
                        {isReturned && <span className="text-xs font-bold text-green-300">✅ חזר</span>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-gray-500 text-sm py-1">אין כוננים בחופש כרגע</div>
              )}
            </div>
          </div>
          
          {/* Urgent Notifications */}
          {urgentNotifs.length > 0 && (
            <div className="flex flex-col gap-2 shrink-0">
              {urgentNotifs.map(n => (
                <div key={n.id} className="bg-red-900/50 border-2 border-red-500 rounded-xl p-4 animate-pulse">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🚨</span>
                    <div>
                      <h3 className="text-lg font-bold text-red-100">{n.title}</h3>
                      <p className="text-red-200 mt-1">{n.message}</p>
                      <p className="text-red-400 text-xs mt-1">{n.author} • {new Date(n.created_at).toLocaleString('he-IL')}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Regular Notifications */}
          {regularNotifs.length > 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden flex flex-col min-h-0 flex-1">
              <div className="px-4 py-2 bg-white/5 border-b border-white/10 flex items-center gap-2 shrink-0">
                <span className="text-base">📢</span>
                <h2 className="font-bold text-sm">הודעות והנחיות</h2>
                <span className="text-[10px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded-full">{regularNotifs.length}</span>
              </div>
              <div className="divide-y divide-white/5 flex-1 overflow-hidden">
                {regularNotifs.map(n => (
                  <div key={n.id} className="px-4 py-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-white font-medium">{n.title}</h4>
                        <p className="text-gray-400 text-sm mt-0.5">{n.message}</p>
                      </div>
                      <span className="text-xs text-gray-600 whitespace-nowrap mr-4 font-mono">
                        {new Date(n.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Empty state - no notifications */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4 opacity-30">✅</div>
                <div className="text-xl font-bold text-gray-500">אין הודעות פעילות</div>
                <div className="text-sm text-gray-600 mt-1">הכל תקין</div>
              </div>
            </div>
          )}

          {/* Emergency On-Call - only in war mode */}
          {warMode && currentDuty.length > 0 && (
            <div className="bg-red-900/30 border-2 border-red-600 rounded-xl overflow-hidden shrink-0">
              <div className="px-4 py-2 bg-red-900/50 border-b border-red-600 flex items-center gap-2">
                <span className="text-base">🚨</span>
                <h2 className="font-bold text-sm text-red-100">כוננים במצב חירום - עכשיו</h2>
              </div>
              <div className="p-3 grid grid-cols-2 gap-2">
                {currentDuty.map((duty, idx) => {
                  const contact = contacts.find(c => c.id === duty.contact_id);
                  if (!contact) return null;
                  return (
                    <div key={idx} className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white text-sm">{contact.full_name}</div>
                        <div className="text-xs text-red-300">
                          {contact.departments?.name} • {String(duty.start_hour).padStart(2,'0')}:00-{String(duty.end_hour).padStart(2,'0')}:00
                        </div>
                      </div>
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="text-lg">📞</a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDE - Security Column (full height, ~1/3 width) */}
      <div className="w-[380px] shrink-0 flex flex-col border-r border-white/10 bg-slate-900/50 overflow-hidden">
        
        {/* Security Header */}
        <div className="px-4 py-3 bg-gradient-to-l from-green-900/50 to-green-800/50 border-b border-white/10 flex items-center gap-2 shrink-0">
          <span className="text-xl">🛡️</span>
          <h2 className="font-bold text-base flex-1">ביטחון - כרגע בשטח</h2>
          <div className="flex gap-2">
            {(() => {
              const patrolCount = activeSecurityNow.filter(e => e.role_title && e.role_title.includes('שיטור')).length;
              const inspectorCount = activeSecurityNow.length - patrolCount;
              return (
                <>
                  {inspectorCount > 0 && (
                    <span className="text-xs bg-emerald-800/60 text-emerald-200 px-2 py-0.5 rounded-full font-medium">
                      👮 {inspectorCount}
                    </span>
                  )}
                  {patrolCount > 0 && (
                    <span className="text-xs bg-indigo-800/60 text-indigo-200 px-2 py-0.5 rounded-full font-medium">
                      🚓 {patrolCount}
                    </span>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Active Security Staff */}
        {activeSecurityNow.length > 0 ? (
          <div className={`p-2 ${activeSecurityNow.length > 5 ? 'grid grid-cols-2 gap-1.5' : 'space-y-1.5'}`}>
            {activeSecurityNow.map((entry, idx) => {
              const statusData = staffOnBreak[entry.staff_id];
              const hasStatus = statusData && isStatusActive(statusData);
              const breakTime = hasStatus ? getBreakTimeRemaining(entry.staff_id) : null;
              const statusInfo = hasStatus ? getStatusInfo(statusData.type, statusData.note) : null;
              
              const isPatrol = entry.role_title && entry.role_title.includes('שיטור');
              const isModified = entry.is_modified && !entry.is_removed;
              const isRemoved = entry.is_removed;
              const isCompact = activeSecurityNow.length > 5;
              
              const colorClasses = {
                orange: 'bg-orange-900/30 border-2 border-orange-600/70 text-orange-400',
                blue: 'bg-blue-900/30 border-2 border-blue-600/70 text-blue-400',
                red: 'bg-red-900/30 border-2 border-red-600/70 text-red-400',
                purple: 'bg-purple-900/30 border-2 border-purple-600/70 text-purple-400'
              };
              
              const baseColors = isPatrol
                ? 'bg-indigo-900/20 border border-indigo-700/50'
                : 'bg-emerald-900/20 border border-emerald-700/50';
              
              const baseDotColor = isPatrol ? 'bg-indigo-400' : 'bg-emerald-400';
              const baseRoleColor = isPatrol ? 'text-indigo-300' : 'text-emerald-300';
              
              return (
                <div 
                  key={idx} 
                  onClick={() => setActionMenu({ open: true, entry })}
                  className={`rounded-lg ${isCompact ? 'px-2 py-1' : 'px-3 py-2'} cursor-pointer transition-all ${
                    isRemoved
                      ? 'bg-red-900/10 border border-red-800/40 opacity-60'
                      : hasStatus 
                        ? colorClasses[statusInfo.color]
                        : isModified
                          ? 'bg-yellow-900/20 border border-yellow-600/50'
                          : baseColors
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <div className={`${isCompact ? 'w-2 h-2' : 'w-2.5 h-2.5'} rounded-full shrink-0 ${
                      isRemoved
                        ? 'bg-red-700'
                        : hasStatus 
                          ? statusInfo.color === 'orange' ? 'bg-orange-500' :
                            statusInfo.color === 'blue' ? 'bg-blue-500' :
                            statusInfo.color === 'red' ? 'bg-red-500' : 'bg-purple-500'
                          : `${baseDotColor} animate-pulse`
                    }`}></div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold ${isCompact ? 'text-xs' : 'text-sm'} truncate flex items-center gap-1.5 ${isRemoved ? 'text-gray-400' : 'text-white'}`}>
                        <span className={isRemoved ? 'line-through' : ''}>{entry.staff_name || entry.staff?.full_name || 'לא שובץ'}</span>
                        {isRemoved && (
                          <span className={`${isCompact ? 'text-[8px]' : 'text-[10px]'} bg-red-900/60 text-red-300 px-1 py-0.5 rounded`}>❌ {isCompact ? 'ירד' : 'ירד ממשמרת'}</span>
                        )}
                        {isModified && !hasStatus && (
                          <span className={`${isCompact ? 'text-[8px]' : 'text-[10px]'} bg-yellow-800/60 text-yellow-300 px-1 py-0.5 rounded`}>שונה</span>
                        )}
                        {hasStatus && breakTime && (
                          <span className={`${isCompact ? 'text-[10px]' : 'text-xs'} font-mono ${
                            statusInfo.color === 'orange' ? 'text-orange-400' :
                            statusInfo.color === 'blue' ? 'text-blue-400' :
                            statusInfo.color === 'red' ? 'text-red-400' : 'text-purple-400'
                          }`}>
                            {statusInfo.icon} {breakTime}
                          </span>
                        )}
                      </div>
                      <div className={`${isCompact ? 'text-[10px]' : 'text-xs'} text-gray-400 flex items-center gap-1.5`}>
                        <span className={isRemoved ? 'text-gray-500 line-through' : 'text-gray-300'}>
                          {entry.original_start_time || entry.start_time}-{entry.original_end_time || entry.end_time}
                        </span>
                        {isModified && entry.original_end_time && entry.original_end_time !== entry.end_time && (
                          <span className="text-yellow-500/70 line-through text-[10px]">{entry.original_start_time || entry.start_time}-{entry.original_end_time}</span>
                        )}
                        {!isRemoved && !hasStatus && !isModified && !isCompact && (
                          <span className={`font-medium ${baseRoleColor}`}>
                            {isPatrol ? '🚓' : '👮'} {entry.role_title}
                          </span>
                        )}
                      </div>
                      {!isRemoved && hasStatus && !isCompact && (
                        <div className={`text-xs font-medium ${
                          statusInfo.color === 'orange' ? 'text-orange-300' :
                          statusInfo.color === 'blue' ? 'text-blue-300' :
                          statusInfo.color === 'red' ? 'text-red-300' : 'text-purple-300'
                        }`}>
                          {statusInfo.icon} {statusInfo.label}
                        </div>
                      )}
                      {!isCompact && (isRemoved || isModified) && entry.modification_note && (
                        <div className={`text-[10px] mt-0.5 ${isRemoved ? 'text-red-400/70' : 'text-yellow-400/70'}`}>📝 {entry.modification_note}</div>
                      )}
                    </div>
                    {entry.vehicle && !isRemoved && !isCompact && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                        hasStatus 
                          ? 'bg-gray-700/50 text-gray-300'
                          : isPatrol 
                            ? 'bg-indigo-800/50 text-indigo-200' 
                            : 'bg-emerald-800/50 text-emerald-200'
                      }`}>
                        🚗 {entry.vehicle}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
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

        {/* Upcoming Shifts - next 12 hours */}
        {upcomingSecurityShifts.length > 0 && (
          <div className="border-t border-white/10 shrink-0">
            <div className="px-3 py-1.5 bg-gradient-to-l from-amber-900/40 to-amber-800/40 border-b border-white/10 flex items-center gap-2">
              <span className="text-sm">⏳</span>
              <h2 className="font-bold text-xs text-amber-100">ממתינים להגיע</h2>
              <span className="text-[10px] text-amber-300/70">12 שעות הבאות</span>
              <span className="text-[10px] bg-amber-800/60 text-amber-200 px-1.5 py-0.5 rounded-full mr-auto">
                {upcomingSecurityShifts.length}
              </span>
            </div>
            <div className={`p-1.5 ${upcomingSecurityShifts.length > 4 ? 'grid grid-cols-2 gap-1' : 'space-y-1'}`}>
              {upcomingSecurityShifts
                .sort((a, b) => {
                  const [ah, am] = a.start_time.split(':').map(Number);
                  const [bh, bm] = b.start_time.split(':').map(Number);
                  return (ah * 60 + am) - (bh * 60 + bm);
                })
                .map((entry, idx) => {
                  const isPatrol = entry.role_title && entry.role_title.includes('שיטור');
                  const isModified = entry.is_modified && !entry.is_removed;
                  const isRemoved = entry.is_removed;
                  return (
                    <div 
                      key={idx} 
                      onClick={() => setActionMenu({ open: true, entry })}
                      className={`rounded px-2 py-1 flex items-center justify-between text-xs cursor-pointer transition-all hover:bg-white/10 ${
                        isRemoved ? 'bg-red-900/10 border border-red-800/40 opacity-60'
                        : isModified ? 'bg-yellow-900/20 border border-yellow-600/40' 
                        : 'bg-white/5 border border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{isPatrol ? '🚓' : '👮'}</span>
                        <span className={`font-medium ${isRemoved ? 'text-gray-400 line-through' : 'text-white'}`}>
                          {entry.staff_name || entry.staff?.full_name || 'לא שובץ'}
                        </span>
                        {isRemoved && (
                          <span className="text-[9px] bg-red-900/60 text-red-300 px-1 py-0.5 rounded">❌ ירד</span>
                        )}
                        {isModified && (
                          <span className="text-[9px] bg-yellow-800/60 text-yellow-300 px-1 py-0.5 rounded">שונה</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {entry.vehicle && !isRemoved && (
                          <span className="text-gray-500">🚗 {entry.vehicle}</span>
                        )}
                        <span className={`font-mono font-bold ${isRemoved ? 'text-gray-500 line-through' : 'text-amber-300'}`}>
                          {entry.original_start_time || entry.start_time}-{entry.original_end_time || entry.end_time}
                        </span>
                        {isModified && entry.original_end_time && entry.original_end_time !== entry.end_time && (
                          <span className="text-yellow-500/50 line-through text-[9px] font-mono">{entry.original_end_time}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* On-Call Today - only in emergency mode */}
        {warMode && todayDuty.length > 0 && (
          <div className="border-t border-white/10 shrink-0">
            <div className="px-4 py-2 bg-white/5 border-b border-white/10 flex items-center gap-2">
              <span className="text-lg">📋</span>
              <h2 className="font-bold text-sm">כוננים היום</h2>
            </div>
            <div className="p-2 space-y-1">
              {todayDuty.map((duty, idx) => {
                const contact = contacts.find(c => c.id === duty.contact_id);
                if (!contact) return null;
                const isNow = currentDuty.some(d => d.id === duty.id);
                return (
                  <div key={idx} className={`rounded px-2 py-1 flex items-center justify-between text-xs ${
                    isNow ? 'bg-blue-900/30 border border-blue-700' : 'bg-white/5'
                  }`}>
                    <div className="flex items-center gap-2">
                      {isNow && <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>}
                      <span className="font-medium text-white">{contact.full_name}</span>
                    </div>
                    <span className="text-gray-400">
                      {duty.start_hour === duty.end_hour ? '24h' : 
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

      {/* Action Menu - opens on staff card click */}
      {actionMenu.open && actionMenu.entry && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setActionMenu({ open: false, entry: null })}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>👤</span>
                {actionMenu.entry.staff_name || actionMenu.entry.staff?.full_name}
              </h2>
              <span className="text-xs text-gray-400 font-mono">{actionMenu.entry.start_time}-{actionMenu.entry.end_time}</span>
            </div>

            <div className="space-y-2">
              {/* Break toggle */}
              <button
                onClick={() => {
                  toggleStaffBreak(actionMenu.entry.staff_id);
                  setActionMenu({ open: false, entry: null });
                }}
                className={`w-full text-right px-4 py-3 rounded-xl border transition flex items-center gap-3 ${
                  staffOnBreak[actionMenu.entry.staff_id]
                    ? 'bg-orange-900/40 border-orange-500 text-orange-200'
                    : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                }`}
              >
                <span className="text-xl">☕</span>
                <div>
                  <div className="font-bold text-sm">{staffOnBreak[actionMenu.entry.staff_id] ? 'סיום הפסקה' : 'הפסקה (30 דק\')'}</div>
                  <div className="text-xs text-gray-400">סטטוס מקומי - לא נשמר במערכת</div>
                </div>
              </button>

              {/* Custom status */}
              <button
                onClick={() => {
                  setTimingMode('immediate');
                  setStatusModal({
                    open: true,
                    staffId: actionMenu.entry.staff_id,
                    staffName: actionMenu.entry.staff_name || actionMenu.entry.staff?.full_name
                  });
                  setActionMenu({ open: false, entry: null });
                }}
                className="w-full text-right px-4 py-3 rounded-xl border bg-white/5 border-white/10 text-white hover:bg-white/10 transition flex items-center gap-3"
              >
                <span className="text-xl">⚡</span>
                <div>
                  <div className="font-bold text-sm">סטטוס מיוחד</div>
                  <div className="text-xs text-gray-400">טקסט חופשי + תזמון</div>
                </div>
              </button>

              <div className="border-t border-white/10 my-2"></div>
              <div className="text-[10px] text-gray-500 px-1 mb-1">שינויים במערכת (נשמרים ב-DB עם חותמת)</div>

              {/* Change end time */}
              <button
                onClick={() => {
                  setShiftChangeModal({ open: true, entry: actionMenu.entry, type: 'end_time_change' });
                  setActionMenu({ open: false, entry: null });
                }}
                className="w-full text-right px-4 py-3 rounded-xl border bg-white/5 border-white/10 text-white hover:bg-blue-900/20 hover:border-blue-700/50 transition flex items-center gap-3"
              >
                <span className="text-xl">⏰</span>
                <div>
                  <div className="font-bold text-sm">שינוי שעת סיום</div>
                  <div className="text-xs text-gray-400">מסיים מוקדם / מאוחר</div>
                </div>
              </button>

              {/* Change full hours */}
              <button
                onClick={() => {
                  setShiftChangeModal({ open: true, entry: actionMenu.entry, type: 'time_change' });
                  setActionMenu({ open: false, entry: null });
                }}
                className="w-full text-right px-4 py-3 rounded-xl border bg-white/5 border-white/10 text-white hover:bg-blue-900/20 hover:border-blue-700/50 transition flex items-center gap-3"
              >
                <span className="text-xl">🔄</span>
                <div>
                  <div className="font-bold text-sm">שינוי שעות משמרת</div>
                  <div className="text-xs text-gray-400">שינוי שעת התחלה וסיום</div>
                </div>
              </button>

              {/* Remove from shift */}
              <button
                onClick={() => {
                  setShiftChangeModal({ open: true, entry: actionMenu.entry, type: 'removed' });
                  setActionMenu({ open: false, entry: null });
                }}
                className="w-full text-right px-4 py-3 rounded-xl border bg-white/5 border-white/10 text-white hover:bg-red-900/20 hover:border-red-700/50 transition flex items-center gap-3"
              >
                <span className="text-xl">❌</span>
                <div>
                  <div className="font-bold text-sm">הורדה ממשמרת</div>
                  <div className="text-xs text-gray-400">מוריד מהמשמרת של היום</div>
                </div>
              </button>

              {/* Restore - only show if entry was modified */}
              {actionMenu.entry.is_modified && (
                <button
                  onClick={() => {
                    if (confirm('לשחזר את המשמרת המקורית?')) {
                      submitShiftChange(actionMenu.entry.id, 'restored', { reason: 'שחזור ע"י מוקד' });
                    }
                  }}
                  className="w-full text-right px-4 py-3 rounded-xl border bg-green-900/20 border-green-700/50 text-green-200 hover:bg-green-900/30 transition flex items-center gap-3"
                >
                  <span className="text-xl">↩️</span>
                  <div>
                    <div className="font-bold text-sm">שחזור מקורי</div>
                    <div className="text-xs text-green-400/70">חזרה לשעות המקוריות</div>
                  </div>
                </button>
              )}
            </div>

            <button
              onClick={() => setActionMenu({ open: false, entry: null })}
              className="w-full mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition text-sm"
            >
              סגירה
            </button>
          </div>
        </div>
      )}

      {/* Shift Change Modal - for DB-synced changes */}
      {shiftChangeModal.open && shiftChangeModal.entry && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShiftChangeModal({ open: false, entry: null, type: null })}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              {shiftChangeModal.type === 'removed' ? '❌' : shiftChangeModal.type === 'end_time_change' ? '⏰' : '🔄'}
              {shiftChangeModal.type === 'removed' ? 'הורדה ממשמרת' : shiftChangeModal.type === 'end_time_change' ? 'שינוי שעת סיום' : 'שינוי שעות משמרת'}
            </h2>
            <div className="text-sm text-gray-400 mb-4">
              {shiftChangeModal.entry.staff_name || shiftChangeModal.entry.staff?.full_name} • {shiftChangeModal.entry.start_time}-{shiftChangeModal.entry.end_time}
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const reason = formData.get('reason') || '';
              const requestedBy = formData.get('requested_by') || 'מחלקת ביטחון';

              if (!reason.trim()) {
                alert('נא להזין סיבה לשינוי');
                return;
              }

              const data = { reason, requested_by: requestedBy, changed_by: 'מוקד עירוני' };

              if (shiftChangeModal.type === 'end_time_change') {
                const newEnd = formData.get('new_end_time');
                if (!newEnd) { alert('נא להזין שעת סיום חדשה'); return; }
                data.new_end_time = newEnd;
              } else if (shiftChangeModal.type === 'time_change') {
                const newStart = formData.get('new_start_time');
                const newEnd = formData.get('new_end_time');
                if (!newStart && !newEnd) { alert('נא להזין לפחות שעה אחת'); return; }
                if (newStart) data.new_start_time = newStart;
                if (newEnd) data.new_end_time = newEnd;
              }

              submitShiftChange(shiftChangeModal.entry.id, shiftChangeModal.type, data);
            }}>
              {/* Time inputs for end_time_change */}
              {shiftChangeModal.type === 'end_time_change' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">שעת סיום חדשה</label>
                  <input
                    type="time"
                    name="new_end_time"
                    defaultValue={shiftChangeModal.entry.end_time}
                    required
                    className="w-full px-3 py-2.5 bg-gray-800 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none text-lg font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">סיום מקורי: {shiftChangeModal.entry.original_end_time || shiftChangeModal.entry.end_time}</p>
                </div>
              )}

              {/* Time inputs for full time_change */}
              {shiftChangeModal.type === 'time_change' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">שעות חדשות</label>
                  <div className="flex gap-3 items-center">
                    <div className="flex-1">
                      <input
                        type="time"
                        name="new_start_time"
                        defaultValue={shiftChangeModal.entry.start_time}
                        className="w-full px-3 py-2.5 bg-gray-800 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none font-mono"
                      />
                      <p className="text-xs text-gray-500 mt-1 text-center">התחלה</p>
                    </div>
                    <span className="text-gray-500 text-xl">←</span>
                    <div className="flex-1">
                      <input
                        type="time"
                        name="new_end_time"
                        defaultValue={shiftChangeModal.entry.end_time}
                        className="w-full px-3 py-2.5 bg-gray-800 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none font-mono"
                      />
                      <p className="text-xs text-gray-500 mt-1 text-center">סיום</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">מקורי: {shiftChangeModal.entry.original_start_time || shiftChangeModal.entry.start_time}-{shiftChangeModal.entry.original_end_time || shiftChangeModal.entry.end_time}</p>
                </div>
              )}

              {/* Removal confirmation */}
              {shiftChangeModal.type === 'removed' && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
                  <div className="text-red-200 text-sm font-bold mb-1">⚠️ הורדה ממשמרת</div>
                  <div className="text-red-300/80 text-xs">העובד יוסר מהמשמרת היומית. ניתן לשחזר מאוחר יותר.</div>
                </div>
              )}

              {/* Reason - required */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">סיבה לשינוי *</label>
                <input
                  type="text"
                  name="reason"
                  placeholder='לדוגמה: "לבקשת מנהל ביטחון - סיום מוקדם"'
                  maxLength="100"
                  autoFocus
                  required
                  className="w-full px-3 py-2.5 bg-gray-800 border-2 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none text-sm"
                />
              </div>

              {/* Requested by */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">מבקש השינוי</label>
                <input
                  type="text"
                  name="requested_by"
                  defaultValue="מחלקת ביטחון"
                  className="w-full px-3 py-2.5 bg-gray-800 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none text-sm"
                />
              </div>

              {/* Audit stamp preview */}
              <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-lg">
                <div className="text-[10px] text-gray-500 mb-1">חותמת שינוי:</div>
                <div className="text-xs text-gray-300">
                  📋 שונה ע"י: <span className="text-white font-bold">מוקד עירוני</span> • {new Date().toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShiftChangeModal({ open: false, entry: null, type: null })}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className={`flex-1 px-4 py-2 text-white rounded-lg font-medium transition ${
                    shiftChangeModal.type === 'removed'
                      ? 'bg-red-600 hover:bg-red-500'
                      : 'bg-blue-600 hover:bg-blue-500'
                  }`}
                >
                  {shiftChangeModal.type === 'removed' ? 'הורדה ממשמרת' : 'אישור שינוי'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Modal */}
      {statusModal.open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setStatusModal({ open: false, staffId: null, staffName: null })}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>⚡</span>
              סטטוס מיוחד - {statusModal.staffName}
            </h2>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const timing = formData.get('timing');
              const note = formData.get('note') || '';
              
              if (!note.trim()) {
                alert('נא להזין תיאור סטטוס');
                return;
              }
              
              let statusData = {
                type: 'custom',
                note
              };
              
              if (timing === 'immediate') {
                const hours = parseInt(formData.get('hours') || '0');
                const minutes = parseInt(formData.get('minutes') || '30');
                statusData.startTime = Date.now();
                statusData.duration = hours * 60 + minutes;
              } else {
                // Future scheduled
                const startTime = formData.get('start_time');
                const endTime = formData.get('end_time');
                
                if (!startTime || !endTime) {
                  alert('נא להזין שעות התחלה וסיום');
                  return;
                }
                
                const [startH, startM] = startTime.split(':').map(Number);
                const [endH, endM] = endTime.split(':').map(Number);
                
                const now = new Date();
                const start = new Date(now);
                start.setHours(startH, startM, 0, 0);
                
                const end = new Date(now);
                end.setHours(endH, endM, 0, 0);
                
                // If end time is before start, it means next day
                if (end <= start) {
                  end.setDate(end.getDate() + 1);
                }
                
                statusData.scheduledStart = start.getTime();
                statusData.scheduledEnd = end.getTime();
                statusData.isScheduled = true;
              }
              
              setStaffStatus(statusModal.staffId, statusData);
              setStatusModal({ open: false, staffId: null, staffName: null });
            }}>
              {/* Note */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">תיאור הסטטוס</label>
                <input 
                  type="text" 
                  name="note" 
                  placeholder='לדוגמה: "עם לוכד - זמין רק לכלבים"'
                  maxLength="50"
                  autoFocus
                  required
                  className="w-full px-3 py-2.5 bg-gray-800 border-2 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">מקסימום 50 תווים</p>
              </div>

              {/* Timing Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">מתי</label>
                <div className="flex gap-2">
                  <label className={`flex-1 flex items-center justify-center gap-2 p-3 bg-green-900/20 border-2 rounded-lg cursor-pointer hover:bg-green-900/30 transition ${
                    timingMode === 'immediate' ? 'border-green-500 bg-green-900/40' : 'border-green-700/50'
                  }`}>
                    <input 
                      type="radio" 
                      name="timing" 
                      value="immediate" 
                      checked={timingMode === 'immediate'}
                      onChange={(e) => setTimingMode(e.target.value)}
                      className="w-4 h-4" 
                    />
                    <span className="text-white font-medium text-sm">⚡ מיידי</span>
                  </label>
                  
                  <label className={`flex-1 flex items-center justify-center gap-2 p-3 bg-purple-900/20 border-2 rounded-lg cursor-pointer hover:bg-purple-900/30 transition ${
                    timingMode === 'scheduled' ? 'border-purple-500 bg-purple-900/40' : 'border-purple-700/50'
                  }`}>
                    <input 
                      type="radio" 
                      name="timing" 
                      value="scheduled" 
                      checked={timingMode === 'scheduled'}
                      onChange={(e) => setTimingMode(e.target.value)}
                      className="w-4 h-4" 
                    />
                    <span className="text-white font-medium text-sm">⏰ מתוזמן</span>
                  </label>
                </div>
              </div>

              {/* Immediate Duration */}
              {timingMode === 'immediate' && (
                <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">משך זמן</label>
                <div className="flex gap-3 items-center">
                  <div className="flex-1">
                    <input 
                      type="number" 
                      name="hours" 
                      min="0" 
                      max="8" 
                      defaultValue="0"
                      placeholder="שעות"
                      className="w-full px-3 py-2.5 bg-gray-800 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none text-center"
                    />
                    <p className="text-xs text-gray-500 mt-1 text-center">שעות</p>
                  </div>
                  <span className="text-gray-500 text-xl">:</span>
                  <div className="flex-1">
                    <input 
                      type="number" 
                      name="minutes" 
                      min="0" 
                      max="59" 
                      defaultValue="30"
                      placeholder="דקות"
                      className="w-full px-3 py-2.5 bg-gray-800 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none text-center"
                    />
                    <p className="text-xs text-gray-500 mt-1 text-center">דקות</p>
                  </div>
                </div>
                </div>
              )}

              {/* Scheduled Time Range */}
              {timingMode === 'scheduled' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">טווח זמנים</label>
                  <div className="flex gap-3 items-center">
                    <div className="flex-1">
                      <input 
                        type="time" 
                        name="start_time"
                        className="w-full px-3 py-2.5 bg-gray-800 border-2 border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                      />
                      <p className="text-xs text-gray-500 mt-1 text-center">התחלה</p>
                    </div>
                    <span className="text-gray-500 text-xl">←</span>
                    <div className="flex-1">
                      <input 
                        type="time" 
                        name="end_time"
                        className="w-full px-3 py-2.5 bg-gray-800 border-2 border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                      />
                      <p className="text-xs text-gray-500 mt-1 text-center">סיום</p>
                    </div>
                  </div>
                  <p className="text-xs text-purple-400 mt-2">💡 הסטטוס יופעל רק בטווח הזמנים שנבחר</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setStatusModal({ open: false, staffId: null, staffName: null })}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  ביטול
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition"
                >
                  אישור
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
