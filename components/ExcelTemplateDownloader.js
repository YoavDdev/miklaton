'use client';

import * as XLSX from 'xlsx';

export default function ExcelTemplateDownloader({ staff, shifts, schedule }) {
  const generateTemplate = () => {
    const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    
    // Create headers
    const headers = ['שם העובד', 'תפקיד', ...DAYS];
    
    // Create rows with staff members and their existing shifts
    const rows = staff.map(member => {
      const row = [member.full_name, member.role];
      
      // For each day, find if this staff member has a shift
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const dayShifts = schedule.filter(s => 
          s.staff_id === member.id && 
          s.day_of_week === dayIndex
        );
        
        if (dayShifts.length === 0) {
          row.push('');
        } else if (dayShifts.length === 1) {
          const shift = shifts.find(sh => sh.id === dayShifts[0].shift_id);
          const backup = dayShifts[0].is_backup ? ' (חלופי)' : '';
          row.push(shift ? `${shift.start_time}-${shift.end_time}${backup}` : '');
        } else {
          // Multiple shifts on same day - join with comma
          const shiftTexts = dayShifts.map(ds => {
            const shift = shifts.find(sh => sh.id === ds.shift_id);
            const backup = ds.is_backup ? ' (חלופי)' : '';
            return shift ? `${shift.start_time}-${shift.end_time}${backup}` : '';
          });
          row.push(shiftTexts.join(', '));
        }
      }
      
      return row;
    });
    
    // Add instructions row at the top
    const instructionsRow = [
      '📝 הוראות: ערוך את המשמרות | פורמט: 07:00-15:00 או בוקר | חלופי: הוסף (חלופי)',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    ];
    
    // Combine all data
    const data = [
      headers,
      instructionsRow,
      ...rows
    ];
    
    // Create workbook
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 20 }, // Name
      { wch: 10 }, // Role
      { wch: 15 }, // Sunday
      { wch: 15 }, // Monday
      { wch: 15 }, // Tuesday
      { wch: 15 }, // Wednesday
      { wch: 15 }, // Thursday
      { wch: 15 }, // Friday
      { wch: 15 }  // Saturday
    ];
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'סידור עבודה');
    
    // Generate file name with current date
    const today = new Date();
    const fileName = `סידור_עבודה_שבועי_${today.getDate()}_${today.getMonth() + 1}_${today.getFullYear()}.xlsx`;
    
    // Download
    XLSX.writeFile(wb, fileName);
  };
  
  return (
    <button
      onClick={generateTemplate}
      className="px-3 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
    >
      📥 הורד טמפלייט Excel
    </button>
  );
}
