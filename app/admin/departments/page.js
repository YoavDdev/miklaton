'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { getMunicipalityId } from '@/lib/municipality';

export default function AdminDepartmentsPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [form, setForm] = useState({
    name: '',
    manager_name: '',
    manager_phone: '',
    display_order: 0
  });

  useEffect(() => {
    checkAuth();
    fetchDepartments();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) { router.push('/login'); return; }
      const data = await res.json();
      if (data.user.role !== 'admin') { router.push('/dashboard'); return; }
    } catch (error) {
      router.push('/login');
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments');
      const data = await res.json();
      if (data.success) {
        setDepartments(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('שגיאה בטעינת מכלולים');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('נא להזין שם מכלול');
      return;
    }

    try {
      const municipalityId = getMunicipalityId();
      const method = editingDept ? 'PATCH' : 'POST';
      const body = editingDept 
        ? { id: editingDept.id, ...form }
        : { municipality_id: municipalityId, ...form };

      const res = await fetch('/api/departments', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (data.success) {
        toast.success(editingDept ? 'מכלול עודכן בהצלחה! ✅' : 'מכלול נוסף בהצלחה! ✅');
        setShowForm(false);
        setEditingDept(null);
        setForm({ name: '', manager_name: '', manager_phone: '', display_order: 0 });
        fetchDepartments();
      } else {
        toast.error('שגיאה: ' + (data.error || 'לא ידוע'));
      }
    } catch (error) {
      toast.error('שגיאה בשמירת מכלול');
    }
  };

  const handleEdit = (dept) => {
    setEditingDept(dept);
    setForm({
      name: dept.name || '',
      manager_name: dept.manager_name || '',
      manager_phone: dept.manager_phone || '',
      display_order: dept.display_order || 0
    });
    setShowForm(true);
  };

  const handleDelete = async (dept) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את המכלול "${dept.name}"?\nכל אנשי הקשר והמשמרות יימחקו!`)) {
      return;
    }

    try {
      const res = await fetch(`/api/departments?id=${dept.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('מכלול נמחק בהצלחה! 🗑️');
        fetchDepartments();
      } else {
        toast.error('שגיאה במחיקה: ' + (data.error || 'לא ידוע'));
      }
    } catch (error) {
      toast.error('שגיאה במחיקת מכלול');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingDept(null);
    setForm({ name: '', manager_name: '', manager_phone: '', display_order: 0 });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען מכלולים...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Toaster position="top-center" />

      {/* Header */}
      <header className="bg-gradient-to-l from-gray-800 to-gray-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin')}
              className="text-white/70 hover:text-white transition-colors"
            >
              ← חזור
            </button>
            <h1 className="text-xl font-bold">🏢 ניהול מכלולים</h1>
          </div>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingDept(null);
              setForm({ name: '', manager_name: '', manager_phone: '', display_order: departments.length + 1 });
            }}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
          >
            + הוסף מכלול
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-purple-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingDept ? `✏️ עריכת מכלול: ${editingDept.name}` : '➕ מכלול חדש'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">שם המכלול *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  placeholder="למשל: מכלול בטחון"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">שם מנהל מכלול</label>
                  <input
                    type="text"
                    value={form.manager_name}
                    onChange={(e) => setForm({ ...form, manager_name: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                    placeholder="שם מלא"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">טלפון מנהל</label>
                  <input
                    type="text"
                    value={form.manager_phone}
                    onChange={(e) => setForm({ ...form, manager_phone: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                    placeholder="050-1234567"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">סדר תצוגה</label>
                <input
                  type="number"
                  value={form.display_order}
                  onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })}
                  className="w-32 px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
                >
                  {editingDept ? '✅ עדכן' : '➕ הוסף'}
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition-colors"
                >
                  ✕ ביטול
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Departments List */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-4 bg-gradient-to-l from-purple-50 to-blue-50 border-b-2 border-purple-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">מכלולים ({departments.length})</h2>
            </div>
          </div>

          {departments.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <div className="text-5xl mb-4">🏢</div>
              <p className="text-lg font-semibold">אין מכלולים עדיין</p>
              <p className="text-sm mt-1">לחץ על "הוסף מכלול" כדי להתחיל</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {departments.map((dept) => (
                <div key={dept.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-gray-900">{dept.name}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          #{dept.display_order}
                        </span>
                        {dept.contacts && dept.contacts.length > 0 && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            👥 {dept.contacts.length} אנשי קשר
                          </span>
                        )}
                      </div>
                      {dept.manager_name && (
                        <p className="text-sm text-gray-600 mt-1">
                          👤 {dept.manager_name}
                          {dept.manager_phone && (
                            <a href={`tel:${dept.manager_phone}`} className="mr-2 text-blue-600 hover:underline">
                              📞 {dept.manager_phone}
                            </a>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(dept)}
                        className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-semibold transition-colors"
                      >
                        ✏️ ערוך
                      </button>
                      <button
                        onClick={() => handleDelete(dept)}
                        className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-semibold transition-colors"
                      >
                        🗑️ מחק
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
