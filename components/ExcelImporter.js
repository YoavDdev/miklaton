'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

export default function ExcelImporter({ departmentId, currentWeekStart, staff, shifts, onImportComplete }) {
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const fileInputRef = useRef(null);

  const formatDateForDB = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('שגיאה בקריאת הקובץ'));
      reader.readAsArrayBuffer(file);
    });
  };

  const parseScheduleData = (rawData) => {
    const entries = [];
    const weekStartStr = formatDateForDB(currentWeekStart);
    
    // Skip first row (headers) and iterate through data
    for (let rowIndex = 1; rowIndex < rawData.length; rowIndex++) {
      const row = rawData[rowIndex];
      if (!row || row.length === 0) continue;
      
      // Try to parse each row
      // Format expected: [Name, Role, Day0, Day1, Day2, Day3, Day4, Day5, Day6]
      // Or: [Name, Role, Sun, Mon, Tue, Wed, Thu, Fri, Sat]
      
      const name = row[0]?.toString().trim();
      if (!name || name.length < 2) continue; // Skip empty or invalid names
      
      // Try to find matching staff member
      const staffMember = staff.find(s => 
        s.full_name?.includes(name) || name.includes(s.full_name)
      );
      
      // If not found, use manual name (for temporary workers, trainees, etc.)
      if (!staffMember) {
        console.log(`ℹ️ Using manual name for: ${name} (not in staff list)`);
      }
      
      const staffId = staffMember?.id || null;
      const staffName = staffMember?.full_name || name;
      const defaultRole = row[1]?.toString().trim() || staffMember?.role || 'פיקוח';
      
      // Parse shifts for each day (columns 2-8 or based on pattern)
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const cellValue = row[dayIndex + 2]?.toString().trim();
        if (!cellValue || cellValue === '-' || cellValue === '') continue;
        
        // Parse shift from cell (e.g., "07:00-15:00", "בוקר", "07:00-15:00 (פיקוח)")
        const shiftInfo = parseShiftInfo(cellValue, defaultRole);
        if (!shiftInfo) continue;
        
        // Find matching shift definition
        const matchingShift = shifts.find(s => 
          s.category === shiftInfo.category &&
          s.start_time === shiftInfo.startTime &&
          s.end_time === shiftInfo.endTime
        );
        
        if (matchingShift) {
          entries.push({
            staff_id: staffId, // Can be null for manual entries
            staff_name: staffName, // Manual name if staff not found
            shift_id: matchingShift.id,
            day_of_week: dayIndex,
            is_backup: shiftInfo.isBackup || false
          });
        }
      }
    }
    
    return entries;
  };

  const parseShiftInfo = (cellValue, defaultRole) => {
    const value = cellValue.toLowerCase();
    
    // Common patterns
    if (value.includes('בוקר') || value.includes('morning')) {
      return { startTime: '07:00', endTime: '15:00', category: defaultRole || 'פיקוח', isBackup: value.includes('חלופי') };
    }
    if (value.includes('צהריים') || value.includes('afternoon')) {
      return { startTime: '15:00', endTime: '23:00', category: defaultRole || 'פיקוח', isBackup: value.includes('חלופי') };
    }
    if (value.includes('לילה') || value.includes('night')) {
      return { startTime: '23:00', endTime: '07:00', category: defaultRole || 'פיקוח', isBackup: value.includes('חלופי') };
    }
    
    // Parse time range (e.g., "07:00-15:00")
    const timeMatch = value.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const startTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
      const endTime = `${timeMatch[3].padStart(2, '0')}:${timeMatch[4]}`;
      return { 
        startTime, 
        endTime, 
        category: value.includes('שיטור') ? 'שיטור' : (defaultRole || 'פיקוח'),
        isBackup: value.includes('חלופי') || value.includes('backup')
      };
    }
    
    return null;
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      setImporting(true);
      
      // Parse Excel file
      const rawData = await parseExcelFile(file);
      
      // Parse schedule data
      const entries = parseScheduleData(rawData);
      
      if (entries.length === 0) {
        toast.error('לא נמצאו משמרות לייבוא. ווודא שהפורמט תקין.');
        setImporting(false);
        return;
      }
      
      // Show preview
      setPreviewData({ entries, fileName: file.name });
      setImporting(false);
      
    } catch (error) {
      console.error('Error parsing Excel:', error);
      toast.error('שגיאה בקריאת הקובץ: ' + error.message);
      setImporting(false);
    }
  };

  const confirmImport = async () => {
    if (!previewData) return;
    
    try {
      setImporting(true);
      const weekStartStr = formatDateForDB(currentWeekStart);
      
      // Delete existing schedule for this week
      const deleteRes = await fetch(`/api/security-schedule/bulk-delete?department_id=${departmentId}&week_start=${weekStartStr}`, {
        method: 'DELETE'
      });
      
      // Insert new entries
      const insertRes = await fetch('/api/security-schedule/bulk-insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department_id: departmentId,
          week_start: weekStartStr,
          entries: previewData.entries
        })
      });
      
      const result = await insertRes.json();
      
      if (result.success) {
        toast.success(`✅ ${previewData.entries.length} משמרות יובאו בהצלחה!`);
        setPreviewData(null);
        if (onImportComplete) onImportComplete();
      } else {
        toast.error('שגיאה בייבוא: ' + result.error);
      }
    } catch (error) {
      toast.error('שגיאה בייבוא: ' + error.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
        <span className="text-xs text-gray-500">תומך ב-Excel (.xlsx, .xls)</span>
      </div>

      {/* Preview Modal */}
      {previewData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPreviewData(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-l from-green-600 to-blue-600 text-white p-4">
              <h3 className="text-lg font-bold">תצוגה מקדימה - {previewData.fileName}</h3>
              <p className="text-sm opacity-90">נמצאו {previewData.entries.length} משמרות לייבוא</p>
              <p className="text-xs opacity-75 mt-1">💡 עובדים שמסומנים (ידני) אינם ברשימה הרשמית - מתלמדים/זמניים</p>
            </div>
            
            <div className="p-4 max-h-[50vh] overflow-y-auto">
              <div className="space-y-2">
                {previewData.entries.slice(0, 20).map((entry, idx) => {
                  const shift = shifts.find(s => s.id === entry.shift_id);
                  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
                  
                  const isManual = !entry.staff_id;
                  return (
                    <div key={idx} className={`flex items-center justify-between p-2 rounded text-sm ${isManual ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50'}`}>
                      <span className="font-semibold flex items-center gap-1">
                        {entry.staff_name}
                        {isManual && <span className="text-purple-600 text-xs">(ידני)</span>}
                      </span>
                      <span className="text-gray-600">יום {dayNames[entry.day_of_week]}</span>
                      <span className="text-blue-600">{shift?.start_time} - {shift?.end_time}</span>
                      {entry.is_backup && <span className="text-orange-600 text-xs">(חלופי)</span>}
                    </div>
                  );
                })}
                {previewData.entries.length > 20 && (
                  <p className="text-center text-gray-500 text-xs py-2">
                    ועוד {previewData.entries.length - 20} משמרות...
                  </p>
                )}
              </div>
            </div>
            
            <div className="border-t p-4 flex gap-3 justify-end bg-gray-50">
              <button
                onClick={() => setPreviewData(null)}
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
      )}
    </div>
  );
}
