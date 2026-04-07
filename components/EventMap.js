'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MARKER_COLORS = {
  map_marker: '#e11d48',   // rose-600
  location: '#2563eb',     // blue-600
  urgent: '#dc2626',       // red-600
};

export default function EventMap({ journal = [], onAddMarker, isActive = false, shelters = [] }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const [addingMarker, setAddingMarker] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapRef.current, { zoomControl: true }).setView([32.0300, 34.8900], 15);
    mapInstanceRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    // Add shelters as small background markers
    shelters.filter(s => s.lat && s.lng).forEach(shelter => {
      const icon = L.divIcon({
        className: 'shelter-bg-marker',
        html: `<div style="
          background: #94a3b8;
          color: white;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
          font-weight: bold;
          border: 1.5px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          opacity: 0.6;
        ">${shelter.number || ''}</div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker([shelter.lat, shelter.lng], { icon, interactive: false }).addTo(map);
    });

    // Click handler for adding markers
    map.on('click', (e) => {
      if (!isActive || !onAddMarker) return;
      const note = prompt('הוסף הערה על המפה:');
      if (note !== null && note.trim()) {
        onAddMarker(e.latlng.lat, e.latlng.lng, note.trim());
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update isActive ref for click handler
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.off('click');
    map.on('click', (e) => {
      if (!isActive || !onAddMarker) return;
      const note = prompt('הוסף הערה על המפה:');
      if (note !== null && note.trim()) {
        onAddMarker(e.latlng.lat, e.latlng.lng, note.trim());
      }
    });
  }, [isActive, onAddMarker]);

  // Update markers when journal changes
  useEffect(() => {
    if (!markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();

    const mapEntries = journal.filter(e =>
      (e.entry_type === 'map_marker' || e.entry_type === 'location') &&
      e.location_lat && e.location_lng
    );

    mapEntries.forEach(entry => {
      const color = MARKER_COLORS[entry.entry_type] || MARKER_COLORS.map_marker;
      const isMapMarker = entry.entry_type === 'map_marker';
      const time = new Date(entry.created_at).toLocaleString('he-IL', {
        timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit'
      });

      const icon = L.divIcon({
        className: 'event-map-marker',
        html: `<div style="
          background: ${color};
          color: white;
          width: ${isMapMarker ? '30px' : '26px'};
          height: ${isMapMarker ? '30px' : '26px'};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${isMapMarker ? '14px' : '12px'};
          border: 2.5px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.35);
          cursor: pointer;
        ">${isMapMarker ? '📍' : '👤'}</div>`,
        iconSize: [isMapMarker ? 30 : 26, isMapMarker ? 30 : 26],
        iconAnchor: [isMapMarker ? 15 : 13, isMapMarker ? 15 : 13],
      });

      const marker = L.marker([entry.location_lat, entry.location_lng], { icon });
      marker.bindPopup(`
        <div style="text-align: right; direction: rtl; font-family: sans-serif; min-width: 150px;">
          <strong style="color: #1f2937;">${entry.author_name}</strong>
          <span style="color: #9ca3af; font-size: 11px; margin-right: 6px;">${time}</span>
          <br/>
          <span style="color: #374151; font-size: 13px;">${entry.content || ''}</span>
        </div>
      `);
      marker.addTo(markersLayerRef.current);
    });
  }, [journal]);

  return (
    <div className="relative">
      <div
        ref={mapRef}
        style={{ width: '100%', height: '350px', borderRadius: '12px', border: '2px solid #e5e7eb' }}
      />
      {isActive && (
        <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur rounded-lg px-3 py-1.5 shadow-lg border text-xs text-gray-600 font-medium" dir="rtl">
          👆 לחץ על המפה להוספת סימון
        </div>
      )}
      <div className="flex gap-3 mt-2 text-xs justify-center flex-wrap" dir="rtl">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full" style={{ background: '#e11d48', border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          <span>סימון על המפה</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full" style={{ background: '#2563eb', border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          <span>שיתוף מיקום</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full" style={{ background: '#94a3b8', border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', opacity: 0.6 }} />
          <span>מקלטים</span>
        </div>
      </div>
    </div>
  );
}
