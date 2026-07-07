'use client';

import { useState, useEffect } from 'react';
import { getMunicipalityId } from '@/lib/municipality';

export default function VacationManager() {
  const [vacations, setVacations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [phonebookContacts, setPhonebookContacts] = useState([]);
  const [categories, setCategories] = useState([]);
  
  const [vacationForm, setVacationForm] = useState({
    contact_id: '',
    vacation_start: '',
    vacation_end: '',
    reason: 'חופש',
    replacement_contact_id: ''
  });

  useEffect(() => {
    loadVacations();
    loadPhonebook();
    loadCategories();
  }, []);

  const loadVacations = async () => {
    try {
      setLoading(true);
      const municipalityId = getMunicipalityId();
      const res = await fetch(`/api/vacations?municipality_id=${municipalityId}`);
      const data = await res.json();
      if (data.success) {
        setVacations(data.vacations || []);
      }
    } catch (err) {
      console.error('Error loading vacations:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPhonebook = async () => {
    try {
      const res = await fetch('/api/contacts');
      const data = await res.json();
      if (data.success) {
        setPhonebookContacts(data.contacts || []);
      }
    } catch (err) {
      console.error('Error loading phonebook:', err);
    }
  };

  const loadCategories = async () => {
    try {
      const municipalityId = getMunicipalityId();
      const res = await fetch(`/api/call-categories?municipality_id=${municipalityId}`);
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const returnFromVacation = async (contactId, categoryId) => {
    if (!confirm('להחזיר כונן מחופש?')) return;
    try {
      const res = await fetch(`/api/call-categories/${categoryId}/contacts/vacation?contact_id=${contactId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        loadVacations();
      } else {
        alert('❌ ' + (data.error || 'שגיאה'));
      }
    } catch (err) {
      console.error(err);
      alert('❌ שגיאה בהחזרה מחופש');
    }
  };

  const getAllContactsFromCategories = () => {
    const contacts = [];
    categories.forEach(cat => {
      (cat.contacts || []).forEach(c => {
        if (c.external_name && c.external_phone) {
          contacts.push({
            id: c.id,
            categoryId: cat.id,
            categoryName: cat.name,
            name: c.external_name,
            phone: c.external_phone,
            role: c.external_role
          });
        }
      });
    });
    return contacts;
  };

  const handleSendToVacation = async (e) => {
    e.preventDefault();
    if (!vacationForm.contact_id || !vacationForm.vacation_start || !vacationForm.vacation_end) {
      alert('יש למלא כונן, תאריך התחלה וסיום');
      return;
    }

    const selectedContact = getAllContactsFromCategories().find(c => c.id === vacationForm.contact_id);
    if (!selectedContact) {
      alert('כונן לא נמצא');
      return;
    }

    try {
      const res = await fetch(`/api/call-categories/${selectedContact.categoryId}/contacts/vacation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: vacationForm.contact_id,
          vacation_start: vacationForm.vacation_start,
          vacation_end: vacationForm.vacation_end,
          reason: vacationForm.reason,
          replacement_contact_id: vacationForm.replacement_contact_id || null
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setVacationForm({ contact_id: '', vacation_start: '', vacation_end: '', reason: 'חופש', replacement_contact_id: '' });
        loadVacations();
      } else {
        alert('❌ ' + (data.error || 'שגיאה'));
      }
    } catch (err) {
      console.error(err);
      alert('❌ שגיאה בשליחה לחופש');
    }
  };

  const allContacts = getAllContactsFromCategories();

  return (
    <div className="bg-white rounded-lg shadow" dir="rtl">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">🏖️ ניהול חופשים</h2>
          <p className="text-sm text-gray-500 mt-1">ניהול מרכזי של כל חופשי הכוננים במערכת</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold text-sm transition-colors"
        >
          + שלח כונן לחופש
        </button>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-500">טוען חופשים...</p>
          </div>
        ) : vacations.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-5xl mb-3">🏖️</div>
            <p className="font-semibold">אין כוננים בחופש כרגע</p>
            <p className="text-sm mt-1">לחץ על "שלח כונן לחופש" למעלה להוספה</p>
          </div>
        ) : (
          <div className="space-y-3">
            {vacations.map(vac => {
              const categoryName = vac.call_category?.name || 'לא ידוע';
              const replacementName = vac.replacement?.full_name;
              return (
                <div key={vac.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-900">{vac.external_name}</span>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{categoryName}</span>
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">🏖️ {vac.vacation_reason || 'חופש'}</span>
                      </div>
                      <p className="text-sm text-gray-600">{vac.external_phone}</p>
                      <p className="text-sm text-orange-600 mt-1">
                        📅 {vac.vacation_start} עד {vac.vacation_end}
                      </p>
                      {replacementName && (
                        <p className="text-sm text-blue-600 mt-1">
                          🔄 מחליף: {replacementName} ({vac.replacement.phone})
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => returnFromVacation(vac.id, vac.call_category.id)}
                      className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-semibold transition-colors"
                    >
                      ↩️ החזר מחופש
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Vacation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">🏖️ שליחת כונן לחופש</h3>
            <form onSubmit={handleSendToVacation} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">כונן *</label>
                <select
                  value={vacationForm.contact_id}
                  onChange={e => setVacationForm({...vacationForm, contact_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  required
                >
                  <option value="">-- בחר כונן --</option>
                  {allContacts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.categoryName}) - {c.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">מתאריך *</label>
                <input
                  type="date"
                  value={vacationForm.vacation_start}
                  onChange={e => setVacationForm({...vacationForm, vacation_start: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">עד תאריך *</label>
                <input
                  type="date"
                  value={vacationForm.vacation_end}
                  min={vacationForm.vacation_start}
                  onChange={e => setVacationForm({...vacationForm, vacation_end: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">סיבה</label>
                <input
                  type="text"
                  value={vacationForm.reason}
                  onChange={e => setVacationForm({...vacationForm, reason: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="חופש, מחלה..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">מחליף (אופציונלי)</label>
                <select
                  value={vacationForm.replacement_contact_id}
                  onChange={e => setVacationForm({...vacationForm, replacement_contact_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">-- ללא מחליף --</option>
                  {phonebookContacts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} - {c.phone}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">אם יש מחליף, הוא יופיע במערכת בזמן החופש</p>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-all"
                >
                  🏖️ שלח לחופש
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
