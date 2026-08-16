'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// Convert a duty row to a readable cell label (round-trips through the parser)
function dutyToLabel(duty) {
  if (duty.notes?.includes('[לן]')) return 'לן';
  if (duty.start_hour === duty.end_hour) return '24';
  if (duty.start_hour === 8 && duty.end_hour === 16) return 'בוקר';
  if (duty.start_hour === 16 && duty.end_hour === 0) return 'ערב';
  if (duty.start_hour === 0 && duty.end_hour === 8) return 'לילה';
  return `${duty.start_hour}-${duty.end_hour}`;
}

// Parse a single token from an Excel cell into { start_hour, end_hour, notes }
function parseShiftToken(token) {
  const value = token.trim().toLowerCase();
  if (!value || value === '-' || value.includes('קבוע')) return null;

  if (value.includes('לן')) return { start_hour: 20, end_hour: 8, notes: '[לן]' };
  if (value.includes('בוקר')) return { start_hour: 8, end_hour: 16, notes: '' };
  if (value.includes('ערב')) return { start_hour: 16, end_hour: 0, notes: '' };
  if (value.includes('לילה')) return { start_hour: 0, end_hour: 8, notes: '' };
  if (value === '24' || value === '24h' || value.includes('יממה')) {
    return { start_hour: 8, end_hour: 8, notes: '' };
  }

  // Time range: "8-16", "08:00-16:00", "20:00 - 08:00"
  const match = value.match(/^(\d{1,2})(?::\d{2})?\s*[-–]\s*(\d{1,2})(?::\d{2})?$/);
  if (match) {
    let start = parseInt(match[1], 10);
    let end = parseInt(match[2], 10);
    if (start === 24) start = 0;
    if (end === 24) end = 0;
    if (start >= 0 && start <= 23 && end >= 0 && end <= 23) {
      return { start_hour: start, end_hour: end, notes: '' };
    }
  }

  return undefined; // unrecognized (as opposed to null = intentionally empty)
}

export default function DutyRosterExcelImporter({
  departmentId,
  currentWeekStart,
  weekDates,
  contacts,
  dutyRoster,
  onImportComplete,
}) {
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  const formatDateForDB = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // ---------- Template download ----------
  const downloadTemplate = () => {
    const headers = [
      'שם הכונן',
      ...DAYS.map((d, i) => `${d} ${weekDates[i].getDate()}/${weekDates[i].getMonth() + 1}`),
    ];
    const instructions = [
      '📝 אפשרויות למילוי תא: בוקר / ערב / לילה / לן / 24 / טווח שעות כמו 8-16. כמה משמרות באותו יום — להפריד בפסיק. תא ריק = אין כוננות.',
      '', '', '', '', '', '', '',
    ];

    // Prefill with this week's duties (permanent 24/7 duties are managed separately)
    const weekDuties = dutyRoster.filter(d => d.week_start_date);
    const rows = contacts.map(contact => {
      const row = [contact.full_name];
      for (let day = 0; day < 7; day++) {
        const duties = weekDuties.filter(d => d.contact_id === contact.id && d.day_of_week === day);
        row.push(duties.map(dutyToLabel).join(', '));
      }
      return row;
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, instructions, ...rows]);
    ws['!cols'] = [{ wch: 22 }, ...Array(7).fill({ wch: 14 })];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'כוננויות');
    const ws2 = weekDates[0];
    XLSX.writeFile(wb, `כוננויות_${ws2.getDate()}_${ws2.getMonth() + 1}_${ws2.getFullYear()}.xlsx`);
  };

  // ---------- Import ----------
  const parseExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(firstSheet, { header: 1 }));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('שגיאה בקריאת הקובץ'));
      reader.readAsArrayBuffer(file);
    });
  };

  const parseRoster = (rawData) => {
    const weekStartStr = formatDateForDB(currentWeekStart);
    const entries = [];
    const unknownNames = [];
    const badTokens = [];

    for (let rowIndex = 1; rowIndex < rawData.length; rowIndex++) {
      const row = rawData[rowIndex];
      if (!row || row.length === 0) continue;

      const name = row[0]?.toString().trim();
      if (!name || name.length < 2 || name.startsWith('📝')) continue;

      const contact = contacts.find(c =>
        c.full_name === name || c.full_name?.includes(name) || name.includes(c.full_name)
      );
      if (!contact) {
        unknownNames.push(name);
        continue;
      }

      for (let day = 0; day < 7; day++) {
        const cell = row[day + 1]?.toString().trim();
        if (!cell) continue;

        for (const token of cell.split(/[,;\n]+/)) {
          const shift = parseShiftToken(token);
          if (shift === undefined) {
            badTokens.push(`${name} (${DAYS[day]}): "${token.trim()}"`);
          } else if (shift) {
            entries.push({
              department_id: departmentId,
              contact_id: contact.id,
              contact_name: contact.full_name,
              day_of_week: day,
              start_hour: shift.start_hour,
              end_hour: shift.end_hour,
              notes: shift.notes,
              week_start_date: weekStartStr,
            });
          }
        }
      }
    }

    return { entries, unknownNames, badTokens };
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setImporting(true);
      const rawData = await parseExcelFile(file);
      const result = parseRoster(rawData);

      if (result.entries.length === 0 && result.unknownNames.length === 0 && result.badTokens.length === 0) {
        toast.error('לא נמצאו משמרות בקובץ. הורד את התבנית ומלא לפיה.');
        return;
      }

      setPreview({ ...result, fileName: file.name });
    } catch (error) {
      console.error('Error parsing Excel:', error);
      toast.error('שגיאה בקריאת הקובץ: ' + error.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmImport = async () => {
    if (!preview) return;

    try {
      setImporting(true);
      const weekStartStr = formatDateForDB(currentWeekStart);

      // Replace this week's duties (permanent duties are untouched)
      const deleteRes = await fetch(
        `/api/duty-roster?bulk=true&department_id=${departmentId}&week_start_date=${weekStartStr}`,
        { method: 'DELETE' }
      );
      const deleteResult = await deleteRes.json();
      if (!deleteResult.success) {
        toast.error('שגיאה במחיקת הכוננויות הקיימות: ' + deleteResult.error);
        return;
      }

      const insertRes = await fetch('/api/duty-roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: preview.entries.map(({ contact_name, ...entry }) => entry),
        }),
      });
      const result = await insertRes.json();

      if (result.success) {
        toast.success(`✅ ${preview.entries.length} כוננויות יובאו בהצלחה!`);
        setPreview(null);
        if (onImportComplete) onImportComplete();
      } else {
        toast.error('שגיאה בייבוא: ' + result.error);
      }
    } catch (error) {
      toast.error('שגיאה בייבוא: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={downloadTemplate}
        className="px-3 py-2 bg-blue-600 text-white rounded-lg font-semibold text-xs sm:text-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
      >
        📥 הורד תבנית Excel
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileSelect}
        className="hidden"
        id="duty-roster-excel-upload"
      />
      <label
        htmlFor="duty-roster-excel-upload"
        className={`px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm cursor-pointer transition-colors ${
          importing
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
        }`}
      >
        {importing ? '⏳ מייבא...' : '📤 ייבא מ-Excel'}
      </label>

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-l from-green-600 to-purple-600 text-white p-4">
              <h3 className="text-lg font-bold">תצוגה מקדימה - {preview.fileName}</h3>
              <p className="text-sm opacity-90">נמצאו {preview.entries.length} כוננויות לייבוא</p>
              <p className="text-xs opacity-90 mt-1 bg-white/20 rounded px-2 py-1">
                ⚠️ הייבוא יחליף את כל הכוננויות של השבוע המוצג (כוננים קבועים 24/7 לא יושפעו)
              </p>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {preview.unknownNames.length > 0 && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <strong>שמות שלא נמצאו באנשי הקשר (ידולגו):</strong> {preview.unknownNames.join(', ')}
                  <div className="mt-1 text-red-600">💡 הוסף אותם קודם בלשונית אנשי קשר, או תקן את השם בקובץ.</div>
                </div>
              )}
              {preview.badTokens.length > 0 && (
                <div className="mb-3 p-2 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700">
                  <strong>ערכים לא מזוהים (ידולגו):</strong>
                  <ul className="mt-1 list-disc pr-4">
                    {preview.badTokens.slice(0, 10).map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                {preview.entries.slice(0, 25).map((entry, idx) => {
                  const isSleep = entry.notes?.includes('[לן]');
                  const label = isSleep
                    ? '🛏️ לן'
                    : entry.start_hour === entry.end_hour
                      ? '🔄 24 שעות'
                      : `${String(entry.start_hour).padStart(2, '0')}:00-${String(entry.end_hour).padStart(2, '0')}:00`;
                  return (
                    <div key={idx} className="flex items-center justify-between p-2 rounded text-sm bg-gray-50">
                      <span className="font-semibold">{entry.contact_name}</span>
                      <span className="text-gray-600">יום {DAYS[entry.day_of_week]}</span>
                      <span className="text-purple-600 font-semibold">{label}</span>
                    </div>
                  );
                })}
                {preview.entries.length > 25 && (
                  <p className="text-center text-gray-500 text-xs py-2">
                    ועוד {preview.entries.length - 25} כוננויות...
                  </p>
                )}
              </div>
            </div>

            <div className="border-t p-4 flex gap-3 justify-end bg-gray-50">
              <button
                onClick={() => setPreview(null)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold text-sm hover:bg-gray-300"
              >
                ביטול
              </button>
              <button
                onClick={confirmImport}
                disabled={importing || preview.entries.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 active:bg-green-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {importing ? '⏳ מייבא...' : '✅ אשר ייבוא'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
