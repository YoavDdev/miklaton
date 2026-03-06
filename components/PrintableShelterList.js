'use client';

export default function PrintableShelterList({ shelters }) {

  const handlePrint = () => {
    // Organize shelters by category
    const categories = {
      'מקלטים ציבוריים - מוסדות חינוך': [],
      'מקלטים ציבוריים אחרים': [],
      'מקלטים רגילים': []
    };

    shelters.forEach(shelter => {
      if (shelter.shelterType === 'public' && shelter.requiresApproval) {
        categories['מקלטים ציבוריים - מוסדות חינוך'].push(shelter);
      } else if (shelter.shelterType === 'public') {
        categories['מקלטים ציבוריים אחרים'].push(shelter);
      } else {
        categories['מקלטים רגילים'].push(shelter);
      }
    });

    // Build HTML for each category
    let tablesHtml = '';
    Object.entries(categories).forEach(([category, list]) => {
      if (list.length === 0) return;
      let rows = list.map(s => `
        <tr>
          <td style="border:1px solid #999;padding:4px 6px;text-align:center;font-weight:bold">${s.number}</td>
          <td style="border:1px solid #999;padding:4px 6px">${s.name}</td>
          <td style="border:1px solid #999;padding:4px 6px">${s.address}</td>
          <td style="border:1px solid #999;padding:4px 6px;min-height:25px;background:#fafafa">&nbsp;</td>
        </tr>
      `).join('');
      
      tablesHtml += `
        <h2 style="font-size:13px;font-weight:bold;background:#e0e0e0;padding:4px 8px;margin:12px 0 4px 0;page-break-after:avoid">${category} (${list.length})</h2>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px">
          <thead>
            <tr style="background:#f0f0f0">
              <th style="border:1px solid #999;padding:4px 6px;width:8%;text-align:center">מס׳</th>
              <th style="border:1px solid #999;padding:4px 6px;width:25%">שם</th>
              <th style="border:1px solid #999;padding:4px 6px;width:27%">כתובת</th>
              <th style="border:1px solid #999;padding:4px 6px;width:40%">הערות</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    });

    // Open new window and print
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html dir="rtl">
      <head>
        <title>רשימת מקלטים - יהוד מונוסון</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; direction: rtl; }
          @page { margin: 1cm; size: A4; }
          table { page-break-inside: auto; width: 100%; border-collapse: collapse; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          h2 { page-break-after: avoid; }
          div.category { page-break-inside: avoid; }
        </style>
      </head>
      <body>
        <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:12px">
          <h1 style="font-size:18px;margin:0">רשימת מקלטים - יהוד מונוסון</h1>
          <p style="font-size:11px;color:#666;margin:4px 0 0 0">${new Date().toLocaleDateString('he-IL')}</p>
        </div>
        ${tablesHtml}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  return (
    <button
      onClick={handlePrint}
      className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-colors flex items-center gap-2"
    >
      🖨️ הדפס רשימת מקלטים
    </button>
  );
}
