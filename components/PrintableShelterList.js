'use client';
import { useRef } from 'react';

export default function PrintableShelterList({ shelters }) {
  const printRef = useRef();

  const handlePrint = () => {
    window.print();
  };

  // Organize shelters by category
  const categorizedShelters = {
    'מקלטים ציבוריים - מוסדות חינוך': [],
    'מקלטים ציבוריים אחרים': [],
    'מקלטים רגילים': []
  };

  shelters.forEach(shelter => {
    if (shelter.shelterType === 'public' && shelter.requiresApproval) {
      categorizedShelters['מקלטים ציבוריים - מוסדות חינוך'].push(shelter);
    } else if (shelter.shelterType === 'public') {
      categorizedShelters['מקלטים ציבוריים אחרים'].push(shelter);
    } else {
      categorizedShelters['מקלטים רגילים'].push(shelter);
    }
  });

  return (
    <>
      <button
        onClick={handlePrint}
        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-colors print:hidden flex items-center gap-2"
      >
        🖨️ הדפס רשימת מקלטים
      </button>

      <div ref={printRef} id="printable-shelter-list" className="print-content hidden print:block">
        <style jsx global>{`
          @media print {
            /* Hide everything on page */
            body > * {
              display: none !important;
            }
            
            /* Show only the shelter list */
            #printable-shelter-list {
              display: block !important;
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            
            body {
              margin: 0;
              padding: 10px;
              font-size: 9px;
            }
            
            @page {
              margin: 0.5cm;
              size: A4;
            }
            
            table {
              page-break-inside: auto;
            }
            
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
          }
        `}</style>

        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '9px' }}>
          {/* Minimal Header */}
          <div style={{ textAlign: 'center', marginBottom: '8px', borderBottom: '2px solid #000', paddingBottom: '4px' }}>
            <h1 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>
              רשימת מקלטים - יהוד מונוסון
            </h1>
          </div>

          {/* Compact Table Format */}
          {Object.entries(categorizedShelters).map(([category, sheltersList]) => {
            if (sheltersList.length === 0) return null;
            
            return (
              <div key={category} style={{ marginBottom: '12px' }}>
                <h2 style={{ 
                  fontSize: '11px', 
                  fontWeight: 'bold', 
                  backgroundColor: '#e0e0e0',
                  padding: '3px 6px',
                  marginBottom: '4px'
                }}>
                  {category} ({sheltersList.length})
                </h2>

                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  fontSize: '8px',
                  marginBottom: '8px'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '1px solid #000' }}>
                      <th style={{ border: '1px solid #ccc', padding: '2px 4px', width: '8%', textAlign: 'center' }}>מס׳</th>
                      <th style={{ border: '1px solid #ccc', padding: '2px 4px', width: '25%' }}>שם</th>
                      <th style={{ border: '1px solid #ccc', padding: '2px 4px', width: '27%' }}>כתובת</th>
                      <th style={{ border: '1px solid #ccc', padding: '2px 4px', width: '40%' }}>הערות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheltersList.map((shelter) => (
                      <tr key={shelter.id}>
                        <td style={{ 
                          border: '1px solid #ccc', 
                          padding: '2px 4px',
                          textAlign: 'center',
                          fontWeight: 'bold'
                        }}>
                          {shelter.number}
                        </td>
                        <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}>
                          {shelter.name}
                        </td>
                        <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}>
                          {shelter.address}
                        </td>
                        <td style={{ 
                          border: '1px solid #ccc', 
                          padding: '2px 4px',
                          minHeight: '30px',
                          backgroundColor: '#fafafa'
                        }}>
                          {/* Empty space for handwritten notes */}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {/* Minimal Footer */}
          <div style={{
            position: 'fixed',
            bottom: '5px',
            left: '0',
            right: '0',
            textAlign: 'center',
            fontSize: '7px',
            color: '#666'
          }}>
            www.miklaton.yehud-monosson.muni.il
          </div>
        </div>
      </div>
    </>
  );
}
