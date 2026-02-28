'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function ShelterMap({ shelters, userLocation, nearestShelters = [], shelterStatuses = {} }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;
    
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    const map = L.map(mapRef.current).setView([32.0300, 34.8900], 14);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const validShelters = shelters.filter(s => s.lat && s.lng);

    const nearestIds = nearestShelters.map(s => s.id);

    validShelters.forEach(shelter => {
      const isNearest = nearestIds.includes(shelter.id);
      const isPublic = shelter.shelterType === 'public';
      const isOpen = shelterStatuses[shelter.number];
      
      // Determine marker color based on status
      let markerColor = isNearest ? '#ef4444' : '#3b82f6';
      if (isPublic && !isOpen) {
        markerColor = '#9ca3af'; // Gray for closed public shelters
      } else if (isPublic && isOpen) {
        markerColor = '#10b981'; // Green for open public shelters
      }
      
      const icon = L.divIcon({
        className: 'custom-shelter-marker',
        html: `
          <div style="
            background: ${markerColor};
            color: white;
            width: ${isNearest ? '36px' : '28px'};
            height: ${isNearest ? '36px' : '28px'};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: ${isNearest ? '14px' : '11px'};
            border: ${isNearest ? '3px solid white' : '2px solid white'};
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
          ">
            ${shelter.number || '?'}
          </div>
        `,
        iconSize: [isNearest ? 36 : 28, isNearest ? 36 : 28],
      });

      const marker = L.marker([shelter.lat, shelter.lng], { icon }).addTo(map);

      const distance = nearestShelters.find(s => s.id === shelter.id)?.distance;
      const distanceText = distance ? `<br><strong>מרחק: ${Math.round(distance)}m</strong>` : '';
      
      const statusBadge = isPublic ? `
        <div style="margin-top: 8px;">
          <span style="background: ${isOpen ? '#10b981' : '#9ca3af'}; 
                       color: white; 
                       padding: 4px 10px; 
                       border-radius: 12px; 
                       font-size: 13px;
                       font-weight: bold;">
            ${isOpen ? '✓ מקלט פתוח' : '✕ סגור - דורש אישור'}
          </span>
        </div>
      ` : '';

      marker.bindPopup(`
        <div style="text-align: right; direction: rtl; font-family: 'Segoe UI', Tahoma, sans-serif;">
          <strong style="font-size: 16px; color: #1f2937;">${shelter.name}</strong><br>
          <span style="color: #6b7280; font-size: 14px;">מספר: ${shelter.number}</span><br>
          <span style="color: #374151;">📍 ${shelter.address}</span>
          ${distanceText}
          ${statusBadge}
          <div style="margin-top: 8px;">
            <span style="background: ${shelter.accessibility === 'נגיש' ? '#10b981' : '#f59e0b'}; 
                         color: white; 
                         padding: 2px 8px; 
                         border-radius: 12px; 
                         font-size: 12px;">
              ${shelter.accessibility}
            </span>
          </div>
          <div style="margin-top: 8px;">
            <a href="https://waze.com/ul?ll=${shelter.lat},${shelter.lng}" 
               target="_blank" 
               style="background: #06b6d4; 
                      color: white; 
                      padding: 6px 12px; 
                      border-radius: 6px; 
                      text-decoration: none; 
                      display: inline-block; 
                      font-size: 13px;
                      margin-left: 5px;">
              🚗 Waze
            </a>
            <a href="https://www.google.com/maps?q=${shelter.lat},${shelter.lng}" 
               target="_blank" 
               style="background: #ef4444; 
                      color: white; 
                      padding: 6px 12px; 
                      border-radius: 6px; 
                      text-decoration: none; 
                      display: inline-block;
                      font-size: 13px;">
              🗺️ Maps
            </a>
          </div>
        </div>
      `);
    });

    if (userLocation) {
      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: `
          <div style="
            background: #10b981;
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            border: 3px solid white;
            box-shadow: 0 2px 12px rgba(0,0,0,0.4);
          ">
            📍
          </div>
        `,
        iconSize: [40, 40],
      });

      const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map);
      userMarker.bindPopup(`
        <div style="text-align: right; direction: rtl; font-family: 'Segoe UI', Tahoma, sans-serif;">
          <strong style="font-size: 16px; color: #059669;">מיקום התושב</strong><br>
          <span style="color: #374151;">${userLocation.displayName || 'כתובת נבחרת'}</span>
        </div>
      `);

      if (nearestShelters.length > 0) {
        nearestShelters.forEach(shelter => {
          if (shelter.lat && shelter.lng) {
            L.polyline(
              [[userLocation.lat, userLocation.lng], [shelter.lat, shelter.lng]],
              { color: '#ef4444', weight: 2, opacity: 0.6, dashArray: '5, 10' }
            ).addTo(map);
          }
        });
      }

      const bounds = L.latLngBounds([
        [userLocation.lat, userLocation.lng],
        ...nearestShelters.filter(s => s.lat && s.lng).map(s => [s.lat, s.lng])
      ]);
      
      if (nearestShelters.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
      } else {
        map.setView([userLocation.lat, userLocation.lng], 15);
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [shelters, userLocation, nearestShelters]);

  return (
    <div>
      <div 
        ref={mapRef} 
        style={{ 
          width: '100%', 
          height: '500px', 
          borderRadius: '12px',
          border: '2px solid #e5e7eb',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }} 
      />
      <div style={{ 
        marginTop: '10px', 
        padding: '12px', 
        background: '#f9fafb', 
        borderRadius: '8px',
        display: 'flex',
        gap: '15px',
        fontSize: '14px',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ 
            width: '20px', 
            height: '20px', 
            borderRadius: '50%', 
            background: '#ef4444',
            border: '2px solid white'
          }}></div>
          <span>מקלטים קרובים</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ 
            width: '20px', 
            height: '20px', 
            borderRadius: '50%', 
            background: '#10b981',
            border: '2px solid white'
          }}></div>
          <span>מקלט ציבורי פתוח</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ 
            width: '20px', 
            height: '20px', 
            borderRadius: '50%', 
            background: '#9ca3af',
            border: '2px solid white'
          }}></div>
          <span>מקלט ציבורי סגור</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ 
            width: '20px', 
            height: '20px', 
            borderRadius: '50%', 
            background: '#3b82f6',
            border: '2px solid white'
          }}></div>
          <span>מקלטים אחרים</span>
        </div>
      </div>
    </div>
  );
}
