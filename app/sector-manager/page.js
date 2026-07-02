'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import toast, { Toaster } from 'react-hot-toast';
import ActiveEventBanner from '@/components/ActiveEventBanner';
import SecurityWeeklySchedule from '@/components/SecurityWeeklySchedule';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAYS_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const SHIFT_PRESETS = [
  { label: '24h', start: 8, end: 8, icon: '🔄', color: 'bg-blue-100 text-blue-800', desc: '24 שעות' },
  { label: 'בוקר', start: 8, end: 16, icon: '🌅', color: 'bg-yellow-100 text-yellow-800', desc: '08:00-16:00' },
  { label: 'ערב', start: 16, end: 0, icon: '🌆', color: 'bg-orange-100 text-orange-800', desc: '16:00-00:00' },
  { label: 'לילה', start: 0, end: 8, icon: '🌙', color: 'bg-indigo-100 text-indigo-800', desc: '00:00-08:00' },
  { label: 'לן', start: 20, end: 8, icon: '🛏️', color: 'bg-purple-100 text-purple-800', desc: '20:00-08:00', notes: '[לן]' },
];

// Get week start date (Sunday) for a given date
function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0); // Reset time to start of day
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Format date for display
function formatDate(date) {
  return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Format date for DB (YYYY-MM-DD) in local timezone
function formatDateForDB(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format date range
function formatWeekRange(weekStart) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
}

// Get shift label with icon
function getShiftLabel(startHour, endHour, notes) {
  if (notes?.includes('[לן]')) return '🛏️ לן';
  if (startHour === 8 && endHour === 8) return '🔄 24h';
  if (startHour === 8 && endHour === 16) return '🌅 בוקר';
  if (startHour === 16 && endHour === 0) return '🌆 ערב';
  if (startHour === 0 && endHour === 8) return '🌙 לילה';
  return '⏰ כונן';
}

export default function SectorManagerPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('contacts');
  const [warMode, setWarMode] = useState(false);
  const [myDepartment, setMyDepartment] = useState(null);
  const [userDepartments, setUserDepartments] = useState([]);
  const [activeDepartmentId, setActiveDepartmentId] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [dutyRoster, setDutyRoster] = useState([]);
  const [allDepartments, setAllDepartments] = useState([]);
  const [currentOnCall, setCurrentOnCall] = useState([]);
  const [selectedDateTime, setSelectedDateTime] = useState(new Date());
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickAddData, setQuickAddData] = useState({ 
    dayIndex: 0, 
    contactId: '', 
    shiftType: 0, 
    usePreset: true,
    startHour: 8,
    endHour: 16,
    notes: '',
    existingCount: 0,
    existingForContact: []
  });
  const [contactForm, setContactForm] = useState({ full_name: '', phone: '', role: '' });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Permanent duty
  const [showPermanentModal, setShowPermanentModal] = useState(false);
  const [permanentContactId, setPermanentContactId] = useState('');
  const [permanentDuties, setPermanentDuties] = useState([]);
  
  // Filters
  const [filterDay, setFilterDay] = useState('all');
  const [filterShift, setFilterShift] = useState('all');
  const [filterContact, setFilterContact] = useState('all');
  const [editData, setEditData] = useState({ 
    dutyId: null,
    contactId: '',
    dayIndex: 0,
    usePreset: false,
    shiftType: 0,
    startHour: 8,
    endHour: 16,
    notes: ''
  });
  
  // Current week for display
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  
  // Get week dates for display
  const getWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate() + i);
      dates.push(date);
    }
    return dates;
  };
  
  const weekDates = getWeekDates();
  
  // Format date for display
  const formatDate = (date) => {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    return `${day}/${month}`;
  };
  
  // Get week range string
  const getWeekRangeString = () => {
    if (!weekDates || weekDates.length < 7) return '';
    const start = weekDates[0];
    const end = weekDates[6];
    const startStr = `${start.getDate()}.${start.getMonth() + 1}`;
    const endStr = `${end.getDate()}.${end.getMonth() + 1}.${end.getFullYear()}`;
    return `${startStr} - ${endStr}`;
  };
  
  // Week navigation functions
  const goToPreviousWeek = () => {
    const newDate = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newDate);
  };
  
  const goToNextWeek = () => {
    const newDate = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newDate);
  };
  
  const goToCurrentWeek = () => {
    setCurrentWeekStart(getWeekStart(new Date()));
  };
  
  // Get filtered duties
  const getFilteredDuties = () => {
    let filtered = [...dutyRoster];
    
    if (filterDay !== 'all') {
      filtered = filtered.filter(d => d.day_of_week === parseInt(filterDay));
    }
    
    if (filterShift !== 'all') {
      filtered = filtered.filter(d => {
        if (filterShift === '24h') return d.start_hour === 8 && d.end_hour === 8;
        if (filterShift === 'morning') return d.start_hour === 8 && d.end_hour === 16;
        if (filterShift === 'evening') return d.start_hour === 16 && d.end_hour === 0;
        if (filterShift === 'night') return d.start_hour === 0 && d.end_hour === 8;
        if (filterShift === 'sleep') return d.notes?.includes('[לן]');
        return true;
      });
    }
    
    if (filterContact !== 'all') {
      filtered = filtered.filter(d => d.contact_id === filterContact);
    }
    
    return filtered;
  };
  
  // Group duties by day
  const getDutiesByDay = () => {
    const filtered = getFilteredDuties();
    const grouped = {};
    
    for (let i = 0; i < 7; i++) {
      grouped[i] = filtered.filter(d => d.day_of_week === i);
    }
    
    return grouped;
  };

  useEffect(() => {
    checkAuth();

    // Fetch war mode status
    const fetchWarMode = async () => {
      try {
        const res = await fetch('/api/war-mode');
        const data = await res.json();
        if (data.success && data.data) {
          setWarMode(data.data.is_active || false);
          if (data.data.is_active) setActiveTab('calendar');
        }
      } catch (error) {
        console.error('Failed to fetch war mode:', error);
      }
    };
    fetchWarMode();

    // Subscribe to war mode changes
    const channel = supabase
      .channel('war_mode_changes_sm')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'war_mode' },
        (payload) => {
          const isActive = payload.new.is_active || false;
          setWarMode(isActive);
          if (!isActive) setActiveTab('contacts');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (user) {
      loadUserDepartments();
      loadAllDepartments();
    }
  }, [user]);

  useEffect(() => {
    if (user && activeDepartmentId) {
      loadMyDepartment();
      loadContacts();
      loadDutyRoster();
      loadCurrentOnCall();
      localStorage.setItem('activeDepartmentId', activeDepartmentId);
    }
  }, [user, activeDepartmentId]);

  useEffect(() => {
    if (user) {
      loadDutyRoster();
      loadCurrentOnCall(selectedDateTime);
    }
  }, [currentWeekStart, user, selectedDateTime]);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include'
      });

      if (!res.ok) {
        router.push('/login');
        return;
      }

      const data = await res.json();
      
      console.log('🔍 User data from API:', data.user);
      console.log('📋 department_id:', data.user.department_id);
      console.log('🎭 role:', data.user.role);
      
      if (data.user.role !== 'sector_manager' && data.user.role !== 'admin') {
        toast.error('אין הרשאה לצפות בדף זה');
        router.push('/dashboard');
        return;
      }

      // Check for both null and undefined
      if (!data.user.department_id || data.user.department_id === null) {
        console.error('❌ No department_id found for user');
        toast.error('לא הוקצה מכלול למשתמש זה. נא לפנות למנהל המערכת.');
        setTimeout(() => router.push('/dashboard'), 2000);
        return;
      }

      console.log('✅ User authenticated with department_id:', data.user.department_id);
      setUser(data.user);
    } catch (error) {
      console.error('Auth error:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const loadMyDepartment = async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('id', activeDepartmentId || user.department_id)
      .single();
    
    if (data) setMyDepartment(data);
  };

  const loadUserDepartments = async () => {
    console.log('🔍 Loading user departments for user:', user.id);
    
    try {
      // קריאה ל-API במקום Supabase ישירות (עוקף RLS issues)
      const res = await fetch(`/api/user-departments?userId=${user.id}`);
      const { departments, error } = await res.json();
      
      console.log('📊 User departments data:', departments);
      console.log('❌ User departments error:', error);
      console.log('📈 User departments count:', departments?.length || 0);
      
      if (departments && departments.length > 0) {
        console.log('✅ Setting userDepartments to:', departments);
        setUserDepartments(departments);
        
        // טען את המחלקה השמורה מ-localStorage או את ה-primary
        const savedDeptId = localStorage.getItem('activeDepartmentId');
        const savedDept = departments.find(d => d.department_id === savedDeptId);
        const primaryDept = departments.find(d => d.is_primary);
        
        const activeDept = savedDept || primaryDept || departments[0];
        setActiveDepartmentId(activeDept.department_id);
      } else {
        // אם אין רשומות ב-user_departments, השתמש ב-department_id הישן
        setActiveDepartmentId(user.department_id);
        setUserDepartments([]);
      }
    } catch (error) {
      console.error('❌ Error loading user departments:', error);
      setActiveDepartmentId(user.department_id);
      setUserDepartments([]);
    }
  };

  const loadContacts = async () => {
    if (!activeDepartmentId && !user.department_id) return;
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('department_id', activeDepartmentId || user.department_id)
      .order('full_name');
    
    if (data) setContacts(data);
  };

  const loadAllDepartments = async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name');
    
    if (data) setAllDepartments(data);
  };

  const loadCurrentOnCall = async (dateTime = selectedDateTime) => {
    const targetDate = dateTime || new Date();
    const currentDay = targetDate.getDay();
    const currentHour = targetDate.getHours();
    const weekStartStr = formatDateForDB(getWeekStart(targetDate));

    // Week-specific duties
    const { data: weekData, error: weekError } = await supabase
      .from('duty_roster')
      .select(`
        *,
        contact:contacts(full_name, phone, role),
        department:departments(name)
      `)
      .eq('week_start_date', weekStartStr)
      .eq('day_of_week', currentDay);

    // Permanent duties (week_start_date IS NULL)
    const { data: permData, error: permError } = await supabase
      .from('duty_roster')
      .select(`
        *,
        contact:contacts(full_name, phone, role),
        department:departments(name)
      `)
      .is('week_start_date', null)
      .eq('day_of_week', currentDay);
    
    const allData = [...(weekData || []), ...(permData || [])];
    
    // Filter by current hour
    const filtered = allData.filter(duty => {
      const startHour = duty.start_hour;
      const endHour = duty.end_hour;
      
      // Handle 24h / permanent shifts (start === end)
      if (startHour === endHour) return true;
      
      // Handle overnight shifts (e.g., 20:00 to 08:00)
      if (endHour <= startHour) {
        return currentHour >= startHour || currentHour < endHour;
      }
      // Normal shifts (e.g., 08:00 to 16:00)
      return currentHour >= startHour && currentHour < endHour;
    });
    
    setCurrentOnCall(filtered);
  };

  const loadDutyRoster = async () => {
    // Format week_start_date for DB query (YYYY-MM-DD) in local timezone
    const weekStartStr = formatDateForDB(currentWeekStart);
    const deptId = activeDepartmentId || user.department_id;
    
    // Load week-specific duties
    const { data: weekData, error: weekError } = await supabase
      .from('duty_roster')
      .select(`
        *,
        contact:contacts(full_name, phone, role)
      `)
      .eq('department_id', deptId)
      .eq('week_start_date', weekStartStr)
      .order('day_of_week')
      .order('start_hour');
    
    // Load permanent duties (week_start_date IS NULL)
    const { data: permData, error: permError } = await supabase
      .from('duty_roster')
      .select(`
        *,
        contact:contacts(full_name, phone, role)
      `)
      .eq('department_id', deptId)
      .is('week_start_date', null)
      .order('day_of_week')
      .order('start_hour');
    
    const combined = [...(permData || []), ...(weekData || [])];
    if (permData) setPermanentDuties(permData);
    setDutyRoster(combined);
  };

  const handleAddPermanentDuty = async (contactId) => {
    if (!contactId) {
      toast.error('נא לבחור איש קשר');
      return;
    }

    // Check if already permanent
    const existing = permanentDuties.find(d => d.contact_id === contactId);
    if (existing) {
      toast.error('איש קשר זה כבר מוגדר ככונן קבוע');
      return;
    }

    // Create 7 permanent entries (one per day) with 24h shifts
    const deptId = activeDepartmentId || user.department_id;
    const entries = Array.from({ length: 7 }, (_, dayIndex) => ({
      department_id: deptId,
      contact_id: contactId,
      day_of_week: dayIndex,
      start_hour: 0,
      end_hour: 0,
      notes: '[קבוע]',
      week_start_date: null
    }));

    const { error } = await supabase
      .from('duty_roster')
      .insert(entries);

    if (error) {
      toast.error('שגיאה ביצירת כוננות קבועה');
      console.error(error);
    } else {
      toast.success('✅ כונן קבוע 24/7 נוסף בהצלחה!');
      setShowPermanentModal(false);
      setPermanentContactId('');
      loadDutyRoster();
    }
  };

  const handleRemovePermanentDuty = async (contactId) => {
    if (!confirm('האם להסיר את הכוננות הקבועה של איש קשר זה?')) return;
    
    const deptId = activeDepartmentId || user.department_id;
    const { error } = await supabase
      .from('duty_roster')
      .delete()
      .eq('contact_id', contactId)
      .eq('department_id', deptId)
      .is('week_start_date', null);

    if (error) {
      toast.error('שגיאה בהסרת כוננות קבועה');
      console.error(error);
    } else {
      toast.success('כוננות קבועה הוסרה ✅');
      loadDutyRoster();
    }
  };

  const isPermanentContact = (contactId) => {
    return permanentDuties.some(d => d.contact_id === contactId);
  };

  const handleAddContact = async () => {
    if (!contactForm.full_name || !contactForm.phone) {
      toast.error('נא למלא שם וטלפון');
      return;
    }

    const { data, error } = await supabase
      .from('contacts')
      .insert([{
        department_id: activeDepartmentId || user.department_id,
        full_name: contactForm.full_name,
        phone: contactForm.phone,
        role: contactForm.role
      }])
      .select();

    if (error) {
      toast.error('שגיאה בהוספת איש קשר');
      console.error(error);
    } else {
      toast.success('איש קשר נוסף בהצלחה! 👤');
      setShowAddContactModal(false);
      setContactForm({ full_name: '', phone: '', role: '' });
      loadContacts();
    }
  };

  const handleQuickAddDuty = async () => {
    if (!quickAddData.contactId) {
      toast.error('נא לבחור איש קשר');
      return;
    }

    let startHour, endHour, notes;
    
    if (quickAddData.usePreset) {
      const preset = SHIFT_PRESETS[quickAddData.shiftType];
      startHour = preset.start;
      endHour = preset.end;
      notes = preset.notes || '';
    } else {
      startHour = quickAddData.startHour;
      endHour = quickAddData.endHour;
      notes = quickAddData.notes;
    }

    // Format week_start_date for DB (YYYY-MM-DD) in local timezone
    const weekStartStr = formatDateForDB(currentWeekStart);

    const { data, error } = await supabase
      .from('duty_roster')
      .insert([{
        department_id: activeDepartmentId || user.department_id,
        contact_id: quickAddData.contactId,
        day_of_week: quickAddData.dayIndex,
        start_hour: startHour,
        end_hour: endHour,
        notes: notes,
        week_start_date: weekStartStr
      }])
      .select();

    if (error) {
      toast.error('שגיאה בהוספת כוננות');
      console.error(error);
    } else {
      const label = quickAddData.usePreset ? SHIFT_PRESETS[quickAddData.shiftType].label : 'כונן';
      toast.success(`${label} נוסף בהצלחה!`);
      setShowQuickAddModal(false);
      setQuickAddData({ 
        dayIndex: 0, 
        contactId: '', 
        shiftType: 0, 
        usePreset: true,
        startHour: 8,
        endHour: 16,
        notes: '',
        existingCount: 0,
        existingForContact: []
      });
      loadDutyRoster();
    }
  };

  const handleSelectSlot = (slotInfo) => {
    const dayOfWeek = slotInfo.start.getDay();
    const hour = slotInfo.start.getHours();
    
    // Check existing duties for this day
    const existingDutiesForDay = dutyRoster.filter(d => d.day_of_week === dayOfWeek);
    
    setQuickAddData({ 
      dayIndex: dayOfWeek, 
      contactId: '', 
      shiftType: 0,
      usePreset: true,
      startHour: hour || 8,
      endHour: (hour || 8) + 8,
      notes: '',
      existingCount: existingDutiesForDay.length,
      existingForContact: []
    });
    setShowQuickAddModal(true);
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
  };

  const handleDeleteFromCalendar = async (eventId) => {
    if (!confirm('האם למחוק כוננות זו?')) return;
    await handleDeleteDuty(eventId);
    setSelectedEvent(null);
  };

  const handleEditFromCalendar = (event) => {
    setEditData({
      dutyId: event.resource?.dutyId,
      contactId: event.resource?.contactId,
      dayIndex: new Date(event.start).getDay(),
      usePreset: false,
      shiftType: 0,
      startHour: event.resource?.startHour,
      endHour: event.resource?.endHour,
      notes: event.resource?.notes || ''
    });
    setSelectedEvent(null);
    setShowEditModal(true);
  };

  const handleUpdateDuty = async () => {
    if (!editData.contactId) {
      toast.error('שגיאה בעדכון');
      return;
    }

    let startHour, endHour, notes;
    
    if (editData.usePreset) {
      const preset = SHIFT_PRESETS[editData.shiftType];
      startHour = preset.start;
      endHour = preset.end;
      notes = preset.notes || '';
    } else {
      startHour = editData.startHour;
      endHour = editData.endHour;
      notes = editData.notes;
    }

    // Format week_start_date for DB (YYYY-MM-DD) in local timezone
    const weekStartStr = formatDateForDB(currentWeekStart);

    const { error } = await supabase
      .from('duty_roster')
      .update({
        contact_id: editData.contactId,
        day_of_week: editData.dayIndex,
        start_hour: startHour,
        end_hour: endHour,
        notes: notes,
        week_start_date: weekStartStr
      })
      .eq('id', editData.dutyId);

    if (error) {
      toast.error('שגיאה בעדכון כוננות');
      console.error(error);
    } else {
      toast.success('✅ הכוננות עודכנה בהצלחה!');
      setShowEditModal(false);
      setEditData({ 
        dutyId: null,
        contactId: '',
        dayIndex: 0,
        usePreset: false,
        shiftType: 0,
        startHour: 8,
        endHour: 16,
        notes: ''
      });
      loadDutyRoster();
    }
  };

  const handleDeleteDuty = async (dutyId) => {
    if (!confirm('האם למחוק תורנות זו?')) return;

    const { error } = await supabase
      .from('duty_roster')
      .delete()
      .eq('id', dutyId);

    if (error) {
      toast.error('שגיאה במחיקת תורנות');
    } else {
      toast.success('תורנות נמחקה ✅');
      loadDutyRoster();
    }
  };

  const handleDeleteContact = async (contactId) => {
    if (!confirm('האם למחוק איש קשר זה?')) return;

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId);

    if (error) {
      toast.error('שגיאה במחיקת איש קשר');
    } else {
      toast.success('איש קשר נמחק ✅');
      loadContacts();
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      router.push('/login');
    } catch (error) {
      toast.error('שגיאה בהתנתקות');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען...</p>
        </div>
      </div>
    );
  }

  // Calculate completion status
  const getCompletionStatus = () => {
    const totalDays = 7;
    const filledDays = new Set(dutyRoster.map(d => d.day_of_week)).size;
    return { filled: filledDays, total: totalDays, percentage: Math.round((filledDays / totalDays) * 100) };
  };

  const completionStatus = getCompletionStatus();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50" dir="rtl">
      <Toaster position="top-center" />
      <ActiveEventBanner />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        
        {/* Stats Cards - Enhanced */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-6 transform active:scale-95 sm:hover:scale-105 transition-transform">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs sm:text-sm text-green-100 mb-1">אנשי קשר במכלול</p>
                <p className="text-2xl sm:text-4xl font-bold">{contacts.length}</p>
              </div>
              <div className="text-3xl sm:text-5xl opacity-80">👥</div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-6 transform active:scale-95 sm:hover:scale-105 transition-transform">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs sm:text-sm text-blue-100 mb-1">משמרות שבועיות</p>
                <p className="text-2xl sm:text-4xl font-bold">{dutyRoster.length}</p>
              </div>
              <div className="text-3xl sm:text-5xl opacity-80">📅</div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-6 transform active:scale-95 sm:hover:scale-105 transition-transform">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs sm:text-sm text-orange-100 mb-1">כוננים היום</p>
                <p className="text-2xl sm:text-4xl font-bold">
                  {dutyRoster.filter(d => d.day_of_week === new Date().getDay()).length}
                </p>
              </div>
              <div className="text-3xl sm:text-5xl opacity-80">⏰</div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-6 transform active:scale-95 sm:hover:scale-105 transition-transform">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs sm:text-sm text-purple-100 mb-1">ימים ממולאים</p>
                <p className="text-2xl sm:text-4xl font-bold">{completionStatus.filled}/7</p>
              </div>
              <div className="text-3xl sm:text-5xl opacity-80">✅</div>
            </div>
          </div>
        </div>

        {/* Department Switcher - For users with multiple departments */}
        {userDepartments.length > 1 && (
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">🏢 מכלול:</span>
              <select
                value={activeDepartmentId || ''}
                onChange={(e) => setActiveDepartmentId(e.target.value)}
                className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg font-medium focus:border-purple-500 focus:outline-none"
              >
                {userDepartments.map((ud) => (
                  <option 
                    key={ud.department_id} 
                    value={ud.department_id}
                  >
                    {ud.department?.name}{ud.is_primary ? ' ⭐ ראשי' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-4 sm:mb-6">
          <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="flex -mb-px min-w-max">
              {warMode && (
              <button
                onClick={() => setActiveTab('calendar')}
                className={`px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'calendar'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🚨 <span className="hidden sm:inline">כוננויות חירום שבועי</span><span className="sm:hidden">כוננויות חירום</span>
              </button>
              )}
              <button
                onClick={() => setActiveTab('contacts')}
                className={`px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'contacts'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                � אנשי קשר - המכלול שלי
              </button>
              {myDepartment?.name?.includes('בטחון') && (
              <button
                onClick={() => setActiveTab('work-schedule')}
                className={`px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'work-schedule'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📋 <span className="hidden sm:inline">סידור עבודה שבועי</span><span className="sm:hidden">סידור עבודה</span>
              </button>
              )}
            </nav>
          </div>
        </div>

        {/* Tab Content - Security Work Schedule */}
        {activeTab === 'work-schedule' && myDepartment?.name?.includes('בטחון') && (
          <SecurityWeeklySchedule departmentId={activeDepartmentId || user?.department_id} />
        )}

        {/* Tab Content - Weekly Calendar - Only in emergency mode */}
        {warMode && activeTab === 'calendar' && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Calendar Header */}
            <div className="p-3 sm:p-4 bg-gradient-to-l from-purple-50 to-blue-50 border-b-2 border-purple-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">� לוח כוננויות חירום שבועי</h2>
                
                {/* Legend */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  {SHIFT_PRESETS.map((preset, idx) => (
                    <div key={idx} className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${preset.color}`}>
                      {preset.icon} <span className="hidden sm:inline">{preset.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mt-2 sm:mt-3 text-xs sm:text-sm text-purple-700 bg-purple-50 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2">
                💡 <strong>טיפ:</strong> <span className="hidden sm:inline">לחץ על תא ריק בלוח כדי להוסיף כונן | לחץ על כונן קיים כדי לערוך או למחוק</span><span className="sm:hidden">הקש להוספת/עריכת כונן</span>
              </div>
            </div>

            {/* Week Navigation */}
            <div className="mb-3 sm:mb-4 flex items-center justify-between bg-white border-2 border-purple-200 rounded-lg sm:rounded-xl px-2 sm:px-4 py-2 sm:py-3 shadow-sm">
              <button
                onClick={goToPreviousWeek}
                className="px-2 sm:px-4 py-1.5 sm:py-2 bg-purple-100 active:bg-purple-200 sm:hover:bg-purple-200 text-purple-700 rounded-lg font-bold transition-all flex items-center gap-1 sm:gap-2 text-xs sm:text-base"
              >
                שבוע קודם
              </button>
              
              <div className="text-center">
                <div className="text-xs sm:text-sm font-bold text-gray-900">{getWeekRangeString()}</div>
                <button
                  onClick={goToCurrentWeek}
                  className="text-[10px] sm:text-xs text-purple-600 active:text-purple-800 sm:hover:text-purple-800 font-semibold mt-0.5 sm:mt-1"
                >
                  <span className="hidden sm:inline">חזור לשבוע הנוכחי</span><span className="sm:hidden">עכשיו</span>
                </button>
              </div>
              
              <button
                onClick={goToNextWeek}
                className="px-2 sm:px-4 py-1.5 sm:py-2 bg-purple-100 active:bg-purple-200 sm:hover:bg-purple-200 text-purple-700 rounded-lg font-bold transition-all flex items-center gap-1 sm:gap-2 text-xs sm:text-base"
              >
                שבוע הבא
              </button>
            </div>

            {/* Weekly Table */}
            <div className="bg-white border-2 border-purple-100 rounded-lg sm:rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto -mx-3 sm:mx-0 max-h-[600px] overflow-y-auto">
                <table className="w-full text-[10px] sm:text-xs relative">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-gradient-to-l from-purple-50 to-blue-50">
                        <th className="p-1.5 sm:p-3 text-right border-b-2 border-purple-200 font-bold text-gray-800 sticky right-0 bg-gradient-to-l from-purple-50 to-blue-50 min-w-[80px] sm:min-w-[120px] text-xs sm:text-sm z-30">
                          <span className="hidden sm:inline">👤 שם הכונן</span><span className="sm:hidden">👤</span>
                        </th>
                        {DAYS_SHORT.map((d, i) => (
                          <th key={i} className="p-1 sm:p-2 text-center border-b-2 border-purple-200 font-bold text-gray-700 min-w-[70px] sm:min-w-[100px] bg-gradient-to-l from-purple-50 to-blue-50">
                            <div className="text-xs sm:text-sm">{d}</div>
                            <div className="text-[9px] sm:text-[10px] font-normal text-gray-500 mt-0.5 hidden sm:block">{DAYS[i]}</div>
                            <div className="text-[10px] sm:text-xs font-bold text-purple-600 mt-0.5 sm:mt-1">{formatDate(weekDates[i])}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map(contact => {
                        return (
                          <tr key={contact.id} className="border-b border-gray-100 hover:bg-purple-50/30 transition-colors">
                            <td className="p-1 sm:p-2 font-bold text-gray-900 sticky right-0 bg-white text-xs sm:text-sm min-w-[100px] sm:min-w-[120px]">
                              <div className="break-words leading-tight">{contact.full_name}</div>
                              {contact.role && (
                                <div className="text-[9px] sm:text-[10px] text-gray-500 font-normal mt-0.5 hidden sm:block">{contact.role}</div>
                              )}
                            </td>
                            {DAYS_SHORT.map((_, dayIdx) => {
                              const duties = dutyRoster.filter(d => d.contact_id === contact.id && d.day_of_week === dayIdx);
                              return (
                                <td key={dayIdx} className="p-0.5 sm:p-1 text-center align-top">
                                  {duties.length === 0 ? (
                                    <button
                                      onClick={() => {
                                        setQuickAddData({ 
                                          dayIndex: dayIdx, 
                                          contactId: contact.id, 
                                          shiftType: 0, 
                                          usePreset: true,
                                          startHour: 8,
                                          endHour: 16,
                                          notes: '',
                                          existingCount: 0,
                                          existingForContact: []
                                        });
                                        setShowQuickAddModal(true);
                                      }}
                                      className="w-full h-full min-h-[35px] sm:min-h-[40px] flex items-center justify-center text-gray-300 active:text-purple-600 active:bg-purple-50 sm:hover:text-purple-600 sm:hover:bg-purple-50 rounded transition-all group"
                                    >
                                      <span className="text-lg sm:text-xl group-active:scale-125 sm:group-hover:scale-125 transition-transform">+</span>
                                    </button>
                                  ) : (
                                    <div className="space-y-1">
                                      {duties.map(duty => {
                                        const isSleep = duty.notes?.includes('[לן]');
                                        const sh = String(duty.start_hour).padStart(2, '0');
                                        const eh = String(duty.end_hour).padStart(2, '0');
                                        const isOvernight = duty.end_hour < duty.start_hour && duty.end_hour !== 0;
                                        let label, bgClass, textClass;
                                        
                                        const isPerm = duty.notes?.includes('[קבוע]');
                                        if (isPerm) {
                                          label = '🔒 קבוע';
                                          bgClass = 'bg-amber-100';
                                          textClass = 'text-amber-800';
                                        } else if (duty.start_hour === duty.end_hour) {
                                          label = '24h';
                                          bgClass = 'bg-blue-100';
                                          textClass = 'text-blue-800';
                                        } else if (isSleep) {
                                          label = `${sh}:00-${eh}:00`;
                                          bgClass = 'bg-orange-100';
                                          textClass = 'text-orange-800';
                                        } else if (isOvernight) {
                                          label = `${sh}:00-${eh}:00+`;
                                          bgClass = 'bg-indigo-100';
                                          textClass = 'text-indigo-800';
                                        } else if (duty.end_hour === 0) {
                                          label = `${sh}:00-חצות`;
                                          bgClass = 'bg-purple-100';
                                          textClass = 'text-purple-800';
                                        } else {
                                          label = `${sh}:00-${eh}:00`;
                                          bgClass = 'bg-green-100';
                                          textClass = 'text-green-800';
                                        }
                                        
                                        return (
                                          <div key={duty.id} className={`relative text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-1 rounded-md sm:rounded-lg group ${bgClass} ${textClass}`}>
                                            <span className="block sm:inline">{label}</span>
                                            {isSleep && <span className="ml-0.5">🏢</span>}
                                            <button
                                              onClick={() => {
                                                setEditData({
                                                  dutyId: duty.id,
                                                  contactId: duty.contact_id,
                                                  dayIndex: dayIdx,
                                                  usePreset: false,
                                                  shiftType: 0,
                                                  startHour: duty.start_hour,
                                                  endHour: duty.end_hour,
                                                  notes: duty.notes || ''
                                                });
                                                setShowEditModal(true);
                                              }}
                                              className="absolute -top-1 -right-1 w-5 h-5 sm:w-4 sm:h-4 bg-blue-500 text-white rounded-full text-[10px] sm:text-[8px] leading-none flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-md active:bg-blue-600 sm:hover:bg-blue-600"
                                            >
                                              ✏️
                                            </button>
                                            <button
                                              onClick={() => handleDeleteDuty(duty.id)}
                                              className="absolute -top-1 -left-1 w-5 h-5 sm:w-4 sm:h-4 bg-red-500 text-white rounded-full text-[10px] sm:text-[8px] leading-none flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-md active:bg-red-600 sm:hover:bg-red-600"
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        );
                                      })}
                                      <button
                                        onClick={() => {
                                          setQuickAddData({ 
                                            dayIndex: dayIdx, 
                                            contactId: contact.id, 
                                            shiftType: 0, 
                                            usePreset: true,
                                            startHour: 8,
                                            endHour: 16,
                                            notes: '',
                                            existingCount: duties.length,
                                            existingForContact: []
                                          });
                                          setShowQuickAddModal(true);
                                        }}
                                        className="w-full text-[9px] sm:text-[10px] text-purple-600 active:text-purple-800 sm:hover:text-purple-800 font-semibold py-1 active:bg-purple-50 sm:hover:bg-purple-50 rounded transition-colors"
                                      >
                                        + <span className="hidden sm:inline">הוסף משמרת</span><span className="sm:hidden">+</span>
                                      </button>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              <div className="px-4 py-3 bg-gradient-to-l from-purple-50 to-blue-50 border-t-2 border-purple-100">
                <p className="text-[11px] text-purple-700 font-semibold text-center">
                  💡 לחץ על + כדי להוסיף משמרת | ✏️ לערוך | ✕ למחוק | 🏢 = לן בעירייה
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content - Contacts */}
        {activeTab === 'contacts' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-3 sm:p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">אנשי קשר במכלול</h2>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setShowPermanentModal(true)}
                    className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 bg-amber-500 active:bg-amber-600 sm:hover:bg-amber-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    🔒 כונן קבוע 24/7
                  </button>
                  <button
                    onClick={() => setShowAddContactModal(true)}
                    className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 bg-green-600 active:bg-green-700 sm:hover:bg-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    ➕ הוסף איש קשר
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-3 sm:p-6">
              {contacts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {contacts.map((contact) => (
                    <div key={contact.id} className={`border-2 rounded-lg p-3 sm:p-4 transition-colors ${
                      isPermanentContact(contact.id)
                        ? 'border-amber-400 bg-amber-50'
                        : 'border-gray-200 active:border-green-500 sm:hover:border-green-500'
                    }`}>
                      <div className="flex items-start justify-between mb-2 sm:mb-3">
                        <div className="text-3xl sm:text-4xl">👤</div>
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="text-red-600 active:text-red-900 sm:hover:text-red-900 text-xl sm:text-base p-1"
                        >
                          🗑️
                        </button>
                      </div>
                      
                      <h3 className="font-bold text-base sm:text-lg text-gray-900 mb-1">{contact.full_name}</h3>
                      {contact.role && (
                        <p className="text-xs sm:text-sm text-gray-600 mb-2">{contact.role}</p>
                      )}
                      <a 
                        href={`tel:${contact.phone}`}
                        className="text-blue-600 active:text-blue-800 sm:hover:text-blue-800 font-medium flex items-center gap-2 text-sm sm:text-base"
                      >
                        📞 {contact.phone}
                      </a>
                      
                      {isPermanentContact(contact.id) ? (
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-xs font-bold bg-amber-200 text-amber-800 px-2 py-1 rounded-full">🔒 כונן קבוע 24/7</span>
                          <button
                            onClick={() => handleRemovePermanentDuty(contact.id)}
                            className="text-xs text-red-500 active:text-red-700 sm:hover:text-red-700 font-medium underline"
                          >
                            הסר קבוע
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddPermanentDuty(contact.id)}
                          className="mt-3 w-full text-xs py-1.5 bg-amber-100 active:bg-amber-200 sm:hover:bg-amber-200 text-amber-700 rounded-lg font-semibold transition-colors"
                        >
                          🔒 הגדר ככונן קבוע 24/7
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 sm:py-12">
                  <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">👥</div>
                  <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">אין עדיין אנשי קשר במכלול</p>
                  <button
                    onClick={() => setShowAddContactModal(true)}
                    className="px-5 sm:px-6 py-2.5 sm:py-3 bg-green-600 active:bg-green-700 sm:hover:bg-green-700 text-white rounded-lg font-medium text-sm sm:text-base"
                  >
                    ➕ הוסף איש קשר ראשון
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content - All Departments On-Call - Only in emergency mode */}
        {warMode && activeTab === 'all-on-call' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-3 sm:p-6 border-b border-gray-200">
              <div className="mb-3 sm:mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3">כוננים בכל המכלולים</h2>
                
                {/* Date and Time Selectors */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial">
                    <label className="text-xs sm:text-sm font-semibold text-gray-700">📅</label>
                    <input
                      type="date"
                      value={selectedDateTime.toISOString().split('T')[0]}
                      onChange={(e) => {
                        const newDate = new Date(selectedDateTime);
                        const [year, month, day] = e.target.value.split('-');
                        newDate.setFullYear(parseInt(year));
                        newDate.setMonth(parseInt(month) - 1);
                        newDate.setDate(parseInt(day));
                        setSelectedDateTime(newDate);
                      }}
                      className="flex-1 sm:flex-initial px-2 sm:px-3 py-1.5 sm:py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-sm"
                    />
                  </div>
                  
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial">
                    <label className="text-xs sm:text-sm font-semibold text-gray-700">⏰</label>
                    <input
                      type="time"
                      value={`${String(selectedDateTime.getHours()).padStart(2, '0')}:${String(selectedDateTime.getMinutes()).padStart(2, '0')}`}
                      onChange={(e) => {
                        const newDate = new Date(selectedDateTime);
                        const [hours, minutes] = e.target.value.split(':');
                        newDate.setHours(parseInt(hours));
                        newDate.setMinutes(parseInt(minutes));
                        setSelectedDateTime(newDate);
                      }}
                      className="flex-1 sm:flex-initial px-2 sm:px-3 py-1.5 sm:py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-sm"
                    />
                  </div>
                </div>
                
                {/* Quick Selection Buttons */}
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedDateTime(new Date())}
                    className="px-2 sm:px-3 py-1.5 bg-green-100 active:bg-green-200 sm:hover:bg-green-200 text-green-800 rounded-lg font-semibold text-xs sm:text-sm transition-colors"
                  >
                    🔴 עכשיו
                  </button>
                  <button
                    onClick={() => {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      tomorrow.setHours(8, 0, 0, 0);
                      setSelectedDateTime(tomorrow);
                    }}
                    className="px-2 sm:px-3 py-1.5 bg-blue-100 active:bg-blue-200 sm:hover:bg-blue-200 text-blue-800 rounded-lg font-semibold text-xs sm:text-sm transition-colors"
                  >
                    🌅 מחר בוקר
                  </button>
                  <button
                    onClick={() => {
                      const nextWeek = new Date();
                      nextWeek.setDate(nextWeek.getDate() + 7);
                      nextWeek.setHours(8, 0, 0, 0);
                      setSelectedDateTime(nextWeek);
                    }}
                    className="px-2 sm:px-3 py-1.5 bg-purple-100 active:bg-purple-200 sm:hover:bg-purple-200 text-purple-800 rounded-lg font-semibold text-xs sm:text-sm transition-colors"
                  >
                    📆 עוד שבוע
                  </button>
                  <button
                    onClick={() => loadCurrentOnCall(selectedDateTime)}
                    className="px-2 sm:px-3 py-1.5 bg-purple-600 active:bg-purple-700 sm:hover:bg-purple-700 text-white rounded-lg font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1"
                  >
                    🔄 רענן
                  </button>
                </div>
                
                <p className="text-[10px] sm:text-xs text-gray-600 mt-2">
                  🔍 מציג: {selectedDateTime.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  {' '}בשעה {selectedDateTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            
            <div className="p-3 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                {allDepartments.map((department) => {
                  const isMyDepartment = department.id === user.department_id;
                  const departmentOnCall = currentOnCall.filter(d => d.department_id === department.id);
                  
                  return (
                    <div 
                      key={department.id} 
                      className={`border-2 rounded-lg sm:rounded-xl p-3 sm:p-5 transition-all ${
                        isMyDepartment 
                          ? 'border-purple-500 bg-purple-50 shadow-lg' 
                          : 'border-gray-200 bg-white active:border-purple-300 sm:hover:border-purple-300 sm:hover:shadow-md'
                      }`}
                    >
                      {/* Department Header */}
                      <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <div className="text-xl sm:text-2xl">🏢</div>
                          <h3 className="font-bold text-sm sm:text-lg text-gray-900 leading-tight">{department.name}</h3>
                        </div>
                        {isMyDepartment && (
                          <span className="text-[10px] sm:text-xs bg-purple-600 text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-bold whitespace-nowrap">
                            המכלול שלי
                          </span>
                        )}
                      </div>

                      {/* On-Call Personnel */}
                      <div className="space-y-2 sm:space-y-3">
                        {departmentOnCall.length > 0 ? (
                          departmentOnCall.map((duty) => (
                            <div 
                              key={duty.id} 
                              className="bg-green-50 border-2 border-green-200 rounded-lg p-2 sm:p-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                                    <span className="text-lg sm:text-xl">👤</span>
                                    <span className="font-bold text-gray-900 text-sm sm:text-base truncate">{duty.contact?.full_name || 'לא ידוע'}</span>
                                  </div>
                                  
                                  <div className="text-xs sm:text-sm text-gray-700 space-y-0.5 sm:space-y-1">
                                    {duty.contact?.role && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-[10px] sm:text-xs">💼</span>
                                        <span className="truncate">{duty.contact.role}</span>
                                      </div>
                                    )}
                                    
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span className="text-[10px] sm:text-xs">⏰</span>
                                      <span className="font-semibold">
                                        {getShiftLabel(duty.start_hour, duty.end_hour, duty.notes)}
                                      </span>
                                      <span className="text-[10px] sm:text-xs text-gray-600">
                                        ({duty.start_hour}:00 - {duty.end_hour}:00)
                                      </span>
                                    </div>
                                    
                                    {duty.contact?.phone && (
                                      <a 
                                        href={`tel:${duty.contact.phone}`}
                                        className="flex items-center gap-1 text-blue-600 active:text-blue-800 sm:hover:text-blue-800 font-medium"
                                      >
                                        <span className="text-[10px] sm:text-xs">📞</span>
                                        <span>{duty.contact.phone}</span>
                                      </a>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="text-xl sm:text-2xl flex-shrink-0">
                                  {duty.notes?.includes('[לן]') ? '�️' : '🚨'}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 text-center">
                            <div className="text-3xl mb-2">😴</div>
                            <p className="text-sm text-gray-600 font-medium">אין כוננים כרגע</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {allDepartments.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🏢</div>
                  <p className="text-gray-600 mb-4">אין מכלולים במערכת</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Add Contact Modal */}
      {showAddContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-gray-900">➕ הוספת איש קשר חדש</h3>
              <button
                onClick={() => {
                  setShowAddContactModal(false);
                  setContactForm({ full_name: '', phone: '', role: '' });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">שם מלא *</label>
                <input
                  type="text"
                  value={contactForm.full_name}
                  onChange={(e) => setContactForm({...contactForm, full_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  placeholder="למשל: משה כהן"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">טלפון *</label>
                <input
                  type="tel"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({...contactForm, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  placeholder="050-1234567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">תפקיד (אופציונלי)</label>
                <input
                  type="text"
                  value={contactForm.role}
                  onChange={(e) => setContactForm({...contactForm, role: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  placeholder="למשל: טכנאי חשמל"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAddContact}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
                >
                  ➕ הוסף
                </button>
                <button
                  onClick={() => {
                    setShowAddContactModal(false);
                    setContactForm({ full_name: '', phone: '', role: '' });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border-2 border-purple-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-3xl">👤</span>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{selectedEvent.resource?.contactName}</h3>
                    <p className="text-sm text-gray-600">{selectedEvent.resource?.contactRole}</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Contact Phone */}
              <a 
                href={`tel:${selectedEvent.resource?.contactPhone}`}
                className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <span className="text-xl">📞</span>
                <span className="font-bold text-blue-700">{selectedEvent.resource?.contactPhone}</span>
              </a>

              {/* Shift Details */}
              <div className={`p-4 rounded-lg ${selectedEvent.resource?.colors?.bg || 'bg-gray-100'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm">פרטי משמרת:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${selectedEvent.resource?.colors?.bg || 'bg-gray-200'}`}
                    style={{ 
                      backgroundColor: selectedEvent.resource?.colors?.border,
                      color: 'white'
                    }}>
                    {getShiftLabel(selectedEvent.resource?.startHour, selectedEvent.resource?.endHour, selectedEvent.resource?.notes)}
                  </span>
                </div>
                <div className="text-lg font-bold" style={{ color: selectedEvent.resource?.colors?.text }}>
                  {String(selectedEvent.resource?.startHour).padStart(2, '0')}:00 - {String(selectedEvent.resource?.endHour).padStart(2, '0')}:00
                </div>
                {selectedEvent.resource?.notes && !selectedEvent.resource?.notes.includes('[לן]') && (
                  <p className="text-sm mt-2 text-gray-600">{selectedEvent.resource?.notes}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleEditFromCalendar(selectedEvent)}
                  className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-bold transition-all hover:scale-105 shadow-lg"
                >
                  ✏️ ערוך כוננות
                </button>
                <button
                  onClick={() => handleDeleteFromCalendar(selectedEvent.resource?.dutyId)}
                  className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 font-bold transition-all hover:scale-105 shadow-lg"
                >
                  🗑️ מחק
                </button>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="w-full mt-2 px-6 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium transition-all"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Duty Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl shadow-2xl max-w-md w-full p-6 border-2 border-blue-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-blue-900">✏️ עריכת כוננות</h3>
                <p className="text-sm text-blue-600 mt-1">יום {DAYS[editData.dayIndex]}</p>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditData({ dutyId: null, contactId: '', dayIndex: 0, usePreset: false, shiftType: 0, startHour: 8, endHour: 16, notes: '' });
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Contact Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">👤 שנה איש קשר</label>
                <select
                  value={editData.contactId}
                  onChange={(e) => setEditData({...editData, contactId: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                >
                  <option value="">בחר מהרשימה...</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.full_name} {contact.role && `• ${contact.role}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Day Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">📅 שנה יום</label>
                <select
                  value={editData.dayIndex}
                  onChange={(e) => setEditData({...editData, dayIndex: parseInt(e.target.value)})}
                  className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                >
                  {DAYS.map((day, idx) => (
                    <option key={idx} value={idx}>{day}</option>
                  ))}
                </select>
              </div>

              {/* Toggle: Preset vs Manual */}
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setEditData({...editData, usePreset: true})}
                    className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${
                      editData.usePreset
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    🎯 משמרות מוכנות
                  </button>
                  <button
                    onClick={() => setEditData({...editData, usePreset: false})}
                    className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${
                      !editData.usePreset
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    ⏰ שעות ידניות
                  </button>
                </div>

                {editData.usePreset ? (
                  /* Preset Selection */
                  <div className="grid grid-cols-2 gap-2">
                    {SHIFT_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => setEditData({...editData, shiftType: idx, startHour: preset.start, endHour: preset.end, notes: preset.notes || ''})}
                        className={`p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                          editData.shiftType === idx
                            ? `${preset.color} border-current shadow-lg`
                            : 'bg-white border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="text-xl mb-1">{preset.icon}</div>
                        <div className="font-bold text-xs">{preset.label}</div>
                        <div className="text-[10px] mt-0.5 opacity-75">{preset.desc}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  /* Manual Time Selection */
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">שעת התחלה</label>
                        <select
                          value={editData.startHour}
                          onChange={(e) => setEditData({...editData, startHour: parseInt(e.target.value)})}
                          className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg font-bold text-center"
                        >
                          {Array.from({ length: 24 }, (_, h) => (
                            <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">שעת סיום</label>
                        <select
                          value={editData.endHour}
                          onChange={(e) => setEditData({...editData, endHour: parseInt(e.target.value)})}
                          className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg font-bold text-center"
                        >
                          <option value={0}>חצות (00:00 ביום למחרת) 🌙</option>
                          {Array.from({ length: 23 }, (_, h) => {
                            const hour = h + 1;
                            const isNextDay = editData.startHour > hour;
                            return (
                              <option key={hour} value={hour}>
                                {String(hour).padStart(2, '0')}:00{isNextDay ? ' ביום למחרת 🌅' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">הערות (אופציונלי)</label>
                      <input
                        type="text"
                        value={editData.notes}
                        onChange={(e) => setEditData({...editData, notes: e.target.value})}
                        className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm"
                        placeholder="הערות נוספות..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleUpdateDuty}
                  disabled={!editData.contactId}
                  className={`flex-1 px-6 py-3 rounded-xl font-bold text-lg transition-all ${
                    editData.contactId
                      ? 'bg-gradient-to-l from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg hover:scale-105'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  ✅ שמור שינויים
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditData({ dutyId: null, contactId: '', dayIndex: 0, usePreset: false, shiftType: 0, startHour: 8, endHour: 16, notes: '' });
                  }}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-bold transition-all"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Duty Modal */}
      {showPermanentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-amber-50 to-white rounded-2xl shadow-2xl max-w-md w-full p-6 border-2 border-amber-300">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-amber-900">🔒 כונן קבוע 24/7</h3>
                <p className="text-sm text-amber-700 mt-1">כונן שפעיל כל יום, כל השנה, עד להודעה חדשה</p>
              </div>
              <button
                onClick={() => { setShowPermanentModal(false); setPermanentContactId(''); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">👤 בחר איש קשר</label>
                <select
                  value={permanentContactId}
                  onChange={(e) => setPermanentContactId(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium"
                >
                  <option value="">בחר מהרשימה...</option>
                  {contacts.filter(c => !isPermanentContact(c.id)).map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.full_name} {contact.role && `• ${contact.role}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-amber-100 border border-amber-300 rounded-lg text-sm text-amber-800">
                <p className="font-bold mb-1">📌 מה זה אומר?</p>
                <ul className="space-y-1 text-xs">
                  <li>• איש הקשר יופיע ככונן <strong>בכל שבוע</strong></li>
                  <li>• <strong>24 שעות ביממה, 7 ימים בשבוע</strong></li>
                  <li>• עד שתסיר את הכוננות הקבועה ידנית</li>
                </ul>
              </div>

              {/* Already permanent contacts */}
              {permanentDuties.length > 0 && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-xs font-bold text-gray-700 mb-2">כוננים קבועים נוכחיים:</p>
                  <div className="space-y-1">
                    {[...new Set(permanentDuties.map(d => d.contact_id))].map(cId => {
                      const contact = contacts.find(c => c.id === cId);
                      return contact ? (
                        <div key={cId} className="flex items-center justify-between text-xs">
                          <span className="font-medium">🔒 {contact.full_name}</span>
                          <button
                            onClick={() => handleRemovePermanentDuty(cId)}
                            className="text-red-500 hover:text-red-700 font-medium underline"
                          >
                            הסר
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleAddPermanentDuty(permanentContactId)}
                  disabled={!permanentContactId}
                  className={`flex-1 px-6 py-3 rounded-xl font-bold text-lg transition-all ${
                    permanentContactId
                      ? 'bg-gradient-to-l from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-lg hover:scale-105'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  🔒 הגדר ככונן קבוע
                </button>
                <button
                  onClick={() => { setShowPermanentModal(false); setPermanentContactId(''); }}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-bold transition-all"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Duty Modal */}
      {showQuickAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-purple-50 to-white rounded-2xl shadow-2xl max-w-md w-full p-6 border-2 border-purple-200">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-purple-900">⚡ הוספת כוננות</h3>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm text-purple-600">יום {DAYS[quickAddData.dayIndex]}</p>
                  {quickAddData.existingCount > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                      📊 {quickAddData.existingCount} משמרות קיימות
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowQuickAddModal(false);
                  setQuickAddData({ dayIndex: 0, contactId: '', shiftType: 0, usePreset: true, startHour: 8, endHour: 16, notes: '', existingCount: 0, existingForContact: [] });
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Contact Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">👤 בחר איש קשר</label>
                <select
                  value={quickAddData.contactId}
                  onChange={(e) => {
                    const contactId = e.target.value;
                    const existingForContact = dutyRoster.filter(d => 
                      d.contact_id === contactId && d.day_of_week === quickAddData.dayIndex
                    );
                    setQuickAddData({...quickAddData, contactId, existingForContact});
                  }}
                  className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-medium"
                >
                  <option value="">בחר מהרשימה...</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.full_name} {contact.role && `• ${contact.role}`}
                    </option>
                  ))}
                </select>
                
                {/* Warning if contact already has duties this day */}
                {quickAddData.existingForContact && quickAddData.existingForContact.length > 0 && (
                  <div className="mt-2 p-3 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                    <div className="flex items-start gap-2">
                      <span className="text-lg">⚠️</span>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-yellow-800 mb-1">
                          איש קשר זה כבר כונן באותו יום:
                        </p>
                        <div className="space-y-1">
                          {quickAddData.existingForContact.map((duty, idx) => (
                            <div key={idx} className="text-xs text-yellow-700 font-medium">
                              • {String(duty.start_hour).padStart(2, '0')}:00 - {String(duty.end_hour).padStart(2, '0')}:00
                              {duty.notes && ` (${duty.notes})`}
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-yellow-600 mt-2">
                          💡 אפשר להמשיך ולהוסיף משמרת נוספת
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Toggle: Preset vs Manual */}
              <div className="bg-purple-50 rounded-xl p-3">
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setQuickAddData({...quickAddData, usePreset: true})}
                    className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${
                      quickAddData.usePreset
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    🎯 משמרות מוכנות
                  </button>
                  <button
                    onClick={() => setQuickAddData({...quickAddData, usePreset: false})}
                    className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${
                      !quickAddData.usePreset
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    ⏰ שעות ידניות
                  </button>
                </div>

                {quickAddData.usePreset ? (
                  /* Preset Selection */
                  <div className="grid grid-cols-2 gap-2">
                    {SHIFT_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => setQuickAddData({...quickAddData, shiftType: idx})}
                        className={`p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                          quickAddData.shiftType === idx
                            ? `${preset.color} border-current shadow-lg`
                            : 'bg-white border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <div className="text-xl mb-1">{preset.icon}</div>
                        <div className="font-bold text-xs">{preset.label}</div>
                        <div className="text-[10px] mt-0.5 opacity-75">{preset.desc}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  /* Manual Time Selection */
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">שעת התחלה</label>
                        <select
                          value={quickAddData.startHour}
                          onChange={(e) => setQuickAddData({...quickAddData, startHour: parseInt(e.target.value)})}
                          className="w-full px-3 py-2 border-2 border-purple-200 rounded-lg font-bold text-center"
                        >
                          {Array.from({ length: 24 }, (_, h) => (
                            <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">שעת סיום</label>
                        <select
                          value={quickAddData.endHour}
                          onChange={(e) => setQuickAddData({...quickAddData, endHour: parseInt(e.target.value)})}
                          className="w-full px-3 py-2 border-2 border-purple-200 rounded-lg font-bold text-center"
                        >
                          <option value={0}>חצות (00:00 ביום למחרת) 🌙</option>
                          {Array.from({ length: 23 }, (_, h) => {
                            const hour = h + 1;
                            const isNextDay = quickAddData.startHour > hour;
                            return (
                              <option key={hour} value={hour}>
                                {String(hour).padStart(2, '0')}:00{isNextDay ? ' ביום למחרת 🌅' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">הערות (אופציונלי)</label>
                      <input
                        type="text"
                        value={quickAddData.notes}
                        onChange={(e) => setQuickAddData({...quickAddData, notes: e.target.value})}
                        className="w-full px-3 py-2 border-2 border-purple-200 rounded-lg text-sm"
                        placeholder="הערות נוספות..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleQuickAddDuty}
                  disabled={!quickAddData.contactId}
                  className={`flex-1 px-6 py-3 rounded-xl font-bold text-lg transition-all ${
                    quickAddData.contactId
                      ? 'bg-gradient-to-l from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 shadow-lg hover:scale-105'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  ➕ הוסף
                </button>
                <button
                  onClick={() => {
                    setShowQuickAddModal(false);
                    setQuickAddData({ dayIndex: 0, contactId: '', shiftType: 0, usePreset: true, startHour: 8, endHour: 16, notes: '' });
                  }}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-bold transition-all"
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
