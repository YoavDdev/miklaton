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

      <div ref={printRef} className="print-content hidden print:block">
        <style jsx global>{`
          @media print {
            body {
              margin: 0;
              padding: 20px;
            }
            .print-content {
              display: block !important;
            }
            .no-print {
              display: none !important;
            }
            @page {
              margin: 2cm;
              size: A4;
            }
          }
        `}</style>

        <div className="print:block" style={{ fontFamily: 'Arial, sans-serif' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '3px solid #2563eb', paddingBottom: '15px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e40af', margin: '0 0 10px 0' }}>
              🛡️ רשימת מקלטים - עיריית יהוד מונוסון
            </h1>
            <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
              תאריך הדפסה: {new Date().toLocaleDateString('he-IL', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>

          {/* Categories */}
          {Object.entries(categorizedShelters).map(([category, sheltersList]) => {
            if (sheltersList.length === 0) return null;
            
            return (
              <div key={category} style={{ marginBottom: '40px', pageBreakInside: 'avoid' }}>
                <h2 style={{ 
                  fontSize: '20px', 
                  fontWeight: 'bold', 
                  backgroundColor: '#dbeafe',
                  padding: '10px 15px',
                  borderRight: '5px solid #2563eb',
                  marginBottom: '15px'
                }}>
                  📋 {category} ({sheltersList.length} מקלטים)
                </h2>

                {sheltersList.map((shelter, index) => (
                  <div 
                    key={shelter.id}
                    style={{
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '15px',
                      marginBottom: '20px',
                      backgroundColor: '#ffffff',
                      pageBreakInside: 'avoid'
                    }}
                  >
                    {/* Shelter Header */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '12px',
                      borderBottom: '1px solid #e5e7eb',
                      paddingBottom: '8px'
                    }}>
                      <div>
                        <h3 style={{ 
                          fontSize: '18px', 
                          fontWeight: 'bold', 
                          margin: '0 0 5px 0',
                          color: '#1e40af'
                        }}>
                          {shelter.name}
                        </h3>
                        <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
                          כתובת: {shelter.address}
                        </p>
                      </div>
                      <div style={{
                        backgroundColor: '#2563eb',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: '25px',
                        fontSize: '16px',
                        fontWeight: 'bold'
                      }}>
                        מקלט {shelter.number}
                      </div>
                    </div>

                    {/* Shelter Details */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr',
                      gap: '10px',
                      fontSize: '13px',
                      marginBottom: '12px'
                    }}>
                      <div>
                        <strong>אזור:</strong> {shelter.neighborhood || 'לא צוין'}
                      </div>
                      {shelter.landmarks && (
                        <div>
                          <strong>ציוני דרך:</strong> {shelter.landmarks}
                        </div>
                      )}
                      {shelter.directions && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <strong>הוראות הגעה:</strong> {shelter.directions}
                        </div>
                      )}
                    </div>

                    {/* Notes Section */}
                    <div style={{
                      marginTop: '15px',
                      padding: '10px',
                      backgroundColor: '#f9fafb',
                      border: '1px dashed #9ca3af',
                      borderRadius: '6px',
                      minHeight: '80px'
                    }}>
                      <p style={{ 
                        fontSize: '12px', 
                        fontWeight: 'bold', 
                        color: '#374151',
                        margin: '0 0 8px 0'
                      }}>
                        📝 הערות ומידע נוסף:
                      </p>
                      <div style={{
                        borderBottom: '1px solid #d1d5db',
                        marginBottom: '6px',
                        minHeight: '20px'
                      }}></div>
                      <div style={{
                        borderBottom: '1px solid #d1d5db',
                        marginBottom: '6px',
                        minHeight: '20px'
                      }}></div>
                      <div style={{
                        borderBottom: '1px solid #d1d5db',
                        minHeight: '20px'
                      }}></div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {/* Footer */}
          <div style={{
            marginTop: '40px',
            padding: '15px',
            backgroundColor: '#f3f4f6',
            borderTop: '2px solid #9ca3af',
            textAlign: 'center',
            fontSize: '12px',
            color: '#6b7280'
          }}>
            <p style={{ margin: '0 0 5px 0' }}>
              מערכת מקלטון - עיריית יהוד מונוסון
            </p>
            <p style={{ margin: 0 }}>
              לשאלות ופניות: טלפון חירום 106 | מוקד עירוני 03-5391200
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
