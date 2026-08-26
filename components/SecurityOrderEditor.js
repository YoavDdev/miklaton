'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

/**
 * עריכת סידור הביטחון של היום מקונסולת האחמ"ש (בקשת יואב 26.08) -
 * אותן פעולות שיש למסך המוקד (YOA-43), על אותם ראוטים ואותו תיעוד
 * שינויים: שינוי שעות, החלפה, הסרה, שחזור והוספת משמרת.
 */
const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function SecurityOrderEditor({ userName }) {
  const [deptId, setDeptId] = useState('');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTimes, setEditTimes] = useState(null); // {entry_id, start, end}
  const [addOpen, setAddOpen] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [addForm, setAddForm] = useState({ staff_id: '', staff_name: '', role: 'פיקוח', start_time: '', end_time: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (id) => {
    const dept = id || deptId;
    if (!dept) return;
    try {
      const res = await fetch(`/api/security-daily-order?department_id=${dept}&order_date=${todayStr()}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setEntries(data.entries || []);
    } catch (error) {
      console.error('Error loading security order:', error);
    }
  }, [deptId]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/departments', { credentials: 'include' });
        const list = (await res.json()).data || [];
        const security = list.find((d) => (d.name || '').includes('טחון'));
        if (security) {
          setDeptId(security.id);
          await load(security.id);
        }
      } catch (error) {
        console.error('Error resolving security department:', error);
      } finally {
        setLoading(false);
      }
    })();
    // load יציב מספיק - הרצה חד-פעמית בעליית הרכיב
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = async (entry, change_type, extra = {}) => {
    setSaving(true);
    try {
      const res = await fetch('/api/security-daily-order/entry', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ entry_id: entry.id, change_type, changed_by: userName || 'אחמ"ש', ...extra }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'העדכון נכשל');
      await load();
      return true;
    } catch (error) {
      toast.error('שגיאה: ' + error.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveTimes = async () => {
    const ok = await patch({ id: editTimes.entry_id }, 'time_change', {
      new_start_time: editTimes.start,
      new_end_time: editTimes.end,
    });
    if (ok) { setEditTimes(null); toast.success('השעות עודכנו'); }
  };

  const replace = async (entry) => {
    const name = window.prompt(`מי מחליף/ה את ${entry.staff_name}?`);
    if (!name?.trim()) return;
    if (await patch(entry, 'replaced', { new_staff_name: name.trim() })) toast.success('ההחלפה נרשמה');
  };

  const remove = async (entry) => {
    if (!window.confirm(`להסיר את המשמרת של ${entry.staff_name}? (אפשר לשחזר)`)) return;
    if (await patch(entry, 'removed')) toast.success('המשמרת הוסרה');
  };

  const openAdd = async () => {
    setAddOpen(true);
    try {
      const res = await fetch(`/api/security-staff?department_id=${deptId}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setStaffList(data.data || []);
    } catch { /* בחירה חופשית עדיין עובדת */ }
  };

  const submitAdd = async () => {
    const staff = staffList.find((s) => s.id === addForm.staff_id);
    const staffName = staff?.name || addForm.staff_name.trim();
    if (!staffName || !addForm.start_time || !addForm.end_time) {
      toast.error('שם, שעת התחלה ושעת סיום נדרשים');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/security-daily-order/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          department_id: deptId,
          order_date: todayStr(),
          staff_id: addForm.staff_id || null,
          staff_name: staffName,
          role_title: addForm.role === 'שיטור' ? 'שיטור עירוני' : 'פיקוח עירוני',
          start_time: addForm.start_time,
          end_time: addForm.end_time,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'ההוספה נכשלה');
      setAddOpen(false);
      setAddForm({ staff_id: '', staff_name: '', role: 'פיקוח', start_time: '', end_time: '' });
      await load();
      toast.success('המשמרת נוספה - תופיע גם על מסך המוקד');
    } catch (error) {
      toast.error('שגיאה: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-500">טוען את סידור הביטחון...</p>;
  if (!deptId) return <p className="text-sm text-gray-500">מכלול הביטחון לא נמצא.</p>;

  return (
    <div>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-500 mb-3">אין משמרות בסידור של היום.</p>
      ) : (
        <ul className="divide-y divide-gray-100 mb-3">
          {entries.map((e) => (
            <li key={e.id} className={`py-2 flex items-center gap-3 flex-wrap text-sm ${e.is_removed ? 'opacity-50' : ''}`}>
              <span className={`font-semibold text-gray-900 ${e.is_removed ? 'line-through' : ''}`}>{e.staff_name}</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{e.role_title}</span>
              {editTimes?.entry_id === e.id ? (
                <span className="flex items-center gap-1">
                  <input type="time" value={editTimes.start} onChange={(ev) => setEditTimes((p) => ({ ...p, start: ev.target.value }))}
                    className="border border-gray-300 rounded px-1 py-0.5 text-gray-900" />
                  –
                  <input type="time" value={editTimes.end} onChange={(ev) => setEditTimes((p) => ({ ...p, end: ev.target.value }))}
                    className="border border-gray-300 rounded px-1 py-0.5 text-gray-900" />
                  <button onClick={saveTimes} disabled={saving} className="px-2 py-0.5 rounded bg-emerald-600 text-white text-xs font-bold">💾</button>
                  <button onClick={() => setEditTimes(null)} className="px-2 py-0.5 rounded bg-gray-200 text-xs">ביטול</button>
                </span>
              ) : (
                <span className="text-gray-600">{e.start_time?.slice(0, 5)}–{e.end_time?.slice(0, 5)}</span>
              )}
              {e.vehicle && <span className="text-xs text-gray-500">🚗 {e.vehicle}</span>}
              {e.is_modified && e.modification_note && <span className="text-xs text-orange-600">({e.modification_note})</span>}
              <span className="mr-auto flex gap-1">
                {e.is_removed ? (
                  <button onClick={() => patch(e, 'restored').then((ok) => ok && toast.success('המשמרת שוחזרה'))}
                    className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold hover:bg-blue-200">↩️ שחזר</button>
                ) : (
                  <>
                    <button onClick={() => setEditTimes({ entry_id: e.id, start: e.start_time?.slice(0, 5), end: e.end_time?.slice(0, 5) })}
                      className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200">⏱ שעות</button>
                    <button onClick={() => replace(e)}
                      className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200">🔄 החלפה</button>
                    <button onClick={() => remove(e)}
                      className="px-2 py-0.5 rounded bg-gray-100 text-red-700 text-xs font-bold hover:bg-red-100">✕ הסרה</button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {addOpen ? (
        <div className="border-2 border-blue-200 bg-blue-50/40 rounded-lg p-3 flex items-end gap-2 flex-wrap">
          <label className="text-xs text-gray-700">
            עובד/ת
            <select value={addForm.staff_id} onChange={(e) => setAddForm((p) => ({ ...p, staff_id: e.target.value }))}
              className="block border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 min-w-[140px]">
              <option value="">— שם חופשי —</option>
              {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          {!addForm.staff_id && (
            <label className="text-xs text-gray-700">
              שם
              <input value={addForm.staff_name} onChange={(e) => setAddForm((p) => ({ ...p, staff_name: e.target.value }))}
                className="block border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 w-32" />
            </label>
          )}
          <label className="text-xs text-gray-700">
            תפקיד
            <select value={addForm.role} onChange={(e) => setAddForm((p) => ({ ...p, role: e.target.value }))}
              className="block border border-gray-300 rounded px-2 py-1 text-sm text-gray-900">
              <option value="פיקוח">פיקוח עירוני</option>
              <option value="שיטור">שיטור עירוני</option>
            </select>
          </label>
          <label className="text-xs text-gray-700">
            מ-
            <input type="time" value={addForm.start_time} onChange={(e) => setAddForm((p) => ({ ...p, start_time: e.target.value }))}
              className="block border border-gray-300 rounded px-2 py-1 text-sm text-gray-900" />
          </label>
          <label className="text-xs text-gray-700">
            עד
            <input type="time" value={addForm.end_time} onChange={(e) => setAddForm((p) => ({ ...p, end_time: e.target.value }))}
              className="block border border-gray-300 rounded px-2 py-1 text-sm text-gray-900" />
          </label>
          <button onClick={submitAdd} disabled={saving}
            className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:bg-gray-300">💾 הוסף</button>
          <button onClick={() => setAddOpen(false)} className="px-3 py-1.5 rounded bg-gray-200 text-gray-700 text-sm font-bold">ביטול</button>
        </div>
      ) : (
        <button onClick={openAdd} className="text-sm text-emerald-700 font-semibold hover:underline">➕ הוספת משמרת להיום</button>
      )}
    </div>
  );
}
