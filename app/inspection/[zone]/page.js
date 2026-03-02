'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import zoneData from '@/data/zoneAssignments.json';

const ZONE_POLYGONS = {
  A: [
    [32.0380291,34.8840733],[32.0379579,34.889799],[32.0383217,34.8917087],
    [32.0382308,34.8926743],[32.037485,34.8926958],[32.0346838,34.8932537],
    [32.0324645,34.8931678],[32.0267343,34.8916229],[32.0264978,34.8937901],
    [32.02557,34.8990687],[32.0248605,34.9036606],[32.0249333,34.9050983],
    [32.0282442,34.9050339],[32.0300981,34.90478],[32.0313532,34.9043723],
    [32.0316079,34.898922],[32.0343911,34.899437],[32.038793,34.8988147],
    [32.0411394,34.8959179],[32.0413577,34.8921629],[32.0398662,34.8906608],
    [32.0406301,34.8842664],[32.0380291,34.8840733],
  ],
  B: [
    [32.0379579,34.8924597],[32.038249,34.8918589],[32.0378852,34.8893269],
    [32.0380307,34.8835548],[32.0369575,34.8829111],[32.034702,34.8816665],
    [32.0317733,34.8810013],[32.0289537,34.8811301],[32.0274801,34.880658],
    [32.0266069,34.8823317],[32.0272255,34.8849495],[32.0269162,34.89158],
    [32.0308455,34.8926743],[32.0336469,34.8932108],[32.0352477,34.8929747],
    [32.0379579,34.8924597],
  ],
  C: [
    [32.0277348,34.8806366],[32.028699,34.8810442],[32.029845,34.8810657],
    [32.0313367,34.8809584],[32.0326282,34.8810657],[32.0343381,34.8814519],
    [32.0352113,34.8818382],[32.0380125,34.8833402],[32.0381398,34.8827609],
    [32.0363573,34.877611],[32.0341381,34.8760446],[32.03241,34.8746713],
    [32.0336833,34.8728474],[32.0339198,34.8713025],[32.032701,34.8691567],
    [32.0318278,34.8688348],[32.0298996,34.8684915],[32.0294994,34.8680838],
    [32.0281896,34.8676332],[32.0278622,34.8682984],[32.0288445,34.8730191],
    [32.0286444,34.8739847],[32.0243693,34.8747786],[32.0250424,34.8762592],
    [32.0260612,34.8786839],[32.0269526,34.879671],[32.0277348,34.8806366],
  ],
};

const ZONE_FILL_COLORS = { A: '#3b82f6', B: '#22c55e', C: '#f97316' };

function ZoneMap({ zone }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (mapInstanceRef.current) return;

    function initLeaflet() {
      const L = window.L;
      const container = mapRef.current;
      if (!container || container._leaflet_id) return;

      const map = L.map(container, { zoomControl: true, scrollWheelZoom: false });
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      const polygon = ZONE_POLYGONS[zone];
      const color = ZONE_FILL_COLORS[zone] || '#6b7280';

      const poly = L.polygon(polygon, {
        color: color,
        fillColor: color,
        fillOpacity: 0.2,
        weight: 3,
      }).addTo(map);

      map.fitBounds(poly.getBounds(), { padding: [24, 24] });
    }

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (window.L) {
      initLeaflet();
    } else {
      const existing = document.getElementById('leaflet-js');
      if (existing) {
        existing.addEventListener('load', initLeaflet);
      } else {
        const script = document.createElement('script');
        script.id = 'leaflet-js';
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = initLeaflet;
        document.body.appendChild(script);
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [zone]);

  return <div ref={mapRef} style={{ width: '100%', height: '320px' }} />;
}

export default function InspectionPrintPage({ params }) {
  const { zone } = params;
  const searchParams = useSearchParams();
  const router = useRouter();

  const inspectorName = searchParams.get('name') || '_______________';
  const zoneInfo = zoneData.zones[zone];

  if (!zoneInfo) {
    if (typeof window !== 'undefined') router.push('/inspection');
    return null;
  }

  const today = new Date().toLocaleDateString('he-IL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const shelters = zoneInfo.shelters || [];
  const streets = zoneInfo.streets || [];

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .page-break { page-break-before: always; }
        }
        body { font-family: 'Arial', sans-serif; direction: rtl; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #555; padding: 6px 10px; text-align: right; font-size: 13px; }
        th { background: #1f2937; color: white; }
        tr:nth-child(even) { background: #f9fafb; }
      `}</style>

      <div className="no-print bg-gray-100 px-4 py-3 flex items-center justify-between shadow sticky top-0 z-10">
        <button
          onClick={() => router.push('/inspection')}
          className="text-gray-600 hover:text-gray-900 font-semibold text-sm"
        >
          ← חזור
        </button>
        <button
          onClick={() => window.print()}
          className="bg-gray-900 hover:bg-gray-700 text-white font-bold px-6 py-2 rounded-lg text-sm"
        >
          🖨️ הדפס דף סיור
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 bg-white min-h-screen">

        <div className="border-b-4 border-gray-900 pb-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">דף סיור פקח — מקלטים ורחובות</h1>
              <p className="text-gray-600 mt-1">עיריית יהוד-מונוסון • מחלקת ביטחון</p>
            </div>
            <div className="text-left text-sm text-gray-600 leading-relaxed">
              <p><strong>תאריך:</strong> {today}</p>
              <p><strong>פקח:</strong> {inspectorName}</p>
              <p><strong>אזור:</strong> {zone} — {zoneInfo.name}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
            <div className="border border-gray-300 rounded p-2">
              <span className="font-bold text-lg">{shelters.length}</span>
              <p className="text-gray-500">מקלטים לבדיקה</p>
            </div>
            <div className="border border-gray-300 rounded p-2">
              <span className="font-bold text-lg">{streets.length}</span>
              <p className="text-gray-500">רחובות לבדיקה</p>
            </div>
            <div className="border border-gray-300 rounded p-2">
              <span className="font-bold text-lg">____</span>
              <p className="text-gray-500">חריגים נמצאו</p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-base font-bold text-gray-900 mb-2">מפת האזור — {zoneInfo.name}</h2>
          <div className="border-2 border-gray-300 rounded overflow-hidden" style={{ height: '320px' }}>
            <ZoneMap zone={zone} />
          </div>
          <p className="text-xs text-gray-400 mt-1 text-left">© OpenStreetMap contributors</p>
        </div>

        <div className="mb-8">
          <h2 className="text-base font-bold text-gray-900 mb-3 border-b-2 border-gray-900 pb-1">
            מקלטים לבדיקה ({shelters.length})
          </h2>
          <table>
            <thead>
              <tr>
                <th style={{ width: '7%' }}>מס'</th>
                <th style={{ width: '28%' }}>שם המקלט</th>
                <th style={{ width: '30%' }}>כתובת</th>
                <th style={{ width: '12%' }}>סוג</th>
                <th style={{ width: '10%' }}>סטטוס</th>
                <th style={{ width: '13%' }}>הערות</th>
              </tr>
            </thead>
            <tbody>
              {shelters.map((shelter) => (
                <tr key={shelter.id}>
                  <td className="font-bold text-center">{shelter.number}</td>
                  <td>{shelter.name}</td>
                  <td>{shelter.address}</td>
                  <td className="text-center text-xs">{shelter.type}</td>
                  <td className="text-center">
                    <span style={{ fontSize: '18px' }}>☐</span>
                  </td>
                  <td> </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-500 mt-1">סטטוס: ✓ תקין &nbsp;|&nbsp; ✗ חריג (פרט בהערות)</p>
        </div>

        <div className="page-break mb-8">
          <h2 className="text-base font-bold text-gray-900 mb-3 border-b-2 border-gray-900 pb-1">
            רחובות לבדיקה ({streets.length})
          </h2>
          <table>
            <thead>
              <tr>
                <th style={{ width: '5%' }}>#</th>
                <th style={{ width: '40%' }}>שם הרחוב</th>
                <th style={{ width: '12%' }}>סטטוס</th>
                <th style={{ width: '43%' }}>הערות</th>
              </tr>
            </thead>
            <tbody>
              {streets.map((street, i) => (
                <tr key={street}>
                  <td className="text-center text-gray-500">{i + 1}</td>
                  <td>{street}</td>
                  <td className="text-center">
                    <span style={{ fontSize: '18px' }}>☐</span>
                  </td>
                  <td> </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-500 mt-1">סטטוס: ✓ תקין &nbsp;|&nbsp; ✗ חריג (פרט בהערות)</p>
        </div>

        <div className="border-t-2 border-gray-300 pt-4">
          <h2 className="text-base font-bold text-gray-900 mb-3">סיכום הסיור</h2>
          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div>
              <p className="font-semibold mb-1">שעת תחילת הסיור:</p>
              <div className="border-b border-gray-400 h-6"></div>
            </div>
            <div>
              <p className="font-semibold mb-1">שעת סיום הסיור:</p>
              <div className="border-b border-gray-400 h-6"></div>
            </div>
          </div>
          <p className="font-semibold text-sm mb-1">הערות כלליות:</p>
          <div className="border border-gray-300 rounded p-2" style={{ minHeight: '80px' }}></div>
          <div className="mt-6 flex items-end justify-between text-sm">
            <div>
              <p className="font-semibold mb-1">חתימת הפקח:</p>
              <div className="border-b border-gray-400 w-48 h-8"></div>
            </div>
            <p className="text-xs text-gray-400">מקלטון © עיריית יהוד-מונוסון</p>
          </div>
        </div>
      </div>
    </>
  );
}
