'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

const DAYS = [
  { value: 'sunday', label: 'ראשון' },
  { value: 'monday', label: 'שני' },
  { value: 'tuesday', label: 'שלישי' },
  { value: 'wednesday', label: 'רביעי' },
  { value: 'thursday', label: 'חמישי' },
  { value: 'friday', label: 'שישי' },
];

const TAKEOUT_MAP = {
  'sunday': 'שבת',
  'monday': 'ראשון',
  'tuesday': 'שני',
  'wednesday': 'שלישי',
  'thursday': 'רביעי',
  'friday': 'חמישי',
};

export default function GarbageSchedulePage() {
  const router = useRouter();
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [filterDay, setFilterDay] = useState('all');
  const [filterZone, setFilterZone] = useState('all');
  const [searchStreet, setSearchStreet] = useState('');
  const [form, setForm] = useState({
    street_name: '',
    collection_day: 'monday',
    collection_day_hebrew: 'שני',
    takeout_day_hebrew: 'ראשון',
    zone: 'יהוד',
    notes: ''
  });

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      const res = await fetch('/api/garbage-collection');
      const data = await res.json();
      if (data.success) {
        setSchedule(data.schedule || []);
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
      toast.error('שגיאה בטעינת לוח זמנים');
    } finally {
      setLoading(false);
    }
  };

  const handleDayChange = (dayValue) => {
    const day = DAYS.find(d => d.value === dayValue);
    setForm({
      ...form,
      collection_day: dayValue,
      collection_day_hebrew: day?.label || '',
      takeout_day_hebrew: TAKEOUT_MAP[dayValue] || ''
    });
  };

  const handleSave = async () => {
    if (!form.street_name.trim()) {
      toast.error('נא להזין שם רחוב');
      return;
    }

    try {
      if (editingEntry) {
        const res = await fetch('/api/garbage-collection', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingEntry.id, ...form })
        });
        const data = await res.json();
        if (data.success) {
          toast.success('עודכן בהצלחה!');
        } else {
          throw new Error(data.error);
        }
      } else {
        const res = await fetch('/api/garbage-collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        });
        const data = await res.json();
        if (data.success) {
          toast.success('נוסף בהצלחה!');
        } else {
          throw new Error(data.error);
        }
      }

      setShowForm(false);
      setEditingEntry(null);
      setForm({ street_name: '', collection_day: 'monday', collection_day_hebrew: 'שני', takeout_day_hebrew: 'ראשון', zone: 'יהוד', notes: '' });
      fetchSchedule();
    } catch (error) {
      toast.error('שגיאה: ' + error.message);
    }
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setForm({
      street_name: entry.street_name || '',
      collection_day: entry.collection_day || 'monday',
      collection_day_hebrew: entry.collection_day_hebrew || '',
      takeout_day_hebrew: entry.takeout_day_hebrew || '',
      zone: entry.zone || 'יהוד',
      notes: entry.notes || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (entry) => {
    if (!confirm(`למחוק את "${entry.street_name}" מהלוח?`)) return;

    try {
      const res = await fetch(`/api/garbage-collection?id=${entry.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('נמחק!');
        fetchSchedule();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast.error('שגיאה במחיקה');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingEntry(null);
    setForm({ street_name: '', collection_day: 'monday', collection_day_hebrew: 'שני', takeout_day_hebrew: 'ראשון', zone: 'יהוד', notes: '' });
  };

  // Filter entries
  const filtered = schedule.filter(entry => {
    if (entry.street_name === 'אנשי קשר תברואה') return false;
    if (filterDay !== 'all' && entry.collection_day !== filterDay) return false;
    if (filterZone !== 'all' && entry.zone !== filterZone) return false;
    if (searchStreet && !entry.street_name.includes(searchStreet)) return false;
    return true;
  });

  // Group by day
  const groupedByDay = {};
  DAYS.forEach(d => { groupedByDay[d.value] = []; });
  filtered.forEach(entry => {
    if (groupedByDay[entry.collection_day]) {
      groupedByDay[entry.collection_day].push(entry);
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען לוח גזם...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Toaster position="top-center" />

      {/* Header */}
      <header className="bg-gradient-to-l from-green-700 to-green-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin')}
              className="text-white/70 hover:text-white transition-colors"
            >
              ← חזור
            </button>
            <h1 className="text-xl font-bold">🗑️ ניהול לוח פינוי גזם</h1>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingEntry(null); }}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition-colors border border-white/30"
          >
            + הוסף רחוב
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-bold text-green-700">{schedule.length}</div>
            <div className="text-sm text-gray-500">סה"כ רשומות</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-bold text-blue-700">{schedule.filter(s => s.zone === 'יהוד').length}</div>
            <div className="text-sm text-gray-500">רחובות יהוד</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-bold text-purple-700">{schedule.filter(s => s.zone === 'מונוסון').length}</div>
            <div className="text-sm text-gray-500">מונוסון</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-bold text-gray-700">5</div>
            <div className="text-sm text-gray-500">ימי פינוי בשבוע</div>
          </div>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-green-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingEntry ? `✏️ עריכה: ${editingEntry.street_name}` : '➕ רחוב חדש'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">שם רחוב *</label>
                <input
                  type="text"
                  value={form.street_name}
                  onChange={(e) => setForm({ ...form, street_name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                  placeholder="למשל: הרצל"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">יום פינוי *</label>
                <select
                  value={form.collection_day}
                  onChange={(e) => handleDayChange(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                >
                  {DAYS.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">יום הוצאה</label>
                <input
                  type="text"
                  value={form.takeout_day_hebrew}
                  readOnly
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                />
                <p className="text-xs text-gray-400 mt-1">מחושב אוטומטית (יום לפני הפינוי)</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">אזור</label>
                <select
                  value={form.zone}
                  onChange={(e) => setForm({ ...form, zone: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                >
                  <option value="יהוד">יהוד</option>
                  <option value="מונוסון">מונוסון</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">הערות</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                  placeholder="הערות נוספות (אופציונלי)"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
              >
                {editingEntry ? '✅ עדכן' : '➕ הוסף'}
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition-colors"
              >
                ✕ ביטול
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 border flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={searchStreet}
            onChange={(e) => setSearchStreet(e.target.value)}
            placeholder="🔍 חפש רחוב..."
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-48"
          />
          <select
            value={filterDay}
            onChange={(e) => setFilterDay(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">כל הימים</option>
            {DAYS.map(d => (
              <option key={d.value} value={d.value}>יום {d.label}</option>
            ))}
          </select>
          <select
            value={filterZone}
            onChange={(e) => setFilterZone(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">כל האזורים</option>
            <option value="יהוד">יהוד</option>
            <option value="מונוסון">מונוסון</option>
          </select>
          <span className="text-sm text-gray-500 mr-auto">{filtered.length} תוצאות</span>
        </div>

        {/* Schedule Table */}
        {filterDay === 'all' ? (
          // Show grouped by day
          DAYS.map(day => {
            const dayEntries = groupedByDay[day.value];
            if (dayEntries.length === 0) return null;
            return (
              <div key={day.value} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="px-4 py-3 bg-green-50 border-b flex items-center justify-between">
                  <h3 className="font-bold text-green-800">
                    יום {day.label} ({dayEntries.length} רחובות)
                  </h3>
                  <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                    הוצאה: יום {TAKEOUT_MAP[day.value]}
                  </span>
                </div>
                <div className="divide-y divide-gray-50">
                  {dayEntries.sort((a, b) => a.street_name.localeCompare(b.street_name, 'he')).map(entry => (
                    <div key={entry.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-800">{entry.street_name}</span>
                        {entry.zone === 'מונוסון' && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">מונוסון</span>
                        )}
                        {entry.notes && (
                          <span className="text-xs text-gray-400">{entry.notes}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(entry)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(entry)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          // Single day view
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="divide-y divide-gray-50">
              {filtered.sort((a, b) => a.street_name.localeCompare(b.street_name, 'he')).map(entry => (
                <div key={entry.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-800">{entry.street_name}</span>
                    {entry.zone === 'מונוסון' && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">מונוסון</span>
                    )}
                    {entry.notes && (
                      <span className="text-xs text-gray-400">{entry.notes}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(entry)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(entry)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <h4 className="font-bold text-yellow-800 mb-2">📋 מידע חשוב</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• <strong>יום ההוצאה</strong> = יום לפני יום הפינוי (התושב צריך להוציא בערב שלפני)</li>
            <li>• <strong>מונוסון</strong> = פינוי בימי ראשון ושישי</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
