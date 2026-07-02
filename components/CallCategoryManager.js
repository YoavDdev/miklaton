'use client';

import { useState, useEffect } from 'react';
import { getMunicipalityId } from '@/lib/municipality';

export default function CallCategoryManager() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [editingContact, setEditingContact] = useState(null); // Contact being edited
  const [editingCategory, setEditingCategory] = useState(null); // Category being edited
  const [vacationModal, setVacationModal] = useState(null); // { categoryId, contactId, contactName }
  const [vacationForm, setVacationForm] = useState({ start: '', end: '', reason: 'חופש' });
  const [savingVacation, setSavingVacation] = useState(false);
  const [phonebookContacts, setPhonebookContacts] = useState([]);
  const [nameSearch, setNameSearch] = useState('');
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Form states
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    icon: '',
    description: '',
    instructions: '',
    warning: '',
    auto_message: '',
    additional_info: '',
    display_order: 0,
    escalation_type: 'sequential'
  });

  const [contactForm, setContactForm] = useState({
    external_name: '',
    external_phone: '',
    external_role: '',
    escalation_order: 1,
    note: '',
    hours: '',
    is_primary: false,
    available_days: [0,1,2,3,4,5,6], // All days by default
    available_hours_start: '',
    available_hours_end: '',
    priority_order: 1, // Priority within time slot
    contact_type: 'escalation', // 'escalation' or 'notification'
    notes_for_operator: '', // Special instructions for operator
    shabbat_observer: false
  });

  useEffect(() => {
    loadCategories();
    loadPhonebook();
  }, []);

  const loadPhonebook = async () => {
    try {
      const res = await fetch('/api/contacts');
      const data = await res.json();
      if (data.success) setPhonebookContacts(data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNameSearchChange = (value) => {
    setNameSearch(value);
    setContactForm(f => ({ ...f, external_name: value }));
    if (value.length < 2) { setNameSuggestions([]); setShowSuggestions(false); return; }
    const matches = phonebookContacts.filter(c =>
      c.full_name?.toLowerCase().includes(value.toLowerCase())
    ).slice(0, 6);
    setNameSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  };

  const selectFromPhonebook = (contact) => {
    setNameSearch(contact.full_name);
    setContactForm(f => ({
      ...f,
      external_name: contact.full_name,
      external_phone: contact.phone || f.external_phone,
      external_role: contact.role || f.external_role,
    }));
    setShowSuggestions(false);
  };

  const saveToPhonebook = async () => {
    if (!contactForm.external_name || !contactForm.external_phone) return;
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: contactForm.external_name,
          phone: contactForm.external_phone,
          role: contactForm.external_role || '',
        })
      });
      const data = await res.json();
      if (data.success) loadPhonebook();
    } catch (err) {
      console.error(err);
    }
  };

  const loadCategories = async () => {
    try {
      setLoading(true);
      let municipalityId = getMunicipalityId();
      
      // Auto-fetch municipality ID if missing
      if (!municipalityId) {
        const { fetchYehudId, setMunicipalityId } = await import('@/lib/municipality');
        municipalityId = await fetchYehudId();
        if (municipalityId) {
          setMunicipalityId(municipalityId);
        } else {
          alert('❌ לא נמצא municipality_id - בדוק שה-seed רץ');
          setLoading(false);
          return;
        }
      }
      
      const response = await fetch(`/api/call-categories?municipality_id=${municipalityId}`);
      const data = await response.json();
      
      if (data.success) {
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      alert('❌ שגיאה בטעינת קטגוריות');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    try {
      let municipalityId = getMunicipalityId();
      if (!municipalityId) {
        const { fetchYehudId, setMunicipalityId } = await import('@/lib/municipality');
        municipalityId = await fetchYehudId();
        if (municipalityId) setMunicipalityId(municipalityId);
      }
      if (!municipalityId) { alert('❌ לא נמצא municipality_id'); return; }
      
      const response = await fetch('/api/call-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          municipality_id: municipalityId,
          ...categoryForm
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('✅ קטגוריה נוספה בהצלחה!');
        setShowAddCategory(false);
        resetCategoryForm();
        loadCategories();
      } else {
        alert('❌ שגיאה: ' + data.error);
      }
    } catch (error) {
      console.error('Error adding category:', error);
      alert('❌ שגיאה בהוספת קטגוריה');
    }
  };

  const handleEditCategory = (category) => {
    // Populate the form with category data
    setCategoryForm({
      name: category.name || '',
      icon: category.icon || '',
      description: category.description || '',
      instructions: category.instructions || '',
      warning: category.warning || '',
      auto_message: category.auto_message || '',
      additional_info: category.additional_info || '',
      display_order: category.display_order || 0,
      escalation_type: category.escalation_type || 'sequential'
    });
    
    setEditingCategory(category);
    setShowAddCategory(true);
  };

  const handleUpdateCategory = async (categoryId, updates) => {
    try {
      const response = await fetch('/api/call-categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: categoryId,
          ...updates
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('✅ קטגוריה עודכנה בהצלחה!');
        loadCategories();
      } else {
        alert('❌ שגיאה: ' + data.error);
      }
    } catch (error) {
      console.error('Error updating category:', error);
      alert('❌ שגיאה בעדכון קטגוריה');
    }
  };

  const handleDeleteCategory = async (categoryId, categoryName) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את הקטגוריה "${categoryName}"?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/call-categories?id=${categoryId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('✅ קטגוריה נמחקה בהצלחה!');
        loadCategories();
        if (selectedCategory?.id === categoryId) {
          setSelectedCategory(null);
        }
      } else {
        alert('❌ שגיאה: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('❌ שגיאה במחיקת קטגוריה');
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    
    if (!selectedCategory) {
      alert('❌ יש לבחור קטגוריה');
      return;
    }
    
    try {
      const response = await fetch(`/api/call-categories/${selectedCategory.id}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm)
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('✅ כונן נוסף בהצלחה!');
        setShowAddContact(false);
        resetContactForm();
        loadCategories();
      } else {
        alert('❌ שגיאה: ' + data.error);
      }
    } catch (error) {
      console.error('Error adding contact:', error);
      alert('❌ שגיאה בהוספת כונן');
    }
  };

  const handleDeleteContact = async (categoryId, contactId, contactName) => {
    if (!confirm(`האם אתה בטוח שברצונך להסיר את "${contactName}"?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/call-categories/${categoryId}/contacts?contact_id=${contactId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('✅ כונן הוסר בהצלחה!');
        loadCategories();
      } else {
        alert('❌ שגיאה: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('❌ שגיאה בהסרת כונן');
    }
  };

  const resetCategoryForm = () => {
    setCategoryForm({
      name: '',
      icon: '',
      description: '',
      instructions: '',
      warning: '',
      auto_message: '',
      additional_info: '',
      display_order: 0,
      escalation_type: 'sequential'
    });
  };

  const resetContactForm = () => {
    setNameSearch('');
    setNameSuggestions([]);
    setShowSuggestions(false);
    setContactForm({
      external_name: '',
      external_phone: '',
      external_role: '',
      escalation_order: 1,
      note: '',
      hours: '',
      is_primary: false,
      available_days: [0,1,2,3,4,5,6],
      available_hours_start: '',
      available_hours_end: '',
      shabbat_observer: false
    });
  };

  const returnFromUnavailable = async (categoryId, contactId, contactName) => {
    try {
      const res = await fetch(`/api/call-categories/${categoryId}/contacts/unavailable?contact_id=${contactId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) loadCategories();
    } catch (err) {
      console.error(err);
    }
  };

  const sendOnVacation = (categoryId, contactId, contactName) => {
    setVacationModal({ categoryId, contactId, contactName });
    setVacationForm({ start: '', end: '', reason: 'חופש' });
  };

  const confirmVacation = async () => {
    if (!vacationModal || !vacationForm.start || !vacationForm.end) return;
    setSavingVacation(true);
    try {
      const res = await fetch(`/api/call-categories/${vacationModal.categoryId}/contacts/vacation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: vacationModal.contactId,
          vacation_start: vacationForm.start,
          vacation_end: vacationForm.end,
          reason: vacationForm.reason
        })
      });
      const data = await res.json();
      if (data.success) {
        setVacationModal(null);
        loadCategories();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingVacation(false);
    }
  };

  const returnFromVacation = async (categoryId, contactId) => {
    try {
      const res = await fetch(`/api/call-categories/${categoryId}/contacts/vacation?contact_id=${contactId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) loadCategories();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditContact = (contact) => {
    // Find the category this contact belongs to
    const category = categories.find(cat => 
      cat.contacts?.some(c => c.id === contact.id)
    );
    
    if (!category) {
      alert('❌ לא נמצאה קטגוריה');
      return;
    }

    // Set the category and contact for editing
    setSelectedCategory(category);
    setEditingContact(contact);
    
    // Populate the form with contact data
    setContactForm({
      external_name: contact.external_name || '',
      external_phone: contact.external_phone || '',
      external_role: contact.external_role || '',
      escalation_order: contact.escalation_order || 1,
      note: contact.note || '',
      hours: contact.hours || '',
      is_primary: contact.is_primary || false,
      available_days: contact.available_days || [0,1,2,3,4,5,6],
      available_hours_start: contact.available_hours_start || '',
      available_hours_end: contact.available_hours_end || '',
      priority_order: contact.priority_order || 1,
      contact_type: contact.contact_type || 'escalation',
      notes_for_operator: contact.notes_for_operator || '',
      shabbat_observer: contact.shabbat_observer || false
    });
    
    setShowAddContact(true);
  };

  const handleUpdateContact = async (e) => {
    e.preventDefault();
    
    if (!editingContact) {
      alert('❌ שגיאה: אין כונן לעריכה');
      return;
    }

    try {
      const response = await fetch(`/api/call-categories/${selectedCategory.id}/contacts/${editingContact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm)
      });

      const data = await response.json();
      
      if (data.success) {
        alert('✅ הכונן עודכן בהצלחה');
        setShowAddContact(false);
        setEditingContact(null);
        resetContactForm();
        loadCategories();
      } else {
        alert('❌ שגיאה: ' + data.error);
      }
    } catch (error) {
      console.error('Error updating contact:', error);
      alert('❌ שגיאה בעדכון הכונן');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען קטגוריות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            📋 ניהול קטגוריות פניות
          </h2>
          <button
            onClick={() => setShowAddCategory(true)}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all font-semibold"
          >
            ➕ הוסף קטגוריה חדשה
          </button>
        </div>
        <p className="text-gray-600">
          נהל את קטגוריות הפניות והכוננים המשויכים לכל קטגוריה
        </p>
      </div>

      {/* ── Vacation Modal ── */}
      {vacationModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">🏖️ חופש – {vacationModal.contactName}</h3>
            <p className="text-sm text-gray-500 mb-5">הכונן לא יופיע למוקדן בטווח ההגדרה</p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">מתאריך</label>
                <input
                  type="date"
                  value={vacationForm.start}
                  onChange={e => setVacationForm({...vacationForm, start: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">עד תאריך</label>
                <input
                  type="date"
                  value={vacationForm.end}
                  min={vacationForm.start}
                  onChange={e => setVacationForm({...vacationForm, end: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
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
            </div>
            <div className="flex gap-3">
              <button
                onClick={confirmVacation}
                disabled={savingVacation || !vacationForm.start || !vacationForm.end}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white rounded-xl font-bold text-sm transition-all"
              >
                🏖️ שלח לחופש
              </button>
              <button
                onClick={() => setVacationModal(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Category Modal */}
      {showAddCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">
                {editingCategory ? `✏️ עריכת קטגוריה: ${editingCategory.name}` : '➕ הוספת קטגוריה חדשה'}
              </h3>
              <form onSubmit={editingCategory ? (e) => { e.preventDefault(); handleUpdateCategory(editingCategory.id, categoryForm).then(() => { setShowAddCategory(false); setEditingCategory(null); resetCategoryForm(); }); } : handleAddCategory} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">שם הקטגוריה *</label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold mb-1">אייקון (אימוג'י)</label>
                  <input
                    type="text"
                    value={categoryForm.icon}
                    onChange={(e) => setCategoryForm({...categoryForm, icon: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="🚨"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold mb-1">תיאור</label>
                  <textarea
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({...categoryForm, description: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows="3"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold mb-1">הוראות למוקדן</label>
                  <textarea
                    value={categoryForm.instructions}
                    onChange={(e) => setCategoryForm({...categoryForm, instructions: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows="2"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold mb-1">אזהרה</label>
                  <input
                    type="text"
                    value={categoryForm.warning}
                    onChange={(e) => setCategoryForm({...categoryForm, warning: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="⚠️ אזהרה חשובה"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold mb-1">סדר תצוגה</label>
                  <input
                    type="number"
                    value={categoryForm.display_order}
                    onChange={(e) => setCategoryForm({...categoryForm, display_order: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">סוג הקפצה</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCategoryForm({...categoryForm, escalation_type: 'sequential'})}
                      className={`px-3 py-3 rounded-lg text-sm font-medium border-2 transition-all flex flex-col items-center gap-1 ${
                        categoryForm.escalation_type === 'sequential'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <span className="text-lg">1️⃣</span>
                      <span className="font-bold">לפי סדר</span>
                      <span className="text-xs opacity-75">ראשון → שני → שלישי</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryForm({...categoryForm, escalation_type: 'parallel'})}
                      className={`px-3 py-3 rounded-lg text-sm font-medium border-2 transition-all flex flex-col items-center gap-1 ${
                        categoryForm.escalation_type === 'parallel'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-300'
                      }`}
                    >
                      <span className="text-lg">📢</span>
                      <span className="font-bold">כולם ביחד</span>
                      <span className="text-xs opacity-75">כל הכוננים בו-זמנית</span>
                    </button>
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold"
                  >
                    {editingCategory ? '✅ עדכן קטגוריה' : '➕ הוסף קטגוריה'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCategory(false);
                      setEditingCategory(null);
                      resetCategoryForm();
                    }}
                    className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-semibold"
                  >
                    ✕ ביטול
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContact && selectedCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">
                {editingContact ? '✏️ עריכת כונן' : '➕ הוספת כונן'} ב-{selectedCategory.name}
              </h3>
              <form onSubmit={editingContact ? handleUpdateContact : handleAddContact} className="space-y-4">
                <div className="relative">
                  <label className="block text-sm font-semibold mb-1">שם הכונן *</label>
                  <input
                    type="text"
                    value={nameSearch || contactForm.external_name}
                    onChange={e => handleNameSearchChange(e.target.value)}
                    onFocus={() => nameSearch.length >= 2 && setShowSuggestions(nameSuggestions.length > 0)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="חפש בספר הטלפונים..."
                    required
                  />
                  {showSuggestions && (
                    <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {nameSuggestions.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectFromPhonebook(c)}
                          className="w-full text-right px-3 py-2.5 hover:bg-blue-50 flex items-center justify-between border-b border-gray-100 last:border-0"
                        >
                          <span className="font-semibold text-sm text-gray-900">{c.full_name}</span>
                          <span className="text-xs text-gray-500">{c.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">טלפון</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={contactForm.external_phone}
                      onChange={(e) => setContactForm({...contactForm, external_phone: e.target.value})}
                      className="flex-1 px-3 py-2 border rounded-lg"
                      placeholder="050-1234567"
                    />
                    {contactForm.external_name && contactForm.external_phone && !phonebookContacts.some(c => c.phone === contactForm.external_phone) && (
                      <button
                        type="button"
                        onClick={saveToPhonebook}
                        className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold whitespace-nowrap"
                        title="שמור בספר הטלפונים"
                      >
                        💾 שמור בספר
                      </button>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold mb-1">תפקיד</label>
                  <input
                    type="text"
                    value={contactForm.external_role}
                    onChange={(e) => setContactForm({...contactForm, external_role: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold mb-1">סדר Escalation *</label>
                  <input
                    type="number"
                    value={contactForm.escalation_order}
                    onChange={(e) => setContactForm({...contactForm, escalation_order: parseInt(e.target.value) || 1})}
                    className="w-full px-3 py-2 border rounded-lg"
                    min="1"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">1 = ראשון, 2 = שני וכו'</p>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold mb-1">הערה</label>
                  <input
                    type="text"
                    value={contactForm.note}
                    onChange={(e) => setContactForm({...contactForm, note: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="אם אין מענה 3 פעמים"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold mb-1">שעות זמינות</label>
                  <input
                    type="text"
                    value={contactForm.hours}
                    onChange={(e) => setContactForm({...contactForm, hours: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="07:00-15:00 או שבת"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_primary"
                    checked={contactForm.is_primary}
                    onChange={(e) => setContactForm({...contactForm, is_primary: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <label htmlFor="is_primary" className="text-sm font-semibold">
                    כונן ראשי
                  </label>
                </div>

                <div className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-colors ${contactForm.shabbat_observer ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
                  <input
                    type="checkbox"
                    id="shabbat_observer"
                    checked={contactForm.shabbat_observer}
                    onChange={(e) => setContactForm({...contactForm, shabbat_observer: e.target.checked})}
                    className="w-4 h-4 mt-0.5"
                  />
                  <div>
                    <label htmlFor="shabbat_observer" className="text-sm font-semibold cursor-pointer">
                      🕍 שומר שבת
                    </label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      זמין 2 שעות לפני כניסת שבת ו-2 שעות אחרי יציאת שבת בלבד
                    </p>
                  </div>
                </div>

                {/* Priority and Type Settings */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">🎯 עדיפות וסוג</h4>
                  
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-sm font-semibold mb-1">עדיפות (1=ראשון)</label>
                      <input
                        type="number"
                        min="1"
                        value={contactForm.priority_order}
                        onChange={(e) => setContactForm({...contactForm, priority_order: parseInt(e.target.value) || 1})}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">סוג כונן</label>
                      <select
                        value={contactForm.contact_type}
                        onChange={(e) => setContactForm({...contactForm, contact_type: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="escalation">להקפצה</option>
                        <option value="notification">לעדכון בלבד</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">הערות למוקדן 💡</label>
                    <textarea
                      value={contactForm.notes_for_operator}
                      onChange={(e) => setContactForm({...contactForm, notes_for_operator: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                      rows="2"
                      placeholder="לדוגמה: להקפיץ רק במקרה של יותר מ-3 פנסים"
                    />
                  </div>
                </div>

                {/* Availability Settings */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-semibold mb-3">⏰ הגדרות זמינות</h4>
                  
                  <div className="mb-3">
                    <label className="block text-sm font-semibold mb-2">ימים בשבוע:</label>
                    {contactForm.shabbat_observer ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="grid grid-cols-7 gap-2 mb-2">
                          {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((day, idx) => {
                            const isShabbatDay = idx === 5 || idx === 6;
                            const isActive = !isShabbatDay && contactForm.available_days.includes(idx);
                            return (
                              <button
                                key={idx}
                                type="button"
                                disabled={isShabbatDay}
                                onClick={() => {
                                  if (isShabbatDay) return;
                                  const days = [...contactForm.available_days];
                                  if (days.includes(idx)) {
                                    setContactForm({...contactForm, available_days: days.filter(d => d !== idx)});
                                  } else {
                                    setContactForm({...contactForm, available_days: [...days, idx].sort()});
                                  }
                                }}
                                className={`px-2 py-1 rounded text-sm font-semibold ${
                                  isShabbatDay
                                    ? 'bg-blue-200 text-blue-500 cursor-not-allowed opacity-60'
                                    : isActive
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-gray-200 text-gray-600'
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-blue-700">
                          🕍 ו׳ ושבת מנוהלים אוטומטית — זמין 2 שעות לפני כניסה ו-2 שעות אחרי יציאה
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-7 gap-2">
                        {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((day, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              const days = [...contactForm.available_days];
                              if (days.includes(idx)) {
                                setContactForm({...contactForm, available_days: days.filter(d => d !== idx)});
                              } else {
                                setContactForm({...contactForm, available_days: [...days, idx].sort()});
                              }
                            }}
                            className={`px-2 py-1 rounded text-sm font-semibold ${
                              contactForm.available_days.includes(idx)
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold mb-1">שעת התחלה</label>
                      <input
                        type="time"
                        value={contactForm.available_hours_start}
                        onChange={(e) => setContactForm({...contactForm, available_hours_start: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">שעת סיום</label>
                      <input
                        type="time"
                        value={contactForm.available_hours_end}
                        onChange={(e) => setContactForm({...contactForm, available_hours_end: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">השאר ריק לזמינות 24/7</p>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold"
                  >
                    {editingContact ? '✅ עדכן כונן' : '➕ הוסף כונן'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddContact(false);
                      setEditingContact(null);
                      resetContactForm();
                    }}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold"
                  >
                    ביטול
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── לא זמינים כרגע ── */}
      {(() => {
        const unavailable = categories.flatMap(cat =>
          (cat.contacts || []).filter(c => c.currently_unavailable).map(c => ({ ...c, categoryId: cat.id, categoryName: cat.name }))
        );
        if (unavailable.length === 0) return null;
        return (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
            <h3 className="font-bold text-red-800 mb-3">📵 לא זמינים כרגע ({unavailable.length})</h3>
            <div className="space-y-2">
              {unavailable.map(c => (
                <div key={c.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border border-red-200">
                  <div>
                    <span className="font-semibold text-gray-900">{c.external_name || c.contact?.name}</span>
                    <span className="text-sm text-gray-500 mr-2">· {c.categoryName}</span>
                    {c.unavailable_until && (
                      <span className="text-xs text-red-600 mr-2">
                        עד {new Date(c.unavailable_until).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => returnFromUnavailable(c.categoryId, c.id, c.external_name)}
                    className="px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-semibold"
                  >
                    ✅ החזר לזמינות
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Categories List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {categories.map((category) => (
          <div
            key={category.id}
            className="bg-white rounded-xl shadow-sm border-2 border-gray-200 hover:border-blue-300 transition-all"
          >
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{category.icon}</span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{category.name}</h3>
                    <p className="text-sm text-gray-600">{category.description}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditCategory(category)}
                    className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm font-semibold"
                  >
                    ✏️ ערוך קטגוריה
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category.id, category.name)}
                    className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm font-semibold"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-gray-900">
                  📞 כוננים ({category.contacts?.length || 0})
                </p>
                <button
                  onClick={() => {
                    setSelectedCategory(category);
                    setShowAddContact(true);
                  }}
                  className="px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-sm font-semibold"
                >
                  ➕ הוסף כונן
                </button>
              </div>
              
              {category.contacts && category.contacts.length > 0 ? (
                <div className="space-y-2">
                  {category.contacts
                    .sort((a, b) => a.escalation_order - b.escalation_order)
                    .map((contact) => {
                      const displayName = contact.external_name || contact.contact?.name;
                      const displayPhone = contact.external_phone || contact.contact?.phone;
                      
                      return (
                        <div
                          key={contact.id}
                          className={`p-2 rounded border ${
                            contact.is_primary ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-gray-500">
                                  #{contact.escalation_order}
                                </span>
                                <span className="font-semibold text-sm">{displayName}</span>
                                {contact.is_primary && (
                                  <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                                    ראשי
                                  </span>
                                )}
                                {contact.on_vacation && (
                                  <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                                    🏖️ בחופש
                                  </span>
                                )}
                                {contact.currently_unavailable && (
                                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                                    📵 לא זמין
                                    {contact.unavailable_until && ` עד ${new Date(contact.unavailable_until).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`}
                                  </span>
                                )}
                              </div>
                              {displayPhone && (
                                <p className="text-xs text-gray-600">{displayPhone}</p>
                              )}
                              {contact.on_vacation && contact.vacation_start && contact.vacation_end && (
                                <p className="text-xs text-orange-600">
                                  🏖️ {contact.vacation_start} - {contact.vacation_end}
                                </p>
                              )}
                              {contact.note && (
                                <p className="text-xs text-gray-600">{contact.note}</p>
                              )}
                              {contact.available_hours_start && contact.available_hours_end && (
                                <p className="text-xs text-blue-600">
                                  ⏰ {contact.available_hours_start}-{contact.available_hours_end}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleEditContact(contact)}
                                className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs"
                                title="ערוך כונן"
                              >
                                ✏️
                              </button>
                              {contact.currently_unavailable ? (
                                <button
                                  onClick={() => returnFromUnavailable(category.id, contact.id, displayName)}
                                  className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs"
                                  title="החזר לזמינות"
                                >
                                  ✅
                                </button>
                              ) : null}
                              {contact.on_vacation ? (
                                <button
                                  onClick={() => returnFromVacation(category.id, contact.id, displayName)}
                                  className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs"
                                  title="החזר מחופש"
                                >
                                  ↩️
                                </button>
                              ) : (
                                <button
                                  onClick={() => sendOnVacation(category.id, contact.id, displayName)}
                                  className="px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded text-xs"
                                  title="שלח לחופש"
                                >
                                  🏖️
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteContact(category.id, contact.id, displayName)}
                                className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  אין כוננים בקטגוריה זו
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-4">📋</div>
          <p className="text-gray-600 mb-4">אין קטגוריות פניות במערכת</p>
          <button
            onClick={() => setShowAddCategory(true)}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold"
          >
            ➕ הוסף קטגוריה ראשונה
          </button>
        </div>
      )}
    </div>
  );
}
