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
          
          // Get the range and read ALL rows including empty ones
          const range = XLSX.utils.decode_range(firstSheet['!ref']);
          const jsonData = [];
          
          for (let R = range.s.r; R <= range.e.r; ++R) {
            const row = [];
            for (let C = range.s.c; C <= range.e.c; ++C) {
              const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
              const cell = firstSheet[cellAddress];
              row.push(cell ? cell.v : null);
            }
            jsonData.push(row);
          }
          
          console.log(`Read ${jsonData.length} rows from Excel (including all blank rows)`);
          console.log('First 10 rows:', jsonData.slice(0, 10).map((r, i) => `Row ${i}: ${JSON.stringify(r)}`).join('\n'));
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
    
    // Get the expected date for Sunday of this week (format: DD.MM)
    const weekDate = new Date(currentWeekStart);
    const expectedDate = `${String(weekDate.getDate()).padStart(2, '0')}.${String(weekDate.getMonth() + 1).padStart(2, '0')}`;
    
    console.log(`Looking for week starting with date: ${expectedDate}`);
    
    // Find the row with day names that matches our week's dates
    // Search through the entire file as there might be multiple week tables
    let dayRowIndex = -1;
    
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row) continue;
      
      // Check if this row has day names
      const hasRishon = row.some(cell => 
        cell && cell.toString().includes('יום ראשון')
      );
      const hasSheni = row.some(cell => 
        cell && cell.toString().includes('יום שני')
      );
      
      if (hasRishon && hasSheni) {
        // Found a day row - check if the next row (dates row) matches our week
        const nextRow = rawData[i + 1];
        if (nextRow && nextRow.some(cell => cell && cell.toString().includes(expectedDate))) {
          dayRowIndex = i;
          console.log(`✅ Found matching day row at index ${i} for week ${expectedDate}`);
          break;
        } else {
          console.log(`Found day row at ${i} but dates don't match our week`);
        }
      }
    }
    
    if (dayRowIndex === -1) {
      console.error('Could not find day row');
      toast.error('לא נמצאה שורת הימים בקובץ');
      return entries;
    }
    
    console.log(`Found day row at index ${dayRowIndex}`);
    console.log('Day row content:', rawData[dayRowIndex]);
    
    // Find which column has "יום ראשון" - that's where the days start
    const dayRow = rawData[dayRowIndex];
    const dayStartCol = dayRow.findIndex(cell => cell && cell.toString().includes('יום ראשון'));
    
    if (dayStartCol === -1) {
      console.error('Could not find day start column');
      toast.error('לא נמצאה עמודת היום הראשון');
      return entries;
    }
    
    console.log(`Days start at column ${dayStartCol}`);
    
    // Process each row after dates row (limited to reasonable range)
    let lastShiftName = ''; // Remember last shift name for rows without shift type
    const maxRowToProcess = Math.min(dayRowIndex + 20, rawData.length); // Process max 20 rows after day row
    
    for (let rowIndex = dayRowIndex + 2; rowIndex < maxRowToProcess; rowIndex++) {
      const row = rawData[rowIndex];
      if (!row || row.length === 0) continue;
      
      const shiftTypeCell = row[1]?.toString().replace(/\n/g, ' ').trim();
      const positionCell = row[2]?.toString().replace(/\n/g, ' ').trim();
      
      if (!shiftTypeCell && !positionCell) continue;
      
      // Detect shift type from column 1
      let shiftName = '';
      if (shiftTypeCell) {
        if (shiftTypeCell.includes('בוקר')) {
          shiftName = 'בוקר';
          lastShiftName = shiftName; // Remember for next rows
        } else if (shiftTypeCell.includes('ביניים')) {
          shiftName = 'ביניים';
          lastShiftName = shiftName;
        } else if (shiftTypeCell.includes('ערב')) {
          shiftName = 'ערב';
          lastShiftName = shiftName;
        } else if (shiftTypeCell.includes('לילה')) {
          shiftName = 'לילה';
          lastShiftName = shiftName;
        }
      }
      
      // If no shift name in this row, use the last one
      if (!shiftName && lastShiftName) {
        shiftName = lastShiftName;
      }
      
      // Detect position from column 2
      let position = '';
      if (positionCell) {
        // Match אחמ"ש with or without colons/quotes
        if (positionCell.includes('אחמ')) {
          position = 'אחמ"ש';
        } else if (positionCell.includes('נציג')) {
          position = 'נציג';
        }
      }
      
      // If we have shift name but no position, check if there's data in day columns
      // If yes, assume it's a representative (נציג)
      if (shiftName && !position) {
        const hasData = row.slice(3, 10).some(cell => cell && cell.toString().trim() && cell.toString().trim() !== '-');
        if (hasData) {
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
      
      // Parse staff for each day (7 days starting from dayStartCol)
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const cellValue = row[dayIndex + dayStartCol]?.toString().trim();
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
