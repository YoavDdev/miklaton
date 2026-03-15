'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// Preset shift options for easier selection
const SHIFT_PRESETS = [
  { label: 'יום שלם (24 שעות)', start: 8, end: 8, description: '08:00-08:00 (כל היום)' },
  { label: 'בוקר (08:00-16:00)', start: 8, end: 16, description: 'משמרת בוקר' },
  { label: 'אחה"צ (16:00-00:00)', start: 16, end: 0, description: 'משמרת אחר הצהריים עד חצות' },
  { label: 'לילה (00:00-08:00)', start: 0, end: 8, description: 'משמרת לילה' },
  { label: 'יום עבודה (08:00-17:00)', start: 8, end: 17, description: 'שעות עבודה רגילות' },
  { label: 'מותאם אישית', start: null, end: null, description: 'בחר שעות בעצמך' }
];

export default function OnCallManagerNew() {
  const [activeTab, setActiveTab] = useState('contacts'); // contacts, departments, roster
  const [departments, setDepartments] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [dutyRoster, setDutyRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showRosterForm, setShowRosterForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Filters
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [selectedPreset, setSelectedPreset] = useState(null);
  
  const [deptForm, setDeptForm] = useState({ name: '', display_order: 0, manager_name: '', manager_phone: '' });
  const [contactForm, setContactForm] = useState({ 
    department_id: '', 
    full_name: '', 
    phone: '', 
    role: '' 
  });
  const [rosterForm, setRosterForm] = useState({ 
    contact_id: '', 
    department_id: '',
    day_of_week: 0, 
    start_hour: 8, 
    end_hour: 17, 
    notes: '' 
  });

  // Bulk roster form states
  const [bulkSelectedDays, setBulkSelectedDays] = useState([]);
  const [bulkSelectedContacts, setBulkSelectedContacts] = useState([]);
  const [bulkDepartmentFilter, setBulkDepartmentFilter] = useState('');
  const [bulkPreset, setBulkPreset] = useState(0);
  const [bulkStartHour, setBulkStartHour] = useState(8);
  const [bulkEndHour, setBulkEndHour] = useState(8);
  const [bulkNotes, setBulkNotes] = useState('');
  const [bulkDutyType, setBulkDutyType] = useState('oncall');
  const [savingBulk, setSavingBulk] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchAll();
    
    // Realtime subscriptions
    const deptChannel = supabase
      .channel('departments_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'departments' }, fetchDepartments)
      .subscribe();
    
    const contactChannel = supabase
      .channel('contacts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, fetchContacts)
      .subscribe();
    
    const rosterChannel = supabase
      .channel('duty_roster_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duty_roster' }, fetchDutyRoster)
      .subscribe();

    return () => {
      supabase.removeChannel(deptChannel);
      supabase.removeChannel(contactChannel);
      supabase.removeChannel(rosterChannel);
    };
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchDepartments(), fetchContacts(), fetchDutyRoster()]);
    setLoading(false);
  };

  const fetchDepartments = async () => {
    const res = await fetch('/api/departments');
    const data = await res.json();
    if (data.success) setDepartments(data.data || []);
  };

  const fetchContacts = async () => {
    const res = await fetch('/api/contacts');
    const data = await res.json();
    if (data.success) setContacts(data.data || []);
  };

  const fetchDutyRoster = async () => {
    const res = await fetch('/api/duty-roster');
    const data = await res.json();
    if (data.success) setDutyRoster(data.data || []);
  };

  // Department handlers
  const handleSaveDept = async () => {
    const method = editingItem ? 'PATCH' : 'POST';
    const body = editingItem ? { ...deptForm, id: editingItem.id } : deptForm;
    
    const res = await fetch('/api/departments', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (res.ok) {
      setShowDeptForm(false);
      setEditingItem(null);
      setDeptForm({ name: '', display_order: 0, manager_name: '', manager_phone: '' });
      fetchDepartments();
    }
  };

  const handleDeleteDept = async (id) => {
    if (!confirm('למחוק מכלול זה? כל אנשי הקשר שלו יימחקו!')) return;
    
    await fetch(`/api/departments?id=${id}`, { method: 'DELETE' });
    fetchDepartments();
  };

  // Contact handlers
  const handleSaveContact = async () => {
    const method = editingItem ? 'PATCH' : 'POST';
    const body = editingItem ? { ...contactForm, id: editingItem.id } : contactForm;
    
    const res = await fetch('/api/contacts', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (res.ok) {
      setShowContactForm(false);
      setEditingItem(null);
      setContactForm({ department_id: '', full_name: '', phone: '', role: '' });
      fetchContacts();
    }
  };

  const handleDeleteContact = async (id) => {
    if (!confirm('למחוק איש קשר זה?')) return;
    
    await fetch(`/api/contacts?id=${id}`, { method: 'DELETE' });
    fetchContacts();
  };

  // Roster handlers
  const handleSaveRoster = async () => {
    const method = editingItem ? 'PATCH' : 'POST';
    const body = editingItem ? { ...rosterForm, id: editingItem.id } : rosterForm;
    
    const res = await fetch('/api/duty-roster', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (res.ok) {
      setShowRosterForm(false);
      setEditingItem(null);
      setRosterForm({ contact_id: '', department_id: '', day_of_week: 0, start_hour: 8, end_hour: 17, notes: '' });
      fetchDutyRoster();
    }
  };

  const handleDeleteRoster = async (id) => {
    await fetch(`/api/duty-roster?id=${id}`, { method: 'DELETE' });
    setDeleteConfirm(null);
    fetchDutyRoster();
  };

  const handleBulkSave = async () => {
    if (bulkSelectedContacts.length === 0 || bulkSelectedDays.length === 0) {
      alert('יש לבחור לפחות איש קשר אחד ויום אחד');
      return;
    }
    setSavingBulk(true);
    try {
      const promises = [];
      for (const contactId of bulkSelectedContacts) {
        const contact = contacts.find(c => c.id === contactId);
        for (const day of bulkSelectedDays) {
          promises.push(
            fetch('/api/duty-roster', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contact_id: contactId,
                department_id: contact?.department_id || '',
                day_of_week: day,
                start_hour: bulkStartHour,
                end_hour: bulkEndHour,
                notes: `${bulkDutyType === 'sleep' ? '[לן]' : '[כונן]'}${bulkNotes ? ' | ' + bulkNotes : ''}`
              })
            })
          );
        }
      }
      await Promise.all(promises);
      setBulkSelectedDays([]);
      setBulkSelectedContacts([]);
      setBulkNotes('');
      setBulkDutyType('oncall');
      setShowRosterForm(false);
      fetchDutyRoster();
    } catch (error) {
      alert('שגיאה בשמירת כוננויות');
    }
    setSavingBulk(false);
  };

  const toggleBulkDay = (day) => {
    setBulkSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const toggleBulkContact = (id) => {
    setBulkSelectedContacts(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const selectAllDays = () => {
    setBulkSelectedDays(bulkSelectedDays.length === 7 ? [] : [0,1,2,3,4,5,6]);
  };

  const selectWeekdays = () => {
    setBulkSelectedDays([0,1,2,3,4]);
  };

  if (loading) {
    return <div className="text-center py-12">טוען נתונים...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">ניהול תורנויות וכוננויות</h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('contacts')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'contacts'
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          אנשי קשר ({contacts.length})
        </button>
        <button
          onClick={() => setActiveTab('departments')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'departments'
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          מכלולים ({departments.length})
        </button>
        <button
          onClick={() => setActiveTab('roster')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'roster'
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          טבלת כוננויות
        </button>
      </div>

      {/* Contacts Tab */}
      {activeTab === 'contacts' && (
        <div>
          <button
            onClick={() => {
              setShowContactForm(true);
              setEditingItem(null);
              setContactForm({ department_id: departments[0]?.id || '', full_name: '', phone: '', role: '' });
            }}
            className="mb-4 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg"
          >
            + הוסף איש קשר
          </button>

          {showContactForm && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-purple-200">
              <h3 className="font-bold mb-3">{editingItem ? 'ערוך איש קשר' : 'איש קשר חדש'}</h3>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="שם מלא"
                  value={contactForm.full_name}
                  onChange={(e) => setContactForm({ ...contactForm, full_name: e.target.value })}
                  className="px-3 py-2 border rounded"
                />
                <input
                  type="text"
                  placeholder="טלפון"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  className="px-3 py-2 border rounded"
                />
                <select
                  value={contactForm.department_id}
                  onChange={(e) => setContactForm({ ...contactForm, department_id: e.target.value })}
                  className="px-3 py-2 border rounded"
                >
                  <option value="">בחר מכלול</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="תפקיד (אופציונלי)"
                  value={contactForm.role}
                  onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
                  className="px-3 py-2 border rounded"
                />
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleSaveContact}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
                >
                  שמור
                </button>
                <button
                  onClick={() => {
                    setShowContactForm(false);
                    setEditingItem(null);
                  }}
                  className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {contacts.map(contact => (
              <div key={contact.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                <div>
                  <p className="font-bold">{contact.full_name}</p>
                  <p className="text-sm text-gray-600">
                    {contact.phone} | {contact.departments?.name || 'ללא מכלול'} 
                    {contact.role && ` | ${contact.role}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingItem(contact);
                      setContactForm({
                        department_id: contact.department_id,
                        full_name: contact.full_name,
                        phone: contact.phone,
                        role: contact.role || ''
                      });
                      setShowContactForm(true);
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    ערוך
                  </button>
                  <button
                    onClick={() => handleDeleteContact(contact.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    מחק
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Departments Tab */}
      {activeTab === 'departments' && (
        <div>
          <button
            onClick={() => {
              setShowDeptForm(true);
              setEditingItem(null);
              setDeptForm({ name: '', display_order: departments.length + 1, manager_name: '', manager_phone: '' });
            }}
            className="mb-4 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg"
          >
            + הוסף מכלול
          </button>

          {showDeptForm && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-purple-200">
              <h3 className="font-bold mb-3">{editingItem ? 'ערוך מכלול' : 'מכלול חדש'}</h3>
              <input
                type="text"
                placeholder="שם המכלול"
                value={deptForm.name}
                onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                className="w-full px-3 py-2 border rounded mb-3"
              />
              <div className="grid grid-cols-2 gap-2 mb-3">
                <input
                  type="text"
                  placeholder="שם מנהל מכלול"
                  value={deptForm.manager_name}
                  onChange={(e) => setDeptForm({ ...deptForm, manager_name: e.target.value })}
                  className="px-3 py-2 border rounded"
                />
                <input
                  type="tel"
                  placeholder="טלפון מנהל"
                  value={deptForm.manager_phone}
                  onChange={(e) => setDeptForm({ ...deptForm, manager_phone: e.target.value })}
                  className="px-3 py-2 border rounded"
                  dir="ltr"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveDept}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
                >
                  שמור
                </button>
                <button
                  onClick={() => {
                    setShowDeptForm(false);
                    setEditingItem(null);
                  }}
                  className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {departments.map(dept => (
              <div key={dept.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                <div>
                  <p className="font-bold">{dept.name}</p>
                  {dept.manager_name && (
                    <p className="text-sm text-purple-700 font-semibold">
                      👤 {dept.manager_name}
                      {dept.manager_phone && <span className="text-gray-500 mr-1" dir="ltr"> {dept.manager_phone}</span>}
                    </p>
                  )}
                  <p className="text-sm text-gray-600">
                    {dept.contacts?.length || 0} אנשי קשר
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingItem(dept);
                      setDeptForm({ name: dept.name, display_order: dept.display_order, manager_name: dept.manager_name || '', manager_phone: dept.manager_phone || '' });
                      setShowDeptForm(true);
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    ערוך
                  </button>
                  <button
                    onClick={() => handleDeleteDept(dept.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    מחק
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Duty Roster Tab */}
      {activeTab === 'roster' && (
        <div>
          {/* Add Duty Button */}
          <button
            onClick={() => {
              setShowRosterForm(!showRosterForm);
              setBulkSelectedDays([]);
              setBulkSelectedContacts([]);
              setBulkDepartmentFilter('');
              setBulkPreset(0);
              setBulkStartHour(8);
              setBulkEndHour(8);
              setBulkNotes('');
              setBulkDutyType('oncall');
            }}
            className={`mb-4 font-semibold px-6 py-3 rounded-lg text-lg transition-all ${
              showRosterForm 
                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
                : 'bg-green-600 hover:bg-green-700 text-white shadow-md'
            }`}
          >
            {showRosterForm ? 'סגור טופס' : '+ הוסף כוננויות'}
          </button>

          {/* ===== BULK ADD FORM ===== */}
          {showRosterForm && (
            <div className="mb-6 p-5 bg-gradient-to-b from-purple-50 to-white rounded-xl border-2 border-purple-300 shadow-sm">
              <h3 className="text-lg font-bold text-purple-800 mb-4">הוספת כוננויות</h3>

              {/* Step 0: Duty Type */}
              <div className="mb-5">
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  סוג תורנות:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkDutyType('oncall')}
                    className={`px-3 py-3 rounded-lg text-sm font-medium transition-all border-2 flex items-center justify-center gap-2 ${
                      bulkDutyType === 'oncall'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                        : 'bg-white text-gray-700 hover:bg-blue-50 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <span className="text-lg">📞</span>
                    <div>
                      <div className="font-bold">כונן</div>
                      <div className="text-xs opacity-75">זמין טלפונית</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkDutyType('sleep')}
                    className={`px-3 py-3 rounded-lg text-sm font-medium transition-all border-2 flex items-center justify-center gap-2 ${
                      bulkDutyType === 'sleep'
                        ? 'bg-orange-500 text-white border-orange-500 shadow-md'
                        : 'bg-white text-gray-700 hover:bg-orange-50 border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <span className="text-lg">🏢</span>
                    <div>
                      <div className="font-bold">לן בעירייה</div>
                      <div className="text-xs opacity-75">נוכח פיזית</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Step 1: Select Shift Type */}
              <div className="mb-5">
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  בחר משמרת:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SHIFT_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setBulkPreset(idx);
                        if (preset.start !== null) {
                          setBulkStartHour(preset.start);
                          setBulkEndHour(preset.end);
                        }
                      }}
                      className={`px-3 py-3 rounded-lg text-sm font-medium transition-all border-2 ${
                        bulkPreset === idx
                          ? 'bg-purple-600 text-white border-purple-600 shadow-md scale-[1.02]'
                          : 'bg-white text-gray-700 hover:bg-purple-50 border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="font-bold text-sm">{preset.label}</div>
                      <div className="text-xs opacity-75 mt-0.5">{preset.description}</div>
                    </button>
                  ))}
                </div>
                {/* Custom hours - only show when "custom" preset selected */}
                {bulkPreset === SHIFT_PRESETS.length - 1 && (
                  <div className="mt-3 flex gap-3 items-center bg-white p-3 rounded-lg border border-gray-200">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-600 mb-1">שעת התחלה</label>
                      <input
                        type="number" min="0" max="23"
                        value={bulkStartHour}
                        onChange={(e) => setBulkStartHour(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border-2 border-purple-200 rounded-lg text-center font-bold text-lg"
                      />
                    </div>
                    <span className="text-2xl text-gray-400 pt-4">-</span>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-600 mb-1">שעת סיום</label>
                      <input
                        type="number" min="0" max="23"
                        value={bulkEndHour}
                        onChange={(e) => setBulkEndHour(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border-2 border-purple-200 rounded-lg text-center font-bold text-lg"
                      />
                    </div>
                  </div>
                )}
                {/* Time preview */}
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg text-center">
                  <span className="text-sm font-bold text-green-800">
                    {String(bulkStartHour).padStart(2, '0')}:00 - {String(bulkEndHour).padStart(2, '0')}:00
                    {bulkStartHour === bulkEndHour && ' (24 שעות)'}
                    {bulkEndHour === 0 && bulkStartHour > 0 && ' (עד חצות)'}
                  </span>
                </div>
              </div>

              {/* Step 2: Select Days - Checkboxes with quick select */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-gray-800">בחר ימים:</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllDays}
                      className="text-xs px-3 py-1 rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200 font-semibold transition-colors"
                    >
                      {bulkSelectedDays.length === 7 ? 'נקה הכל' : 'כל השבוע'}
                    </button>
                    <button
                      type="button"
                      onClick={selectWeekdays}
                      className="text-xs px-3 py-1 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold transition-colors"
                    >
                      א׳-ה׳
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {DAYS.map((day, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleBulkDay(i)}
                      className={`py-3 rounded-lg text-sm font-bold transition-all border-2 ${
                        bulkSelectedDays.includes(i)
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                {bulkSelectedDays.length > 0 && (
                  <p className="text-xs text-purple-600 mt-1 font-semibold">
                    נבחרו {bulkSelectedDays.length} ימים
                  </p>
                )}
              </div>

              {/* Step 3: Select People - Multi-select with department filter */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-gray-800">בחר כוננים:</label>
                  <select
                    value={bulkDepartmentFilter}
                    onChange={(e) => setBulkDepartmentFilter(e.target.value)}
                    className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg font-medium"
                  >
                    <option value="">כל המכלולים</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                
                {/* Select all in filtered department */}
                {bulkDepartmentFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      const deptContacts = contacts.filter(c => c.department_id === bulkDepartmentFilter).map(c => c.id);
                      const allSelected = deptContacts.every(id => bulkSelectedContacts.includes(id));
                      if (allSelected) {
                        setBulkSelectedContacts(prev => prev.filter(id => !deptContacts.includes(id)));
                      } else {
                        setBulkSelectedContacts(prev => [...new Set([...prev, ...deptContacts])]);
                      }
                    }}
                    className="mb-2 text-xs px-3 py-1 rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200 font-semibold transition-colors"
                  >
                    בחר/נקה כל המכלול
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                  {contacts
                    .filter(c => !bulkDepartmentFilter || c.department_id === bulkDepartmentFilter)
                    .map(contact => (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => toggleBulkContact(contact.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-right transition-all border-2 ${
                        bulkSelectedContacts.includes(contact.id)
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded flex items-center justify-center text-xs flex-shrink-0 ${
                        bulkSelectedContacts.includes(contact.id)
                          ? 'bg-white text-purple-600'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        {bulkSelectedContacts.includes(contact.id) ? '✓' : ''}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{contact.full_name}</div>
                        <div className={`text-xs truncate ${
                          bulkSelectedContacts.includes(contact.id) ? 'text-purple-200' : 'text-gray-500'
                        }`}>
                          {contact.departments?.name}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {bulkSelectedContacts.length > 0 && (
                  <p className="text-xs text-purple-600 mt-1 font-semibold">
                    נבחרו {bulkSelectedContacts.length} כוננים
                  </p>
                )}
              </div>

              {/* Notes */}
              <input
                type="text"
                placeholder="הערות (אופציונלי)"
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg mb-4 focus:border-purple-400 focus:outline-none"
              />

              {/* Summary + Save */}
              {(bulkSelectedContacts.length > 0 && bulkSelectedDays.length > 0) && (
                <div className="p-3 bg-purple-100 border border-purple-300 rounded-lg mb-4">
                  <p className="text-sm font-bold text-purple-900">
                    סה&quot;כ: {bulkSelectedContacts.length * bulkSelectedDays.length} {bulkDutyType === 'sleep' ? 'לינות' : 'כוננויות'} חדשות
                    {bulkDutyType === 'sleep' && ' 🏢'}
                  </p>
                  <p className="text-xs text-purple-700 mt-1">
                    {bulkSelectedContacts.length} {bulkDutyType === 'sleep' ? 'לנים' : 'כוננים'} × {bulkSelectedDays.length} ימים
                    {' | '}
                    {String(bulkStartHour).padStart(2, '0')}:00-{String(bulkEndHour).padStart(2, '0')}:00
                    {bulkStartHour === bulkEndHour && ' (24 שעות)'}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleBulkSave}
                  disabled={savingBulk || bulkSelectedContacts.length === 0 || bulkSelectedDays.length === 0}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-sm"
                >
                  {savingBulk ? 'שומר...' : 'שמור כוננויות'}
                </button>
                <button
                  onClick={() => setShowRosterForm(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}

          {/* Department Filter */}
          <div className="mb-4 flex items-center gap-3">
            <label className="font-semibold text-gray-700">סינון לפי מכלול:</label>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="px-4 py-2 border-2 border-purple-300 rounded-lg font-medium"
            >
              <option value="all">כל המכלולים</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
            {filterDepartment !== 'all' && (
              <button
                onClick={() => setFilterDepartment('all')}
                className="text-sm text-purple-600 hover:text-purple-800 underline"
              >
                נקה סינון
              </button>
            )}
          </div>

          {/* ===== WEEKLY TABLE WITH INLINE DELETE ===== */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border-b border-r border-gray-200 p-3 text-right font-bold text-gray-700 min-w-[140px]">איש קשר</th>
                  {DAYS.map((day, i) => (
                    <th key={i} className="border-b border-r border-gray-200 p-2 font-bold text-gray-700 text-center">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts
                  .filter(contact => filterDepartment === 'all' || contact.department_id === filterDepartment)
                  .map((contact, rowIdx) => (
                  <tr key={contact.id} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border-b border-r border-gray-200 p-2">
                      <div className="font-bold text-gray-900">{contact.full_name}</div>
                      <div className="text-xs text-gray-500">{contact.departments?.name}</div>
                      {contact.phone && <div className="text-xs text-gray-400" dir="ltr">{contact.phone}</div>}
                    </td>
                    {DAYS.map((dayName, dayIndex) => {
                      const duties = dutyRoster.filter(
                        d => d.contact_id === contact.id && d.day_of_week === dayIndex
                      );
                      return (
                        <td key={dayIndex} className="border-b border-r border-gray-200 p-1.5 align-top">
                          {duties.map(duty => {
                            const isSleep = duty.notes?.includes('[לן]');
                            let displayText = '';
                            let bgColor = isSleep
                              ? 'bg-orange-100 text-orange-800 border-orange-300'
                              : 'bg-blue-100 text-blue-800 border-blue-200';
                            
                            if (duty.start_hour === duty.end_hour) {
                              displayText = '24 שעות';
                              if (!isSleep) bgColor = 'bg-green-100 text-green-800 border-green-200';
                            } else if (duty.end_hour === 0) {
                              displayText = `${String(duty.start_hour).padStart(2, '0')}:00-00:00`;
                              if (!isSleep) bgColor = 'bg-purple-100 text-purple-800 border-purple-200';
                            } else {
                              displayText = `${String(duty.start_hour).padStart(2, '0')}:00-${String(duty.end_hour).padStart(2, '0')}:00`;
                            }
                            
                            const isConfirming = deleteConfirm === duty.id;
                            
                            return (
                              <div key={duty.id} className="relative group mb-1">
                                {isConfirming ? (
                                  /* Delete confirmation inline */
                                  <div className="text-xs bg-red-50 border-2 border-red-300 rounded-lg p-2 animate-pulse">
                                    <p className="font-bold text-red-800 mb-1.5">
                                      למחוק כוננות?
                                    </p>
                                    <p className="text-red-600 mb-2">
                                      {contact.full_name} | {dayName} | {displayText}
                                    </p>
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => handleDeleteRoster(duty.id)}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs font-bold"
                                      >
                                        מחק
                                      </button>
                                      <button
                                        onClick={() => setDeleteConfirm(null)}
                                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded text-xs font-bold"
                                      >
                                        ביטול
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  /* Normal duty badge with hover X */
                                  <div className={`text-xs ${bgColor} border px-2 py-1 rounded-lg font-medium flex items-center justify-between gap-1`}>
                                    <span>{isSleep ? '🏢 ' : ''}{displayText}{isSleep ? ' לן' : ''}</span>
                                    <button
                                      onClick={() => setDeleteConfirm(duty.id)}
                                      className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-xs leading-none hover:bg-red-600 transition-all flex-shrink-0"
                                      title={`מחק כוננות: ${contact.full_name} | ${dayName} | ${displayText}`}
                                    >
                                      ×
                                    </button>
                                  </div>
                                )}
                                {duty.notes && !isConfirming && (() => {
                                  const cleanNotes = duty.notes
                                    ?.replace(/\[לן\]/g, '')
                                    .replace(/\[כונן\]/g, '')
                                    .replace(/^\s*\|\s*/, '')
                                    .trim();
                                  return cleanNotes ? (
                                    <div className="text-xs text-gray-500 mt-0.5 px-1">{cleanNotes}</div>
                                  ) : null;
                                })()}
                              </div>
                            );
                          })}
                          {duties.length === 0 && (
                            <div className="text-center text-gray-300 text-xs py-1">-</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {contacts.filter(c => filterDepartment === 'all' || c.department_id === filterDepartment).length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <p className="font-semibold">אין אנשי קשר להצגה</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
