'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

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

export default function GarbageScheduleInline() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [filterDay, setFilterDay] = useState('all');
  const [searchStreet, setSearchStreet] = useState('');
  const [form, setForm] = useState({
    street_name: '',
    collection_day: 'monday',
    collection_day_hebrew: 'שני',
    takeout_day_hebrew: 'ראשון',
    zone: 'יהוד',
    notes: ''
  });

  useEffect(() => { fetchSchedule(); }, []);

  const fetchSchedule = async () => {
    try {
      const res = await fetch('/api/garbage-collection');
      const data = await res.json();
      if (data.success) setSchedule(data.schedule || []);
    } catch (error) {
      console.error('Error:', error);
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
    if (!form.street_name.trim()) { toast.error('נא להזין שם רחוב'); return; }
    try {
      const method = editingEntry ? 'PUT' : 'POST';
      const body = editingEntry ? { id: editingEntry.id, ...form } : form;
      const res = await fetch('/api/garbage-collection', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editingEntry ? 'עודכן!' : 'נוסף!');
        setShowForm(false);
        setEditingEntry(null);
        setForm({ street_name: '', collection_day: 'monday', collection_day_hebrew: 'שני', takeout_day_hebrew: 'ראשון', zone: 'יהוד', notes: '' });
        fetchSchedule();
      } else throw new Error(data.error);
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
    if (!confirm(`למחוק "${entry.street_name}"?`)) return;
    try {
      const res = await fetch(`/api/garbage-collection?id=${entry.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { toast.success('נמחק!'); fetchSchedule(); }
    } catch { toast.error('שגיאה'); }
  };

  const filtered = schedule.filter(entry => {
    if (entry.street_name === 'אנשי קשר תברואה') return false;
    if (filterDay !== 'all' && entry.collection_day !== filterDay) return false;
    if (searchStreet && !entry.street_name.includes(searchStreet)) return false;
    return true;
  });

  if (loading) return <div className="text-center py-4 text-gray-500">טוען לוח גזם...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">🗑️ לוח פינוי גזם</h2>
        <button
          onClick={() => { setShowForm(!showForm); setEditingEntry(null); }}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold"
        >
          + הוסף רחוב
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              value={form.street_name}
              onChange={(e) => setForm({ ...form, street_name: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="שם רחוב *"
            />
            <select
              value={form.collection_day}
              onChange={(e) => handleDayChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {DAYS.map(d => <option key={d.value} value={d.value}>פינוי: יום {d.label}</option>)}
            </select>
            <select
              value={form.zone}
              onChange={(e) => setForm({ ...form, zone: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="יהוד">יהוד</option>
              <option value="מונוסון">מונוסון</option>
            </select>
          </div>
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="הערות (אופציונלי)"
            />
            <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold">
              {editingEntry ? '✅ עדכן' : '➕ הוסף'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingEntry(null); }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm">
              ביטול
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">יום הוצאה: {form.takeout_day_hebrew} (יום לפני הפינוי)</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={searchStreet}
          onChange={(e) => setSearchStreet(e.target.value)}
          placeholder="🔍 חפש רחוב..."
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-44"
        />
        <select
          value={filterDay}
          onChange={(e) => setFilterDay(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">כל הימים</option>
          {DAYS.map(d => <option key={d.value} value={d.value}>יום {d.label}</option>)}
        </select>
        <span className="text-xs text-gray-400 mr-auto">{filtered.length} רחובות</span>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-right font-medium text-gray-600">רחוב</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">יום פינוי</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">יום הוצאה</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">אזור</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.sort((a, b) => a.street_name.localeCompare(b.street_name, 'he')).map(entry => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{entry.street_name}</td>
                <td className="px-3 py-2">{entry.collection_day_hebrew}</td>
                <td className="px-3 py-2 text-gray-500">{entry.takeout_day_hebrew || '-'}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${entry.zone === 'מונוסון' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {entry.zone}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => handleEdit(entry)} className="text-blue-600 hover:text-blue-800 ml-2">✏️</button>
                  <button onClick={() => handleDelete(entry)} className="text-red-600 hover:text-red-800">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3">📞 אנשי קשר תברואה: שמשון 050-6917771 | יוסי מססה 050-8440888</p>
    </div>
  );
}
