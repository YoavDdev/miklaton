'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

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
                <input
                  type="number"
                  min="0"
                  max="23"
                  placeholder="שעת התחלה"
                  value={rosterForm.start_hour}
                  onChange={(e) => setRosterForm({ ...rosterForm, start_hour: parseInt(e.target.value) })}
                  className="px-3 py-2 border rounded"
                />
                <input
                  type="number"
                  min="0"
                  max="23"
                  placeholder="שעת סיום"
                  value={rosterForm.end_hour}
                  onChange={(e) => setRosterForm({ ...rosterForm, end_hour: parseInt(e.target.value) })}
                  className="px-3 py-2 border rounded"
                />
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
                {contacts.map(contact => (
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
                          {duties.map(duty => (
                            <div key={duty.id} className="text-xs bg-blue-100 px-1 py-0.5 rounded mb-1">
                              {duty.start_hour}:00-{duty.end_hour}:00
                            </div>
                          ))}
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
