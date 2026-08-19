'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
// הפרסר חולץ ל-lib כדי שירוץ בבדיקות מול הקובץ האמיתי (YOA-35)
import {
  DAY_NAMES,
  normalizeTime,
  analyzeSheet,
  parseScheduleSheet,
  sameCalendarDate,
} from '@/lib/schedule-excel-parser';

/**
 * uploader (אופציונלי): פונקציה שמבצעת את ההעלאה בפועל במקום הקריאות
 * המאומתות. משמשת את דף ההעלאה הציבורי, שאין לו session ולכן פונה לראוט
 * החתום. בלעדיה ההתנהגות זהה לקודם.
 */
export default function ExcelImporter({ departmentId, currentWeekStart, staff, shifts, onImportComplete, uploader, checkExistingWeek }) {
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [workbookData, setWorkbookData] = useState(null); // { sheets: {name: rows}, sheetInfos: [...] }
  const fileInputRef = useRef(null);

  const formatDateForDB = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // השבוע שאליו הייבוא באמת ייכנס - התאריך שבגיליון קובע, לא השבוע המוצג
  const targetWeekStr = (p) =>
    formatDateForDB(
      p.weekSunday
        ? new Date(p.weekSunday.getUTCFullYear(), p.weekSunday.getUTCMonth(), p.weekSunday.getUTCDate())
        : currentWeekStart
    );

  // מה כבר קיים בשבוע היעד - כדי להזהיר לפני דריסה. ההעלאה מחדש היא
  // הזרימה הלגיטימית של המנהל, אז לא חוסמים - רק מוודאים שהוא יודע
  // מה הוא מחליף וממתי (YOA-36).
  const attachExistingWeek = (previewData) => {
    if (!checkExistingWeek || !previewData) return;
    const week = targetWeekStr(previewData);
    checkExistingWeek(week)
      .then((existingWeek) => {
        setPreview((p) => (p && targetWeekStr(p) === week ? { ...p, existingWeek } : p));
      })
      .catch(() => {});
  };

  const parseExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheets = {};
          for (const name of workbook.SheetNames) {
            sheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1 });
          }
          resolve(sheets);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('שגיאה בקריאת הקובץ'));
      reader.readAsArrayBuffer(file);
    });
  };

  const buildPreview = (sheets, selectedSheetName) => {
    const sheetInfos = Object.entries(sheets)
      .map(([name, rows]) => ({ name, ...analyzeSheet(rows) }))
      .filter(info => info.isSchedule);

    if (sheetInfos.length === 0) {
      toast.error('לא נמצא בקובץ גיליון סידור עבודה (עם עמודות "משמרת" ו"מחלקה")');
      return null;
    }

    // Auto-pick the sheet whose date row matches the displayed week
    let selected = selectedSheetName
      ? sheetInfos.find(s => s.name === selectedSheetName)
      : sheetInfos.find(s => s.weekSunday && sameCalendarDate(s.weekSunday, currentWeekStart));
    const autoMatched = !selectedSheetName && !!selected;
    if (!selected) selected = sheetInfos[sheetInfos.length - 1];

    const parsed = parseScheduleSheet(sheets[selected.name], staff, shifts);
    return {
      ...parsed,
      sheetName: selected.name,
      sheetInfos,
      // השבוע כפי שהוא כתוב בגיליון. הייבוא נכנס לשבוע הזה ולא לשבוע שמוצג
      // על המסך - קודם הם יכלו להיות שונים, והסידור נחת בשבוע הלא נכון.
      weekSunday: selected.weekSunday || null,
      autoMatched: autoMatched || (selected.weekSunday && sameCalendarDate(selected.weekSunday, currentWeekStart)),
    };
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setImporting(true);
      const sheets = await parseExcelFile(file);
      const previewData = buildPreview(sheets, null);
      if (!previewData) return;

      if (previewData.entries.length === 0) {
        toast.error('לא נמצאו שיבוצים בגיליון. ודא שהתאים מכילים שמות עובדים.');
        return;
      }

      setWorkbookData(sheets);
      setPreview({ ...previewData, fileName: file.name });
      attachExistingWeek(previewData);
    } catch (error) {
      console.error('Error parsing Excel:', error);
      toast.error('שגיאה בקריאת הקובץ: ' + error.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const switchSheet = (sheetName) => {
    if (!workbookData) return;
    const previewData = buildPreview(workbookData, sheetName);
    if (previewData) {
      setPreview(p => ({ ...previewData, fileName: p.fileName }));
      attachExistingWeek(previewData);
    }
  };

  const confirmImport = async () => {
    if (!preview) return;

    // גיליון בלי שיבוצים (למשל שבוע שמנוהל רק בטבלת הסטטוס הימנית) -
    // אישור היה מוחק את השבוע ומכניס כלום. חוסמים לפני הנזק (YOA-35).
    if (preview.entries.length === 0) {
      toast.error('בגיליון הזה אין שיבוצים - הייבוא בוטל כדי לא למחוק את הסידור הקיים');
      return;
    }

    try {
      setImporting(true);
      // התאריך שבגיליון קובע, לא השבוע המוצג. serialToDate מחזיר תאריך
      // שחלקי ה-UTC שלו נושאים את היום הקלנדרי, ולכן ממירים לתאריך מקומי.
      const targetWeekStart = preview.weekSunday
        ? new Date(
            preview.weekSunday.getUTCFullYear(),
            preview.weekSunday.getUTCMonth(),
            preview.weekSunday.getUTCDate()
          )
        : currentWeekStart;
      const weekStartStr = formatDateForDB(targetWeekStart);

      if (uploader) {
        // מסלול הקישור החתום: העלאה אחת, בלי שלוש קריאות מאומתות
        const result = await uploader({
          week_start: weekStartStr,
          newShifts: preview.newShifts,
          entries: preview.entries,
        });
        toast.success(
          `✅ ${result.count} שיבוצים יובאו לשבוע ${weekStartStr} מהגיליון "${preview.sheetName}"` +
            (preview.existingWeek?.count > 0 ? ` (החליפו ${preview.existingWeek.count} קיימים)` : '')
        );
        setPreview(null);
        setWorkbookData(null);
        if (onImportComplete) onImportComplete(targetWeekStart);
        return;
      }

      // 1. Create missing shift definitions
      const shiftIdByKey = new Map();
      for (const sh of shifts) {
        shiftIdByKey.set(`${sh.category}|${normalizeTime(sh.start_time)}|${normalizeTime(sh.end_time)}`, sh.id);
      }
      for (const ns of preview.newShifts) {
        const res = await fetch('/api/security-shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            department_id: departmentId,
            category: ns.category,
            name: ns.name,
            start_time: ns.start,
            end_time: ns.end,
          }),
        });
        const result = await res.json();
        if (!result.success) throw new Error(`יצירת משמרת ${ns.start}-${ns.end} נכשלה: ${result.error}`);
        shiftIdByKey.set(ns.key, result.data.id);
      }

      // 2. Clear the displayed week
      const deleteRes = await fetch(
        `/api/security-schedule?department_id=${departmentId}&week_start=${weekStartStr}`,
        { method: 'DELETE' }
      );
      const deleteResult = await deleteRes.json();
      if (!deleteResult.success) throw new Error('מחיקת הסידור הקיים נכשלה: ' + deleteResult.error);

      // 3. Insert all entries
      const insertRes = await fetch('/api/security-schedule/bulk-insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department_id: departmentId,
          week_start: weekStartStr,
          entries: preview.entries.map(e => ({
            shift_id: shiftIdByKey.get(e.shift_key),
            staff_id: e.staff_id,
            staff_name: e.staff_id ? null : e.staff_name,
            day_of_week: e.day_of_week,
            is_backup: e.is_backup,
            actual_start: e.actual_start,
            actual_end: e.actual_end,
            notes: e.notes,
          })),
        }),
      });
      const result = await insertRes.json();
      if (!result.success) throw new Error(result.error);

      toast.success(
        `✅ ${result.count} שיבוצים יובאו לשבוע ${weekStartStr} מהגיליון "${preview.sheetName}"` +
          (preview.existingWeek?.count > 0 ? ` (החליפו ${preview.existingWeek.count} קיימים)` : '')
      );
      setPreview(null);
      setWorkbookData(null);
      // מעבירים את השבוע שאליו יובא, כדי שהמסך יקפוץ אליו במקום להישאר על
      // שבוע אחר ולהיראות כאילו הייבוא לא עשה כלום.
      if (onImportComplete) onImportComplete(targetWeekStart);
    } catch (error) {
      toast.error('שגיאה בייבוא: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Upload Button */}
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
          id="excel-upload"
        />
        <label
          htmlFor="excel-upload"
          className={`px-4 py-2 rounded-lg font-semibold text-sm cursor-pointer transition-colors ${
            importing
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
          }`}
        >
          {importing ? '⏳ מייבא...' : '📤 ייבא מ-Excel'}
        </label>
        <span className="text-xs text-gray-500">תומך בקובץ הסידור הקיים (גיליון לכל שבוע)</span>
      </div>

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-l from-green-600 to-blue-600 text-white p-4">
              <h3 className="text-lg font-bold">תצוגה מקדימה - {preview.fileName}</h3>
              <p className="text-sm opacity-90">נמצאו {preview.entries.length} שיבוצים לייבוא</p>
            </div>

            {/* Sheet picker */}
            <div className="p-3 bg-blue-50 border-b border-blue-200 flex items-center gap-2 flex-wrap">
              <label className="text-xs font-bold text-blue-900">גיליון (שבוע):</label>
              <select
                value={preview.sheetName}
                onChange={(e) => switchSheet(e.target.value)}
                className="text-xs border border-blue-300 rounded px-2 py-1 bg-white"
              >
                {preview.sheetInfos.map(info => (
                  <option key={info.name} value={info.name}>{info.name}</option>
                ))}
              </select>
              {preview.weekSunday ? (
                <span className="text-[11px] text-green-700 font-semibold">
                  ✓ הייבוא ייכנס לשבוע {formatDateForDB(new Date(
                    preview.weekSunday.getUTCFullYear(),
                    preview.weekSunday.getUTCMonth(),
                    preview.weekSunday.getUTCDate()
                  ))} לפי התאריך שבגיליון
                </span>
              ) : (
                <span className="text-[11px] text-orange-700 font-semibold">⚠️ לא נמצא תאריך בגיליון - הייבוא ייכנס לשבוע המוצג כרגע</span>
              )}
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {preview.newShifts.length > 0 && (
                <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                  <strong>משמרות חדשות שייווצרו אוטומטית:</strong>{' '}
                  {preview.newShifts.map(s => `${s.category} ${s.start}-${s.end}`).join(', ')}
                </div>
              )}
              {preview.manualNames.length > 0 && (
                <div className="mb-3 p-2 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
                  <strong>שמות שלא נמצאו ברשימת העובדים (ייובאו כשם ידני):</strong>{' '}
                  {preview.manualNames.join(', ')}
                </div>
              )}
              {preview.skippedTokens.length > 0 && (
                <div className="mb-3 p-2 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700">
                  <strong>תאים שדולגו:</strong>
                  <ul className="mt-1 list-disc pr-4">
                    {preview.skippedTokens.slice(0, 8).map((t, i) => <li key={i}>{t}</li>)}
                    {preview.skippedTokens.length > 8 && <li>ועוד {preview.skippedTokens.length - 8}...</li>}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                {preview.entries.slice(0, 25).map((entry, idx) => (
                  <div key={idx} className={`flex items-center justify-between gap-2 p-2 rounded text-xs sm:text-sm ${!entry.staff_id ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50'}`}>
                    <span className="font-semibold">
                      {entry.staff_name}
                      {!entry.staff_id && <span className="text-purple-600 text-xs"> (ידני)</span>}
                    </span>
                    <span className="text-gray-600">{DAY_NAMES[entry.day_of_week]}</span>
                    {/* השעות האפקטיביות - כדי שהמנהל יראה שהמערכת הבינה את מה שכתב בתא */}
                    <span className="text-blue-600 whitespace-nowrap">
                      {entry.actual_start || entry.shift_start}-{entry.actual_end || entry.shift_end}
                      {(entry.actual_start || entry.actual_end) && (
                        <span className="text-gray-400 text-[10px]"> (במקום {entry.shift_start}-{entry.shift_end})</span>
                      )}
                    </span>
                    <span className="text-gray-500 text-[10px] hidden sm:inline">{entry.category}</span>
                    {entry.notes && <span className="text-gray-400 text-[10px] truncate max-w-[90px]">{entry.notes}</span>}
                    {entry.is_backup && <span className="text-orange-600 text-xs">(חלופי)</span>}
                  </div>
                ))}
                {preview.entries.length > 25 && (
                  <p className="text-center text-gray-500 text-xs py-2">
                    ועוד {preview.entries.length - 25} שיבוצים...
                  </p>
                )}
              </div>
            </div>

            <div className="border-t p-4 flex items-center gap-3 justify-between bg-gray-50">
              {preview.existingWeek?.count > 0 ? (
                <p className="text-[11px] text-red-600 font-semibold">
                  ⚠️ בשבוע הזה יש כבר {preview.existingWeek.count} שיבוצים
                  {preview.existingWeek.last_updated && (
                    <> (עודכנו לאחרונה {new Date(preview.existingWeek.last_updated).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })})</>
                  )}
                  {' '}- הייבוא יחליף את כולם
                </p>
              ) : (
                <p className="text-[11px] text-red-600 font-semibold">⚠️ הייבוא מחליף את כל הסידור של השבוע שבגיליון</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setPreview(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold text-sm hover:bg-gray-300"
                >
                  ביטול
                </button>
                <button
                  onClick={confirmImport}
                  disabled={importing}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 active:bg-green-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {importing ? '⏳ מייבא...' : '✅ אשר ייבוא'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
