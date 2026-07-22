'use client';

import { useState, useEffect } from 'react';

const CATEGORIES = ['כללי', 'פיקוח', 'תברואה', 'חירום', 'רישוי', 'תשתיות', 'ביטחון', 'רווחה', 'חינוך'];

export default function KnowledgeBaseManager({ userName = 'מנהל' }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('כללי');
  const [formTags, setFormTags] = useState('');
  const [formContacts, setFormContacts] = useState([]);

  useEffect(() => {
    fetchEntries();
  }, [searchTerm, filterCategory]);

  const fetchEntries = async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      if (filterCategory) params.set('category', filterCategory);

      const res = await fetch(`/api/knowledge-base?${params}`);
      const data = await res.json();
      if (data.success) {
        setEntries(data.entries);
      }
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormContent('');
    setFormCategory('כללי');
    setFormTags('');
    setFormContacts([]);
    setEditingEntry(null);
    setShowForm(false);
  };

  const openEditForm = (entry) => {
    setFormTitle(entry.title);
    setFormContent(entry.content);
    setFormCategory(entry.category);
    setFormTags((entry.tags || []).join(', '));
    setFormContacts(entry.contacts || []);
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim()) {
      alert('יש למלא כותרת ותוכן');
      return;
    }

    const payload = {
      title: formTitle.trim(),
      content: formContent.trim(),
      category: formCategory,
      tags: formTags.split(',').map(t => t.trim()).filter(Boolean),
      contacts: formContacts.filter(c => c.name),
      ...(editingEntry ? { id: editingEntry.id, updated_by: userName } : { created_by: userName })
    };

    try {
      const res = await fetch('/api/knowledge-base', {
        method: editingEntry ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        resetForm();
        fetchEntries();
      } else {
        alert('שגיאה בשמירה: ' + data.error);
      }
    } catch (error) {
      alert('שגיאה בחיבור לשרת');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('האם למחוק ערך זה?')) return;

    try {
      const res = await fetch(`/api/knowledge-base?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchEntries();
      }
    } catch (error) {
      alert('שגיאה במחיקה');
    }
  };

  const addContact = () => {
    setFormContacts([...formContacts, { name: '', phone: '', role: '' }]);
  };

  const updateContact = (index, field, value) => {
    const updated = [...formContacts];
    updated[index] = { ...updated[index], [field]: value };
    setFormContacts(updated);
  };

  const removeContact = (index) => {
    setFormContacts(formContacts.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">ניהול מאגר הידע</h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
        >
          + ערך חדש
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="חיפוש..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">כל הקטגוריות</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-bold mb-4">
              {editingEntry ? 'עריכת ערך' : 'ערך חדש'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">כותרת</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="לדוגמה: גרירת רכבים נטושים"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">קטגוריה</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תוכן</label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={10}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="כתוב כאן את כל המידע הרלוונטי..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תגיות (מופרדות בפסיק)</label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="רכב, גרירה, נטוש, פקח"
                />
              </div>

              {/* Contacts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">אנשי קשר</label>
                  <button
                    type="button"
                    onClick={addContact}
                    className="text-xs text-purple-600 hover:text-purple-800"
                  >
                    + הוסף איש קשר
                  </button>
                </div>
                {formContacts.map((contact, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={contact.name}
                      onChange={(e) => updateContact(idx, 'name', e.target.value)}
                      placeholder="שם"
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                    <input
                      type="text"
                      value={contact.phone}
                      onChange={(e) => updateContact(idx, 'phone', e.target.value)}
                      placeholder="טלפון"
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                    <input
                      type="text"
                      value={contact.role}
                      onChange={(e) => updateContact(idx, 'role', e.target.value)}
                      placeholder="תפקיד"
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeContact(idx)}
                      className="text-red-500 hover:text-red-700 text-sm px-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                שמור
              </button>
              <button
                onClick={resetForm}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entries List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">טוען...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-4xl mb-2">📚</p>
          <p>אין ערכים עדיין. לחץ "ערך חדש" כדי להתחיל לבנות את מאגר הידע.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <div key={entry.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-800">{entry.title}</h3>
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                      {entry.category}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{entry.content}</p>
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {entry.tags.map((tag, i) => (
                        <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    עודכן: {new Date(entry.updated_at).toLocaleDateString('he-IL')} | ע"י: {entry.updated_by}
                  </p>
                </div>
                <div className="flex gap-1 mr-3">
                  <button
                    onClick={() => openEditForm(entry)}
                    className="text-sm text-blue-600 hover:text-blue-800 px-2 py-1"
                  >
                    ערוך
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="text-sm text-red-500 hover:text-red-700 px-2 py-1"
                  >
                    מחק
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="text-center text-sm text-gray-400 pt-4 border-t">
        {entries.length} ערכים במאגר
      </div>
    </div>
  );
}
