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
  
  const [deptForm, setDeptForm] = useState({ name: '', display_order: 0 });
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
      setDeptForm({ name: '', display_order: 0 });
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
    if (!confirm('למחוק כוננות זו?')) return;
    
    await fetch(`/api/duty-roster?id=${id}`, { method: 'DELETE' });
    fetchDutyRoster();
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
              setDeptForm({ name: '', display_order: departments.length + 1 });
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
                  <p className="text-sm text-gray-600">
                    {dept.contacts?.length || 0} אנשי קשר
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingItem(dept);
                      setDeptForm({ name: dept.name, display_order: dept.display_order });
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
          <button
            onClick={() => {
              setShowRosterForm(true);
              setEditingItem(null);
              setRosterForm({ 
                contact_id: contacts[0]?.id || '', 
                department_id: contacts[0]?.department_id || '',
                day_of_week: 0, 
                start_hour: 8, 
                end_hour: 17, 
                notes: '' 
              });
            }}
            className="mb-4 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg"
          >
            + הוסף כוננות
          </button>

          {showRosterForm && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-purple-200">
              <h3 className="font-bold mb-3">{editingItem ? 'ערוך כוננות' : 'כוננות חדשה'}</h3>
              
              {/* Shift Preset Selector */}
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <label className="block text-sm font-semibold text-blue-900 mb-2">
                  💡 בחר סוג משמרת (מומלץ):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SHIFT_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedPreset(idx);
                        if (preset.start !== null) {
                          setRosterForm({
                            ...rosterForm,
                            start_hour: preset.start,
                            end_hour: preset.end
                          });
                        }
                      }}
                      className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                        selectedPreset === idx
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-blue-700 hover:bg-blue-100 border border-blue-300'
                      }`}
                    >
                      <div className="font-bold">{preset.label}</div>
                      <div className="text-xs opacity-75">{preset.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <select
                  value={rosterForm.contact_id}
                  onChange={(e) => {
                    const contact = contacts.find(c => c.id === e.target.value);
                    setRosterForm({ 
                      ...rosterForm, 
                      contact_id: e.target.value,
                      department_id: contact?.department_id || ''
                    });
                  }}
                  className="px-3 py-2 border rounded"
                >
                  <option value="">בחר איש קשר</option>
                  {contacts.map(contact => (
                    <option key={contact.id} value={contact.id}>
                      {contact.full_name} ({contact.departments?.name})
                    </option>
                  ))}
                </select>
                <select
                  value={rosterForm.day_of_week}
                  onChange={(e) => setRosterForm({ ...rosterForm, day_of_week: parseInt(e.target.value) })}
                  className="px-3 py-2 border rounded"
                >
                  {DAYS.map((day, i) => (
                    <option key={i} value={i}>{day}</option>
                  ))}
                </select>
                
                {/* Hour inputs with helper text */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">שעת התחלה (0-23)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={rosterForm.start_hour}
                    onChange={(e) => setRosterForm({ ...rosterForm, start_hour: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    שעת סיום (0-23)
                    <span className="text-blue-600 font-semibold"> • 0=חצות • שווה להתחלה=24 שעות</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={rosterForm.end_hour}
                    onChange={(e) => setRosterForm({ ...rosterForm, end_hour: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                
                {/* Preview of selected time */}
                <div className="col-span-2 p-2 bg-green-50 border border-green-200 rounded text-center">
                  <span className="text-sm font-semibold text-green-800">
                    ⏰ כוננות: {String(rosterForm.start_hour).padStart(2, '0')}:00 - {String(rosterForm.end_hour).padStart(2, '0')}:00
                    {rosterForm.start_hour === rosterForm.end_hour && ' (24 שעות)'}
                    {rosterForm.end_hour === 0 && rosterForm.start_hour > 0 && ' (עד חצות)'}
                  </span>
                </div>
                
                <input
                  type="text"
                  placeholder="הערות (אופציונלי)"
                  value={rosterForm.notes}
                  onChange={(e) => setRosterForm({ ...rosterForm, notes: e.target.value })}
                  className="px-3 py-2 border rounded col-span-2"
                />
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleSaveRoster}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
                >
                  שמור
                </button>
                <button
                  onClick={() => {
                    setShowRosterForm(false);
                    setEditingItem(null);
                  }}
                  className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}

          {/* Department Filter */}
          <div className="mb-4 flex items-center gap-3">
            <label className="font-semibold text-gray-700">🏢 סינון לפי מכלול:</label>
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

          {/* Weekly Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2">איש קשר</th>
                  {DAYS.map((day, i) => (
                    <th key={i} className="border p-2">{day}</th>
                  ))}
                  <th className="border p-2">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {contacts
                  .filter(contact => filterDepartment === 'all' || contact.department_id === filterDepartment)
                  .map(contact => (
                  <tr key={contact.id}>
                    <td className="border p-2 font-semibold">
                      {contact.full_name}
                      <div className="text-xs text-gray-500">{contact.departments?.name}</div>
                    </td>
                    {DAYS.map((_, dayIndex) => {
                      const duties = dutyRoster.filter(
                        d => d.contact_id === contact.id && d.day_of_week === dayIndex
                      );
                      return (
                        <td key={dayIndex} className="border p-1">
                          {duties.map(duty => {
                            let displayText = '';
                            let bgColor = 'bg-blue-100';
                            
                            if (duty.start_hour === duty.end_hour) {
                              // 24-hour shift
                              displayText = '24 שעות';
                              bgColor = 'bg-green-200';
                            } else if (duty.end_hour === 0) {
                              // Overnight shift ending at midnight
                              displayText = `${String(duty.start_hour).padStart(2, '0')}:00-חצות`;
                              bgColor = 'bg-purple-200';
                            } else {
                              // Normal shift
                              displayText = `${String(duty.start_hour).padStart(2, '0')}:00-${String(duty.end_hour).padStart(2, '0')}:00`;
                            }
                            
                            return (
                              <div key={duty.id} className={`text-xs ${bgColor} px-1 py-0.5 rounded mb-1 font-medium`}>
                                {displayText}
                                {duty.notes && <div className="text-xs opacity-75">{duty.notes}</div>}
                              </div>
                            );
                          })}
                        </td>
                      );
                    })}
                    <td className="border p-2">
                      {dutyRoster
                        .filter(d => d.contact_id === contact.id)
                        .map(duty => (
                          <button
                            key={duty.id}
                            onClick={() => handleDeleteRoster(duty.id)}
                            className="text-red-600 hover:text-red-800 text-xs block"
                          >
                            מחק
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
