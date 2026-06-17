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
  
  // Form states
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    icon: '',
    description: '',
    instructions: '',
    warning: '',
    auto_message: '',
    additional_info: '',
    display_order: 0
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
    notes_for_operator: '' // Special instructions for operator
  });

  useEffect(() => {
    loadCategories();
  }, []);

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
      display_order: category.display_order || 0
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
      display_order: 0
    });
  };

  const resetContactForm = () => {
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
      available_hours_end: ''
    });
  };

  const sendOnVacation = async (categoryId, contactId, contactName) => {
    const startDate = prompt('תאריך התחלת חופש (YYYY-MM-DD):');
    if (!startDate) return;
    
    const endDate = prompt('תאריך סיום חופש (YYYY-MM-DD):');
    if (!endDate) return;
    
    const reason = prompt('סיבה (אופציונלי):', 'חופש');
    
    try {
      const response = await fetch(`/api/call-categories/${categoryId}/contacts/vacation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contactId,
          vacation_start: startDate,
          vacation_end: endDate,
          reason
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('✅ כונן נשלח לחופש!');
        loadCategories();
      } else {
        alert('❌ שגיאה: ' + data.error);
      }
    } catch (error) {
      console.error('Error sending on vacation:', error);
      alert('❌ שגיאה בשליחה לחופש');
    }
  };

  const returnFromVacation = async (categoryId, contactId, contactName) => {
    if (!confirm(`האם להחזיר את ${contactName} מחופש?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/call-categories/${categoryId}/contacts/vacation?contact_id=${contactId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('✅ כונן חזר מחופש!');
        loadCategories();
      } else {
        alert('❌ שגיאה: ' + data.error);
      }
    } catch (error) {
      console.error('Error returning from vacation:', error);
      alert('❌ שגיאה בהחזרה מחופש');
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
      notes_for_operator: contact.notes_for_operator || ''
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
                    onChange={(e) => setCategoryForm({...categoryForm, display_order: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
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
                <div>
                  <label className="block text-sm font-semibold mb-1">שם הכונן *</label>
                  <input
                    type="text"
                    value={contactForm.external_name}
                    onChange={(e) => setContactForm({...contactForm, external_name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold mb-1">טלפון</label>
                  <input
                    type="text"
                    value={contactForm.external_phone}
                    onChange={(e) => setContactForm({...contactForm, external_phone: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="050-1234567"
                  />
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
                    onChange={(e) => setContactForm({...contactForm, escalation_order: parseInt(e.target.value)})}
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
                                    ❌ לא זמין
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
