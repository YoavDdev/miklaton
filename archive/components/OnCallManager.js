'use client';

import { useState, useEffect } from 'react';
import onCallDataOriginal from '@/data/onCall.json';

const SHIFT_OPTIONS = [
  { value: '24/7', label: '24/7' },
  { value: 'יום', label: 'יום (07:00-19:00)' },
  { value: 'לילה', label: 'לילה (19:00-07:00)' },
  { value: 'רגיל', label: 'רגיל' },
];

const DEPARTMENT_KEYS = Object.keys(onCallDataOriginal.departments);

export default function OnCallManager() {
  const [contacts, setContacts] = useState([]);
  const [weekLabel, setWeekLabel] = useState(onCallDataOriginal.weekLabel);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [filterShift, setFilterShift] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    shift: 'רגיל',
    department: DEPARTMENT_KEYS[0],
  });

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = () => {
    const allContacts = [];
    Object.keys(onCallDataOriginal.departments).forEach(deptKey => {
      const dept = onCallDataOriginal.departments[deptKey];
      dept.contacts.forEach(contact => {
        allContacts.push({
          ...contact,
          department: dept.name,
          departmentKey: deptKey,
          isCustom: false,
        });
      });
    });

    const saved = localStorage.getItem('onCallFullData');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.contacts) {
          const mergedMap = {};
          allContacts.forEach(c => { mergedMap[c.id] = c; });
          parsed.contacts.forEach(c => {
            if (mergedMap[c.id]) {
              mergedMap[c.id] = { ...mergedMap[c.id], ...c };
            } else {
              mergedMap[c.id] = { ...c, isCustom: true };
            }
          });
          if (parsed.removed) {
            parsed.removed.forEach(id => delete mergedMap[id]);
          }
          setContacts(Object.values(mergedMap));
        } else {
          setContacts(allContacts);
        }
        if (parsed.weekLabel) setWeekLabel(parsed.weekLabel);
      } catch {
        setContacts(allContacts);
      }
    } else {
      const overrides = localStorage.getItem('onCallActiveOverrides');
      if (overrides) {
        try {
          const parsed = JSON.parse(overrides);
          const updated = allContacts.map(c => ({
            ...c,
            active: parsed[c.id] !== undefined ? parsed[c.id] : c.active
          }));
          setContacts(updated);
        } catch {
          setContacts(allContacts);
        }
      } else {
        setContacts(allContacts);
      }
    }
  };

  const saveContacts = (updatedContacts, updatedWeekLabel) => {
    const label = updatedWeekLabel || weekLabel;
    const customContacts = updatedContacts.filter(c => c.isCustom);
    const modifiedOriginals = updatedContacts.filter(c => !c.isCustom);
    const allOriginalIds = [];
    Object.keys(onCallDataOriginal.departments).forEach(deptKey => {
      onCallDataOriginal.departments[deptKey].contacts.forEach(c => {
        allOriginalIds.push(c.id);
      });
    });
    const removedIds = allOriginalIds.filter(id => !updatedContacts.find(c => c.id === id));

    const saveData = {
      weekLabel: label,
      contacts: [...modifiedOriginals, ...customContacts].map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        shift: c.shift,
        active: c.active,
        department: c.department,
        departmentKey: c.departmentKey,
        isCustom: c.isCustom || false,
      })),
      removed: removedIds,
    };
    localStorage.setItem('onCallFullData', JSON.stringify(saveData));

    const activeOverrides = {};
    updatedContacts.forEach(c => { activeOverrides[c.id] = c.active; });
    localStorage.setItem('onCallActiveOverrides', JSON.stringify(activeOverrides));
  };

  const toggleActive = (contactId) => {
    const updated = contacts.map(c =>
      c.id === contactId ? { ...c, active: !c.active } : c
    );
    setContacts(updated);
    saveContacts(updated);
  };

  const updateShift = (contactId, newShift) => {
    const updated = contacts.map(c =>
      c.id === contactId ? { ...c, shift: newShift } : c
    );
    setContacts(updated);
    saveContacts(updated);
  };

  const removeContact = (contactId) => {
    if (!confirm('האם אתה בטוח שברצונך להסיר איש קשר זה?')) return;
    const updated = contacts.filter(c => c.id !== contactId);
    setContacts(updated);
    saveContacts(updated);
  };

  const addContact = () => {
    if (!newContact.name || !newContact.phone) {
      alert('שם וטלפון הם שדות חובה');
      return;
    }
    const dept = onCallDataOriginal.departments[newContact.department];
    const contact = {
      id: `custom_${Date.now()}`,
      name: newContact.name,
      phone: newContact.phone,
      shift: newContact.shift,
      active: true,
      department: dept?.name || newContact.department,
      departmentKey: newContact.department,
      isCustom: true,
    };
    const updated = [...contacts, contact];
    setContacts(updated);
    saveContacts(updated);
    setNewContact({ name: '', phone: '', shift: 'רגיל', department: DEPARTMENT_KEYS[0] });
    setShowAddForm(false);
  };

  const startEdit = (contact) => {
    setEditingContact({ ...contact });
  };

  const saveEdit = () => {
    if (!editingContact) return;
    const updated = contacts.map(c =>
      c.id === editingContact.id ? { ...editingContact } : c
    );
    setContacts(updated);
    saveContacts(updated);
    setEditingContact(null);
  };

  const updateWeekLabel = () => {
    const now = new Date();
    const label = `עודכן ${now.toLocaleDateString('he-IL')}`;
    setWeekLabel(label);
    saveContacts(contacts, label);
  };

  const resetToDefaults = () => {
    if (!confirm('האם לאפס את כל השינויים ולחזור לברירת המחדל?')) return;
    localStorage.removeItem('onCallFullData');
    localStorage.removeItem('onCallActiveOverrides');
    loadContacts();
  };

  const getCurrentShiftLabel = () => {
    const hour = new Date().getHours();
    return hour >= 7 && hour < 19 ? 'יום' : 'לילה';
  };

  const filteredContacts = contacts.filter(c => {
    if (filterShift !== 'all') {
      if (filterShift === 'active_now') {
        const currentShift = getCurrentShiftLabel();
        return c.active && (c.shift === currentShift || c.shift === '24/7' || c.shift === 'רגיל');
      }
      if (c.shift !== filterShift) return false;
    }
    if (filterDept !== 'all' && c.departmentKey !== filterDept) return false;
    return true;
  });

  const groupedByDept = {};
  filteredContacts.forEach(c => {
    const key = c.departmentKey || 'other';
    if (!groupedByDept[key]) groupedByDept[key] = { name: c.department, contacts: [] };
    groupedByDept[key].contacts.push(c);
  });

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">ניהול אנשי קשר תורנים</h2>
          <p className="text-sm text-gray-600 mt-1">{weekLabel}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={updateWeekLabel}
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            📅 עדכן תאריך
          </button>
          <button
            onClick={resetToDefaults}
            className="bg-gray-500 hover:bg-gray-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            🔄 איפוס
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-700">משמרת:</span>
          {[
            { value: 'all', label: 'הכל' },
            { value: 'active_now', label: `🟢 פעילים עכשיו (${getCurrentShiftLabel()})` },
            { value: 'יום', label: '☀️ יום' },
            { value: 'לילה', label: '🌙 לילה' },
            { value: '24/7', label: '24/7' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterShift(opt.value)}
              className={`px-3 py-1 rounded-lg text-sm font-semibold border transition-colors ${
                filterShift === opt.value
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <span className="text-sm font-bold text-gray-700 self-center">מכלול:</span>
        <button
          onClick={() => setFilterDept('all')}
          className={`px-3 py-1 rounded-lg text-sm font-semibold border transition-colors ${
            filterDept === 'all'
              ? 'bg-purple-600 text-white border-purple-600'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}
        >
          הכל
        </button>
        {DEPARTMENT_KEYS.map(key => (
          <button
            key={key}
            onClick={() => setFilterDept(key)}
            className={`px-3 py-1 rounded-lg text-sm font-semibold border transition-colors ${
              filterDept === key
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {onCallDataOriginal.departments[key].name}
          </button>
        ))}
      </div>

      {/* Add Contact Button */}
      <div className="mb-6">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
        >
          {showAddForm ? '✕ ביטול' : '➕ הוסף איש קשר'}
        </button>
      </div>

      {/* Add Contact Form */}
      {showAddForm && (
        <div className="mb-6 p-5 bg-green-50 border-2 border-green-300 rounded-xl">
          <h3 className="text-lg font-bold text-green-900 mb-4">הוספת איש קשר חדש</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-1">שם *</label>
              <input
                type="text"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                placeholder="שם מלא"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-1">טלפון *</label>
              <input
                type="tel"
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                placeholder="050-000-0000"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-1">משמרת</label>
              <select
                value={newContact.shift}
                onChange={(e) => setNewContact({ ...newContact, shift: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
              >
                {SHIFT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-1">מכלול</label>
              <select
                value={newContact.department}
                onChange={(e) => setNewContact({ ...newContact, department: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
              >
                {DEPARTMENT_KEYS.map(key => (
                  <option key={key} value={key}>
                    {onCallDataOriginal.departments[key].name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={addContact}
            className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition-colors"
          >
            ✓ הוסף
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {editingContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full" dir="rtl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">עריכת איש קשר</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-1">שם</label>
                <input
                  type="text"
                  value={editingContact.name}
                  onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-1">טלפון</label>
                <input
                  type="tel"
                  value={editingContact.phone}
                  onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-1">משמרת</label>
                <select
                  value={editingContact.shift}
                  onChange={(e) => setEditingContact({ ...editingContact, shift: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                >
                  {SHIFT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={saveEdit}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition-colors"
              >
                ✓ שמור
              </button>
              <button
                onClick={() => setEditingContact(null)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 rounded-lg transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact List grouped by department */}
      <div className="space-y-6">
        {Object.entries(groupedByDept).map(([deptKey, dept]) => (
          <div key={deptKey}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-lg font-bold text-gray-800">{dept.name}</h3>
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {dept.contacts.filter(c => c.active).length}/{dept.contacts.length} פעילים
              </span>
            </div>
            <div className="space-y-2">
              {dept.contacts.map((contact) => (
                <div
                  key={contact.id}
                  className={`flex items-center justify-between p-4 border-2 rounded-xl transition-all ${
                    contact.active
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200 bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={contact.active}
                      onChange={() => toggleActive(contact.id)}
                      className="w-6 h-6 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900 text-lg">{contact.name}</p>
                        {contact.isCustom && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">חדש</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          contact.shift === 'יום' ? 'bg-yellow-100 text-yellow-800' :
                          contact.shift === 'לילה' ? 'bg-indigo-100 text-indigo-800' :
                          contact.shift === '24/7' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {contact.shift === 'יום' ? '☀️' : contact.shift === 'לילה' ? '🌙' : contact.shift === '24/7' ? '🔴' : '⚪'} {contact.shift}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-left ml-3">
                      <a href={`tel:${contact.phone}`} className="font-mono text-gray-900 hover:text-blue-600" dir="ltr">
                        {contact.phone}
                      </a>
                      <p className="text-xs text-gray-500">
                        {contact.active ? '🟢 פעיל' : '⚫ לא פעיל'}
                      </p>
                    </div>
                    <button
                      onClick={() => startEdit(contact)}
                      className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="ערוך"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => removeContact(contact.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="הסר"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filteredContacts.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">👥</div>
          <p className="font-semibold">אין אנשי קשר בסינון הנוכחי</p>
        </div>
      )}

      {/* Summary Bar */}
      <div className="mt-6 p-4 bg-purple-50 border-2 border-purple-200 rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-4 text-sm">
            <span className="font-bold text-purple-900">סה״כ: {contacts.length} אנשי קשר</span>
            <span className="text-green-700 font-semibold">🟢 {contacts.filter(c => c.active).length} פעילים</span>
            <span className="text-yellow-700 font-semibold">☀️ {contacts.filter(c => c.shift === 'יום').length} יום</span>
            <span className="text-indigo-700 font-semibold">🌙 {contacts.filter(c => c.shift === 'לילה').length} לילה</span>
            <span className="text-red-700 font-semibold">🔴 {contacts.filter(c => c.shift === '24/7').length} 24/7</span>
          </div>
          <p className="text-xs text-purple-700">שינויים נשמרים אוטומטית ב-localStorage</p>
        </div>
      </div>
    </div>
  );
}
