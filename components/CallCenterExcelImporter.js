'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

export default function CallCenterExcelImporter({ departmentId, currentWeekStart, staff, shifts, onImportComplete }) {
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
    
    // Find the row with day names (should be row 7)
    let dayRowIndex = -1;
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      if (row && row.some(cell => cell && cell.toString().includes('יום ראשון'))) {
        dayRowIndex = i;
        break;
      }
    }
    
    if (dayRowIndex === -1) {
      console.error('Could not find day row');
      toast.error('לא נמצאה שורת הימים בקובץ');
      return entries;
    }
    
    console.log(`Found day row at index ${dayRowIndex}`);
    
    // Process each row after dates row
    for (let rowIndex = dayRowIndex + 2; rowIndex < rawData.length; rowIndex++) {
      const row = rawData[rowIndex];
      if (!row || row.length === 0) continue;
      
      const shiftTypeCell = row[1]?.toString().trim();
      const positionCell = row[2]?.toString().trim();
      
      if (!shiftTypeCell && !positionCell) continue;
      
      // Detect shift type from column 1
      let shiftName = '';
      if (shiftTypeCell) {
        if (shiftTypeCell.includes('בוקר')) {
          shiftName = 'בוקר';
        } else if (shiftTypeCell.includes('ביניים')) {
          shiftName = 'ביניים';
        } else if (shiftTypeCell.includes('ערב')) {
          shiftName = 'ערב';
        }
      }
      
      // Detect position from column 2
      let position = '';
      if (positionCell) {
        if (positionCell.includes('אחמ')) {
          position = 'אחמ"ש';
        } else if (positionCell.includes('נציג')) {
          position = 'נציג';
        }
      }
      
      // Skip if we don't have both shift and position
      if (!shiftName || !position) continue;
      
      // Find matching shift
      const matchingShift = shifts.find(s => s.name === shiftName);
      if (!matchingShift) {
        console.warn(`Shift not found: ${shiftName}`);
        continue;
      }
      
      console.log(`Processing row ${rowIndex}: ${shiftName} - ${position}`);
      
      // Parse staff for each day (columns 3-9 for Sun-Sat)
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const cellValue = row[dayIndex + 3]?.toString().trim();
        if (!cellValue || cellValue === '-' || cellValue === '') continue;
        
        // Clean the name (remove newlines)
        const cleanName = cellValue.replace(/\n/g, ' ').trim();
        
        // Try to find matching staff member
        const staffMember = staff.find(s => {
          if (!s.full_name) return false;
          const staffFirstName = s.full_name.split(' ')[0];
          const cellFirstName = cleanName.split(' ')[0];
          return staffFirstName === cellFirstName || s.full_name.includes(cleanName) || cleanName.includes(s.full_name);
        });
        
        entries.push({
          staff_id: staffMember?.id || null,
          staff_name: staffMember?.full_name || cleanName,
          shift_id: matchingShift.id,
          day_of_week: dayIndex,
          position
        });
      }
    }
    
    console.log(`Parsed ${entries.length} total entries`);
    return entries;
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      setImporting(true);
      
      const rawData = await parseExcelFile(file);
      const entries = parseScheduleData(rawData);
      
      if (entries.length === 0) {
        toast.error('לא נמצאו משמרות לייבוא. ווודא שהפורמט תקין.');
        setImporting(false);
        return;
      }
      
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
      await fetch(`/api/call-center-schedule?department_id=${departmentId}&week_start=${weekStartStr}`, {
        method: 'DELETE'
      });
      
      // Insert new entries
      const insertRes = await fetch('/api/call-center-schedule/bulk-insert', {
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
          id="call-center-excel-upload"
        />
        <label
          htmlFor="call-center-excel-upload"
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
              <p className="text-xs opacity-75 mt-1">💡 נציגים שמסומנים (ידני) אינם ברשימה הרשמית</p>
            </div>
            
            <div className="p-4 max-h-[50vh] overflow-y-auto">
              <div className="space-y-2">
                {previewData.entries.slice(0, 30).map((entry, idx) => {
                  const shift = shifts.find(s => s.id === entry.shift_id);
                  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
                  const isManual = !entry.staff_id;
                  
                  return (
                    <div key={idx} className={`flex items-center justify-between p-2 rounded text-sm ${isManual ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50'}`}>
                      <span className="font-semibold flex items-center gap-1">
                        {entry.staff_name}
                        {isManual && <span className="text-purple-600 text-xs">(ידני)</span>}
                      </span>
                      <span className="text-xs text-gray-600">{entry.position}</span>
                      <span className="text-gray-600">יום {dayNames[entry.day_of_week]}</span>
                      <span className="text-blue-600 text-xs">{shift?.name}</span>
                    </div>
                  );
                })}
                {previewData.entries.length > 30 && (
                  <p className="text-center text-gray-500 text-xs py-2">
                    ועוד {previewData.entries.length - 30} משמרות...
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
