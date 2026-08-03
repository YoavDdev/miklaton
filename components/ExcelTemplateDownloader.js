'use client';

import * as XLSX from 'xlsx';

export default function ExcelTemplateDownloader({ staff, shifts }) {
  const generateTemplate = () => {
    const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    
    // Create headers
    const headers = ['שם העובד', 'תפקיד', ...DAYS];
    
    // Create rows with staff members
    const rows = staff.map(member => {
      return [
        member.full_name,
        member.role,
        '', '', '', '', '', '', '' // Empty cells for each day
      ];
    });
    
    // Add example row
    const exampleRow = [
      '--- דוגמה ---',
      'פיקוח',
      '07:00-15:00',
      '07:00-15:00 (חלופי)',
      'בוקר',
      '',
      '15:00-23:00',
      '',
      ''
    ];
    
    // Add instructions row
    const instructionsRow = [
      'הוראות: מלא בכל יום את השעות או סוג המשמרת (בוקר/צהריים/לילה)',
      '',
      'פורמט: 07:00-15:00',
      'או: בוקר',
      'חלופי: הוסף (חלופי)',
      '',
      '',
      '',
      ''
    ];
    
    // Combine all data
    const data = [
      headers,
      exampleRow,
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
