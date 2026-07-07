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
    replacement_contact_id: '',
    // For contact search/creation:
    contact_search: '',
    contact_phone: '',
    contact_category_id: '',
    // For replacement search/creation:
    replacement_search: '',
    replacement_phone: ''
  });
  const [contactSuggestions, setContactSuggestions] = useState([]);
  const [showContactSuggestions, setShowContactSuggestions] = useState(false);
  const [replacementSuggestions, setReplacementSuggestions] = useState([]);
  const [showReplacementSuggestions, setShowReplacementSuggestions] = useState(false);

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
      const res = await fetch('/api/on-call-contacts');
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

  const handleContactSearch = (value) => {
    setVacationForm({...vacationForm, contact_search: value, contact_id: ''});
    
    if (value.length >= 2) {
      const allContacts = getAllContactsFromCategories();
      const filtered = allContacts.filter(c =>
        c.name.toLowerCase().includes(value.toLowerCase())
      );
      
      // Deduplicate by name/phone - show each person only once
      const seen = new Set();
      const unique = filtered.filter(c => {
        const key = `${c.name}_${c.phone}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      
      const matches = unique.slice(0, 5);
      setContactSuggestions(matches);
      setShowContactSuggestions(matches.length > 0);
    } else {
      setContactSuggestions([]);
      setShowContactSuggestions(false);
    }
  };

  const selectExistingContact = (contact) => {
    setVacationForm({
      ...vacationForm,
      contact_search: contact.name,
      contact_id: contact.id,
      contact_phone: contact.phone,
      contact_category_id: contact.categoryId
    });
    setShowContactSuggestions(false);
  };

  const handleReplacementSearch = (value) => {
    setVacationForm({...vacationForm, replacement_search: value, replacement_contact_id: ''});
    
    if (value.length >= 2) {
      const allContacts = getAllContactsFromCategories();
      const filtered = allContacts.filter(c =>
        c.name.toLowerCase().includes(value.toLowerCase())
      );
      
      // Deduplicate by name/phone
      const seen = new Set();
      const unique = filtered.filter(c => {
        const key = `${c.name}_${c.phone}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      
      const matches = unique.slice(0, 5);
      setReplacementSuggestions(matches);
      setShowReplacementSuggestions(matches.length > 0);
    } else {
      setReplacementSuggestions([]);
      setShowReplacementSuggestions(false);
    }
  };

  const selectReplacementContact = (contact) => {
    setVacationForm({
      ...vacationForm,
      replacement_search: contact.name,
      replacement_contact_id: contact.contact_id, // Use on_call_contacts ID, not call_category_contacts ID
      replacement_phone: contact.phone
    });
    setShowReplacementSuggestions(false);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setVacationForm({ 
      contact_id: '', 
      vacation_start: '', 
      vacation_end: '', 
      reason: 'חופש', 
      replacement_contact_id: '', 
      contact_search: '', 
      contact_phone: '', 
      contact_category_id: '',
      replacement_search: '',
      replacement_phone: ''
    });
    setContactSuggestions([]);
    setShowContactSuggestions(false);
    setReplacementSuggestions([]);
    setShowReplacementSuggestions(false);
  };

  const getAllContactsFromCategories = () => {
    const contacts = [];
    categories.forEach(cat => {
      (cat.contacts || []).forEach(c => {
        if (c.external_name && c.external_phone) {
          contacts.push({
            id: c.id,
            contact_id: c.contact_id, // ID from on_call_contacts (for replacement)
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
    
    console.log('Form submitted:', vacationForm);
    
    if (!vacationForm.contact_search || !vacationForm.vacation_start || !vacationForm.vacation_end) {
      alert('יש למלא שם כונן, תאריך התחלה וסיום');
      return;
    }

    try {
      let replacementContactId = vacationForm.replacement_contact_id;

      // Create replacement contact in on_call_contacts if needed
      if (vacationForm.replacement_search && !replacementContactId) {
        // If no phone provided, it means user typed but didn't complete the form
        if (!vacationForm.replacement_phone) {
          alert('כדי להוסיף מחליף חדש, יש למלא טלפון');
          return;
        }

        // Create in on_call_contacts
        const createReplacementRes = await fetch('/api/on-call-contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: vacationForm.replacement_search,
            phone: vacationForm.replacement_phone,
            municipality_id: null,
            department_id: null
          })
        });
        const replacementData = await createReplacementRes.json();
        if (!replacementData.success) {
          alert('❌ שגיאה ביצירת מחליף: ' + (replacementData.error || ''));
          return;
        }
        replacementContactId = replacementData.contact.id;
      }

      let categoryId, contactId;

      // If existing contact selected
      if (vacationForm.contact_id) {
        const allContacts = getAllContactsFromCategories();
        const selectedContact = allContacts.find(c => c.id === vacationForm.contact_id);
        if (!selectedContact) {
          alert('כונן לא נמצא');
          return;
        }
        
        // Find ALL contacts with same name (may be in multiple categories)
        const contactsWithSameName = allContacts.filter(c => 
          c.name.toLowerCase() === selectedContact.name.toLowerCase() ||
          c.phone === selectedContact.phone
        );
        
        // Send all of them to vacation
        const vacationPromises = contactsWithSameName.map(contact =>
          fetch(`/api/call-categories/${contact.categoryId}/contacts/vacation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contact_id: contact.id,
              vacation_start: vacationForm.vacation_start,
              vacation_end: vacationForm.vacation_end,
              reason: vacationForm.reason,
              replacement_contact_id: replacementContactId || null
            })
          }).then(res => res.json())
        );
        
        const results = await Promise.all(vacationPromises);
        const allSuccess = results.every(r => r.success);
        
        if (allSuccess) {
          closeModal();
          loadVacations();
        } else {
          alert('❌ שגיאה בשליחה לחופש');
        }
        return;
      } else {
        // Create new contact - phone is required, category is optional
        console.log('Creating new contact - no existing contact found');
        console.log('Has category?', !!vacationForm.contact_category_id);
        
        if (!vacationForm.contact_phone) {
          alert('כדי להוסיף כונן חדש, יש למלא טלפון');
          return;
        }

        if (vacationForm.contact_category_id) {
          // Create in a specific category
          const createRes = await fetch(`/api/call-categories/${vacationForm.contact_category_id}/contacts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              external_name: vacationForm.contact_search,
              external_phone: vacationForm.contact_phone,
              escalation_order: 999,
              on_vacation: true,
              vacation_start: vacationForm.vacation_start,
              vacation_end: vacationForm.vacation_end,
              vacation_reason: vacationForm.reason,
              replacement_contact_id: replacementContactId || null
            })
          });
          const createData = await createRes.json();
          if (!createData.success) {
            alert('❌ ' + (createData.error || 'שגיאה ביצירת כונן'));
            return;
          }
        } else {
          // No category - just save to on_call_contacts for vacation record only
          const municipalityId = getMunicipalityId();
          const createRes = await fetch('/api/on-call-contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: vacationForm.contact_search,
              phone: vacationForm.contact_phone,
              municipality_id: municipalityId,
              on_vacation: true,
              vacation_start: vacationForm.vacation_start,
              vacation_end: vacationForm.vacation_end,
              vacation_reason: vacationForm.reason,
              replacement_contact_id: replacementContactId || null
            })
          });
          const createData = await createRes.json();
          console.log('Create on-call contact result:', createData);
          if (!createData.success) {
            alert('❌ ' + (createData.error || 'שגיאה ביצירת כונן'));
            return;
          }
        }

        closeModal();
        loadVacations();
        return;
      }

      // Send existing contact to vacation
      const res = await fetch(`/api/call-categories/${categoryId}/contacts/vacation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contactId,
          vacation_start: vacationForm.vacation_start,
          vacation_end: vacationForm.vacation_end,
          reason: vacationForm.reason,
          replacement_contact_id: vacationForm.replacement_contact_id || null
        })
      });
      const data = await res.json();
      if (data.success) {
        closeModal();
        loadVacations();
      } else {
        alert('❌ ' + (data.error || 'שגיאה'));
      }
    } catch (err) {
      console.error(err);
      alert('❌ שגיאה בשליחה לחופש');
    }
  };

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
            {(() => {
              // Group vacations by name/phone to show each person only once
              const grouped = {};
              vacations.forEach(vac => {
                const key = `${vac.external_name}_${vac.external_phone}`;
                if (!grouped[key]) {
                  grouped[key] = {
                    name: vac.external_name,
                    phone: vac.external_phone,
                    vacation_start: vac.vacation_start,
                    vacation_end: vac.vacation_end,
                    vacation_reason: vac.vacation_reason,
                    replacement: vac.replacement,
                    categories: [],
                    allIds: []
                  };
                }
                grouped[key].categories.push(vac.call_category?.name || 'לא ידוע');
                grouped[key].allIds.push({ id: vac.id, categoryId: vac.call_category.id });
              });

              return Object.values(grouped).map((person, idx) => {
                const replacementName = person.replacement?.name;
                return (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-gray-900">{person.name}</span>
                          {person.categories.map((cat, i) => (
                            <span key={i} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{cat}</span>
                          ))}
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">🏖️ {person.vacation_reason || 'חופש'}</span>
                        </div>
                        <p className="text-sm text-gray-600">{person.phone}</p>
                        <p className="text-sm text-orange-600 mt-1">
                          📅 {person.vacation_start} עד {person.vacation_end}
                        </p>
                        {replacementName && (
                          <p className="text-sm text-blue-600 mt-1">
                            🔄 מחליף: {replacementName} ({person.replacement.phone})
                          </p>
                        )}
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm('להחזיר כונן מחופש מכל הקטגוריות?')) return;
                          try {
                            // Return from vacation in ALL categories
                            const promises = person.allIds.map(({ id, categoryId }) =>
                              fetch(`/api/call-categories/${categoryId}/contacts/vacation?contact_id=${id}`, {
                                method: 'DELETE'
                              }).then(res => res.json())
                            );
                            const results = await Promise.all(promises);
                            const allSuccess = results.every(r => r.success);
                            if (allSuccess) {
                              loadVacations();
                            } else {
                              alert('❌ שגיאה');
                            }
                          } catch (err) {
                            console.error(err);
                            alert('❌ שגיאה בהחזרה מחופש');
                          }
                        }}
                        className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-semibold transition-colors"
                      >
                        ↩️ החזר מחופש
                      </button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* Add Vacation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">🏖️ שליחת כונן לחופש</h3>
            <form onSubmit={handleSendToVacation} className="space-y-4">
              {/* Contact Search with Autocomplete */}
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-1">שם הכונן *</label>
                <input
                  type="text"
                  value={vacationForm.contact_search}
                  onChange={e => handleContactSearch(e.target.value)}
                  onFocus={() => vacationForm.contact_search.length >= 2 && setShowContactSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowContactSuggestions(false), 200)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="התחל להקליד שם..."
                  required
                />
                {showContactSuggestions && contactSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {contactSuggestions.map(contact => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => selectExistingContact(contact)}
                        className="w-full text-right px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        <p className="font-semibold text-sm text-gray-900">{contact.name}</p>
                        <p className="text-xs text-gray-500">{contact.categoryName} · {contact.phone}</p>
                      </button>
                    ))}
                  </div>
                )}
                {vacationForm.contact_search && !vacationForm.contact_id && (
                  <p className="text-xs text-blue-600 mt-1">💡 לא נמצא? הוסף טלפון למטה לרשומת חופשים (קטגוריה אופציונלי)</p>
                )}
              </div>

              {/* Show phone and category fields if contact not found */}
              {vacationForm.contact_search && !vacationForm.contact_id && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">טלפון *</label>
                    <input
                      type="tel"
                      value={vacationForm.contact_phone}
                      onChange={e => setVacationForm({...vacationForm, contact_phone: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="05X-XXXXXXX"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">קטגוריה (אופציונלי)</label>
                    <select
                      value={vacationForm.contact_category_id}
                      onChange={e => setVacationForm({...vacationForm, contact_category_id: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">-- בחר קטגוריה --</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

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

              {/* Replacement Contact Search with Autocomplete */}
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-1">מחליף (אופציונלי)</label>
                <input
                  type="text"
                  value={vacationForm.replacement_search}
                  onChange={e => handleReplacementSearch(e.target.value)}
                  onFocus={() => vacationForm.replacement_search.length >= 2 && setShowReplacementSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowReplacementSuggestions(false), 200)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="התחל להקליד שם מחליף..."
                />
                {showReplacementSuggestions && replacementSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {replacementSuggestions.map(contact => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => selectReplacementContact(contact)}
                        className="w-full text-right px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        <p className="font-semibold text-sm text-gray-900">{contact.name}</p>
                        <p className="text-xs text-gray-500">{contact.categoryName} · {contact.phone}</p>
                      </button>
                    ))}
                  </div>
                )}
                {vacationForm.replacement_search && !vacationForm.replacement_contact_id && (
                  <p className="text-xs text-blue-600 mt-1">💡 לא נמצא? הוסף טלפון למטה ליצירת מחליף חדש</p>
                )}
                {!vacationForm.replacement_search && (
                  <p className="text-xs text-gray-500 mt-1">אם יש מחליף, הוא יופיע במערכת במקום הכונן שבחופש</p>
                )}
              </div>

              {/* Show phone field if replacement not found */}
              {vacationForm.replacement_search && !vacationForm.replacement_contact_id && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">טלפון מחליף *</label>
                  <input
                    type="tel"
                    value={vacationForm.replacement_phone}
                    onChange={e => setVacationForm({...vacationForm, replacement_phone: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="05X-XXXXXXX"
                    required
                  />
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-all"
                >
                  🏖️ שלח לחופש
                </button>
                <button
                  type="button"
                  onClick={closeModal}
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
