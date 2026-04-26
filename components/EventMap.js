'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import toast, { Toaster } from 'react-hot-toast';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MARKER_COLORS = {
  map_marker: '#7c3aed',   // violet-600 (לא אדום!)
  location: '#2563eb',     // blue-600
  urgent: '#dc2626',       // red-600
};

export default function EventMap({ 
  journal = [], 
  onAddMarker,
  onDeleteMarker, 
  isActive = false, 
  shelters = [],
  eventLocations = [],
  onAddEventLocation,
  onRemoveEventLocation,
  roadBlocks = [],
  onAddRoadBlock,
  onRemoveRoadBlock,
  className = '' 
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const roadBlocksLayerRef = useRef(null);
  const eventMarkersRef = useRef([]);
  const onDeleteMarkerRef = useRef(onDeleteMarker);
  const onRemoveEventLocationRef = useRef(onRemoveEventLocation);
  const onRemoveRoadBlockRef = useRef(onRemoveRoadBlock);
  const hasZoomedToEventRef = useRef(false); // Track if we've already zoomed to event location
  const roadBlockPointsRef = useRef([]); // Use ref to prevent click handler re-registration
  const modeRef = useRef('view'); // Track mode in ref to avoid stale closures
  const [mode, setMode] = useState('view'); // 'view', 'event_location', 'road_block', 'marker', 'delete'
  const [roadBlockPoints, setRoadBlockPoints] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  
  // Modal for editing names
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempName, setTempName] = useState('');
  const [pendingAction, setPendingAction] = useState(null); // Stores the action to execute after name input
  
  // Update refs when functions change
  useEffect(() => {
    onDeleteMarkerRef.current = onDeleteMarker;
    onRemoveEventLocationRef.current = onRemoveEventLocation;
    onRemoveRoadBlockRef.current = onRemoveRoadBlock;
  }, [onDeleteMarker, onRemoveEventLocation, onRemoveRoadBlock]);

  // Sync mode ref with mode state and recalculate map size
  useEffect(() => {
    modeRef.current = mode;
    // When mode changes, UI buttons change which may resize the map container.
    // Force invalidateSize immediately so the first click has correct coordinates.
    const map = mapInstanceRef.current;
    if (map && mode !== 'view') {
      // Use requestAnimationFrame to ensure DOM has updated before recalculating
      requestAnimationFrame(() => {
        map.invalidateSize();
      });
    }
  }, [mode]);

  // Show toast notifications when entering modes
  useEffect(() => {
    if (mode === 'event_location') {
      toast('🚨 לחץ על המפה לסימון מיקום האירוע', {
        duration: 3000,
        position: 'bottom-center',
        style: {
          background: '#ef4444',
          color: '#fff',
          fontWeight: 'bold',
          direction: 'rtl',
        },
      });
    } else if (mode === 'road_block') {
      toast('🚧 לחץ על המפה לסימון נקודות לאורך הכביש', {
        duration: 3000,
        position: 'bottom-center',
        style: {
          background: '#f97316',
          color: '#fff',
          fontWeight: 'bold',
          direction: 'rtl',
        },
      });
    } else if (mode === 'marker') {
      toast('📍 לחץ על המפה להוספת סימון', {
        duration: 3000,
        position: 'bottom-center',
        style: {
          background: '#3b82f6',
          color: '#fff',
          fontWeight: 'bold',
          direction: 'rtl',
        },
      });
    }
  }, [mode]);

  // Handle map resize - critical for accurate coordinate mapping
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Invalidate size immediately when component mounts or className changes
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    // Watch for container resize events
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });

    const container = map.getContainer();
    if (container) {
      resizeObserver.observe(container);
    }

    // Also handle window resize (for mobile/desktop transitions)
    const handleWindowResize = () => {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    };
    
    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [className]);

  // Search for address using Nominatim (OpenStreetMap)
  const searchAddress = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery + ', יהוד מונוסון, ישראל')}&format=json&limit=5&accept-language=he`
      );
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Search error:', error);
    }
    setSearching(false);
  };

  const goToSearchResult = (result) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([result.lat, result.lon], 18);
      setSearchResults([]);
      setSearchQuery('');
    }
  };

  // Handle name confirmation from modal
  const handleNameConfirm = () => {
    if (!pendingAction || !tempName.trim()) return;

    if (pendingAction.type === 'event_location') {
      onAddEventLocation({
        lat: pendingAction.lat,
        lng: pendingAction.lng,
        address: tempName.trim(),
        id: Date.now()
      });
      setMode('view');
      toast.success('✅ מיקום האירוע נוסף בהצלחה!', {
        duration: 2000,
        position: 'bottom-center',
        style: { direction: 'rtl', fontWeight: 'bold' },
      });
    } else if (pendingAction.type === 'marker') {
      onAddMarker(pendingAction.lat, pendingAction.lng, tempName.trim());
      setMode('view');
      toast.success('✅ סימון נוסף למפה!', {
        duration: 2000,
        position: 'bottom-center',
        style: { direction: 'rtl', fontWeight: 'bold' },
      });
    } else if (pendingAction.type === 'road_block') {
      onAddRoadBlock(pendingAction.points, tempName.trim());
      roadBlockPointsRef.current = [];
      setRoadBlockPoints([]);
      setMode('view');
      toast.success('✅ חסימת הכביש נוספה בהצלחה!', {
        duration: 2000,
        position: 'bottom-center',
        style: { direction: 'rtl', fontWeight: 'bold' },
      });
    }

    // Reset modal state
    setShowNameModal(false);
    setPendingAction(null);
    setTempName('');
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapRef.current, { 
      zoomControl: true,
      scrollWheelZoom: false  // Disable scroll wheel zoom by default to prevent page scroll confusion
    }).setView([32.0300, 34.8900], 15);
    
    mapInstanceRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);
    roadBlocksLayerRef.current = L.layerGroup().addTo(map);
    
    // Enable/disable scroll wheel zoom based on mouse position
    const container = map.getContainer();
    const onMouseEnter = () => {
      if (mapInstanceRef.current) mapInstanceRef.current.scrollWheelZoom.enable();
    };
    const onMouseLeave = () => {
      if (mapInstanceRef.current) mapInstanceRef.current.scrollWheelZoom.disable();
    };
    container.addEventListener('mouseenter', onMouseEnter);
    container.addEventListener('mouseleave', onMouseLeave);
    
    // Event listener for delete buttons (using event delegation)
    map.on('popupopen', (e) => {
      const popup = e.popup;
      const content = popup.getContent();
      if (typeof content === 'string') {
        // Add click listeners to all delete buttons
        setTimeout(() => {
          // Map markers
          const markerButtons = popup._contentNode.querySelectorAll('.delete-map-marker');
          markerButtons.forEach(btn => {
            btn.onclick = () => {
              const markerId = btn.getAttribute('data-marker-id');
              if (markerId && onDeleteMarkerRef.current) {
                toast((t) => (
                  <div dir="rtl" className="text-center">
                    <p className="font-bold mb-3">🗑️ למחוק את הסימון הזה?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          onDeleteMarkerRef.current(markerId);
                          popup._source.closePopup();
                          toast.dismiss(t.id);
                          toast.success('✅ הסימון נמחק!', {
                            duration: 2000,
                            style: { direction: 'rtl' }
                          });
                        }}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700"
                      >
                        מחק
                      </button>
                      <button
                        onClick={() => toast.dismiss(t.id)}
                        className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-600"
                      >
                        ביטול
                      </button>
                    </div>
                  </div>
                ), {
                  duration: 5000,
                  position: 'top-center',
                });
              }
            };
          });
          
          // Event locations
          const locationButtons = popup._contentNode.querySelectorAll('.delete-event-location');
          locationButtons.forEach(btn => {
            btn.onclick = () => {
              const locationIdStr = btn.getAttribute('data-location-id');
              if (locationIdStr && onRemoveEventLocationRef.current) {
                const locationId = parseInt(locationIdStr);
                toast((t) => (
                  <div dir="rtl" className="text-center">
                    <p className="font-bold mb-3">🗑️ למחוק את המיקום הזה?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          onRemoveEventLocationRef.current(locationId);
                          popup._source.closePopup();
                          toast.dismiss(t.id);
                          toast.success('✅ המיקום נמחק!', {
                            duration: 2000,
                            style: { direction: 'rtl' }
                          });
                        }}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700"
                      >
                        מחק
                      </button>
                      <button
                        onClick={() => toast.dismiss(t.id)}
                        className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-600"
                      >
                        ביטול
                      </button>
                    </div>
                  </div>
                ), {
                  duration: 5000,
                  position: 'top-center',
                });
              }
            };
          });
          
          // Road blocks
          const blockButtons = popup._contentNode.querySelectorAll('.delete-road-block');
          blockButtons.forEach(btn => {
            btn.onclick = () => {
              const blockIdStr = btn.getAttribute('data-block-id');
              if (blockIdStr && onRemoveRoadBlockRef.current) {
                const blockId = parseInt(blockIdStr);
                toast((t) => (
                  <div dir="rtl" className="text-center">
                    <p className="font-bold mb-3">🗑️ למחוק את החסימה הזו?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          onRemoveRoadBlockRef.current(blockId);
                          popup._source.closePopup();
                          toast.dismiss(t.id);
                          toast.success('✅ החסימה נמחקה!', {
                            duration: 2000,
                            style: { direction: 'rtl' }
                          });
                        }}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700"
                      >
                        מחק
                      </button>
                      <button
                        onClick={() => toast.dismiss(t.id)}
                        className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-600"
                      >
                        ביטול
                      </button>
                    </div>
                  </div>
                ), {
                  duration: 5000,
                  position: 'top-center',
                });
              }
            };
          });
        }, 0);
      }
    });

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

    // Fix map size after initialization - critical for accurate clicks
    map.whenReady(() => {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    });

    return () => {
      container.removeEventListener('mouseenter', onMouseEnter);
      container.removeEventListener('mouseleave', onMouseLeave);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Register click handler ONCE - use refs to avoid re-registration issues
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    
    const handleMapClick = (e) => {
      const currentMode = modeRef.current;
      
      // Event location mode - ask for name
      if (currentMode === 'event_location') {
        if (onAddEventLocation) {
          setPendingAction({
            type: 'event_location',
            lat: e.latlng.lat,
            lng: e.latlng.lng,
          });
          setTempName('מיקום אירוע');
          setShowNameModal(true);
        }
        return;
      }
      
      // Road block mode - use ref to get current points
      if (currentMode === 'road_block') {
        const newPoints = [...roadBlockPointsRef.current, [e.latlng.lat, e.latlng.lng]];
        roadBlockPointsRef.current = newPoints;
        setRoadBlockPoints(newPoints);
        return;
      }
      
      // Marker mode - ask for name
      if (currentMode === 'marker' && onAddMarker && isActive) {
        setPendingAction({
          type: 'marker',
          lat: e.latlng.lat,
          lng: e.latlng.lng,
        });
        setTempName('סימון על המפה');
        setShowNameModal(true);
      }
    };
    
    map.on('click', handleMapClick);
    
    return () => {
      map.off('click', handleMapClick);
    };
  }, [onAddEventLocation, onAddMarker, isActive]); // Only re-register if callbacks change

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
      
      // Add delete button only for map_marker type (not location)
      const deleteButton = isMapMarker && onDeleteMarker 
        ? `<br/><button class="delete-map-marker" data-marker-id="${entry.id}" style="background: #dc2626; color: white; padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 8px; width: 100%;">🗑️ מחק סימון</button>`
        : '';
      
      marker.bindPopup(`
        <div style="text-align: right; direction: rtl; font-family: sans-serif; min-width: 150px;">
          <strong style="color: #1f2937;">${entry.author_name}</strong>
          <span style="color: #9ca3af; font-size: 11px; margin-right: 6px;">${time}</span>
          <br/>
          <span style="color: #374151; font-size: 13px;">${entry.content || ''}</span>
          ${deleteButton}
        </div>
      `);
      
      marker.addTo(markersLayerRef.current);
    });
  }, [journal, onDeleteMarker]);

  // Update event location markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    // Remove old event markers
    eventMarkersRef.current.forEach(m => m.remove());
    eventMarkersRef.current = [];
    
    // Add new event markers
    eventLocations.forEach((eventLocation, idx) => {
      if (eventLocation && eventLocation.lat && eventLocation.lng) {
        const icon = L.divIcon({
          className: 'event-location-marker',
          html: `<div style="
            background: #ef4444;
            color: white;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            border: 4px solid white;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.5);
            cursor: pointer;
            animation: pulse 2s infinite;
          ">🚨</div>
          <style>
            @keyframes pulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.1); }
            }
          </style>`,
          iconSize: [50, 50],
          iconAnchor: [25, 25],
        });
        
        const marker = L.marker([eventLocation.lat, eventLocation.lng], { icon });
        
        const deleteButton = mode === 'delete' || onRemoveEventLocation 
          ? `<br/><button class="delete-event-location" data-location-id="${eventLocation.id}" style="background: #dc2626; color: white; padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 8px; width: 100%;">🗑️ מחק מיקום</button>`
          : '';
        
        marker.bindPopup(`
          <div style="text-align: right; direction: rtl; font-family: sans-serif; min-width: 200px;">
            <strong style="color: #ef4444; font-size: 16px;">🚨 מיקום אירוע ${eventLocations.length > 1 ? `#${idx + 1}` : ''}</strong>
            <br/>
            <span style="color: #374151; font-size: 13px;">${eventLocation.address || 'מיקום מדויק'}</span>
            <br/><br/>
            <a href="https://waze.com/ul?ll=${eventLocation.lat},${eventLocation.lng}&navigate=yes" target="_blank" style="background: #00d4ff; color: white; padding: 8px 16px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: bold;">
              🚗 נווט ב-Waze
            </a>
            ${deleteButton}
          </div>
        `);
        
        marker.addTo(mapInstanceRef.current);
        eventMarkersRef.current.push(marker);
      }
    });
    
    // Zoom to first event location only once when first location is added
    if (eventLocations.length > 0 && !hasZoomedToEventRef.current) {
      mapInstanceRef.current.setView([eventLocations[0].lat, eventLocations[0].lng], 17);
      hasZoomedToEventRef.current = true;
    }
  }, [eventLocations, mode, onRemoveEventLocation]);

  // Update road blocks
  useEffect(() => {
    if (!roadBlocksLayerRef.current) return;
    roadBlocksLayerRef.current.clearLayers();
    
    // Show permanent road blocks
    roadBlocks.forEach(block => {
      if (block.points && block.points.length >= 2) {
        const polyline = L.polyline(block.points, {
          color: '#dc2626',
          weight: 6,
          opacity: 0.8,
        });
        
        const deleteButton = onRemoveRoadBlock 
          ? `<br/><button class="delete-road-block" data-block-id="${block.id}" style="background: #dc2626; color: white; padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 8px; width: 100%;">🗑️ מחק חסימה</button>`
          : '';
        
        polyline.bindPopup(`
          <div style="text-align: right; direction: rtl; font-family: sans-serif; min-width: 150px;">
            <strong style="color: #dc2626;">🚧 חסימת כביש</strong>
            <br/>
            <span style="color: #374151; font-size: 12px;">${block.note || 'כביש חסום'}</span>
            ${deleteButton}
          </div>
        `);
        
        polyline.addTo(roadBlocksLayerRef.current);
      }
    });
    
    // Show temporary road block being drawn
    if (roadBlockPoints.length > 0) {
      // Show markers for each point
      roadBlockPoints.forEach((point, idx) => {
        const marker = L.circleMarker(point, {
          color: '#ea580c',
          fillColor: '#fb923c',
          fillOpacity: 0.8,
          radius: 8,
          weight: 3
        });
        marker.bindPopup(`<div style="text-align: center; font-weight: bold;">נקודה ${idx + 1}</div>`);
        marker.addTo(roadBlocksLayerRef.current);
      });
      
      // Show line if 2+ points
      if (roadBlockPoints.length >= 2) {
        const tempLine = L.polyline(roadBlockPoints, {
          color: '#ea580c',
          weight: 4,
          opacity: 0.6,
          dashArray: '10, 5'
        });
        tempLine.addTo(roadBlocksLayerRef.current);
      }
    }
  }, [roadBlocks, roadBlockPoints, onRemoveRoadBlock]);

  return (
    <div className="relative">
      {/* Search bar */}
      <div className="mb-3 flex gap-2" dir="rtl">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchAddress()}
            placeholder="🔍 חיפוש כתובת (לדוגמה: בן גוריון 5)"
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg z-[2000] max-h-60 overflow-auto">
              {searchResults.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => goToSearchResult(result)}
                  className="w-full text-right px-4 py-2 hover:bg-blue-50 text-sm border-b last:border-b-0"
                >
                  📍 {result.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={searchAddress}
          disabled={searching}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm font-bold"
        >
          {searching ? '...' : 'חפש'}
        </button>
      </div>

      {/* Mode selection - Compact */}
      {isActive && (
        <div className="mb-2 bg-gradient-to-r from-blue-50 to-purple-50 p-2 rounded-lg border border-blue-200" dir="rtl">
          <div className="text-xs font-bold text-gray-700 mb-1.5">⚡ פעולות מפה</div>
          <div className="grid grid-cols-3 gap-1.5">
            {onAddEventLocation && (
              <button
                onClick={() => setMode(mode === 'event_location' ? 'view' : 'event_location')}
                className={`p-2 rounded-lg font-bold text-[10px] transition-all ${
                  mode === 'event_location'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-white text-red-600 border border-red-500 hover:bg-red-50'
                }`}
              >
                <div className="text-lg mb-0.5">🚨</div>
                <div className="leading-tight">מיקום{eventLocations.length > 0 ? ` (${eventLocations.length})` : ''}</div>
              </button>
            )}
            {onAddRoadBlock && (
              <button
                onClick={() => {
                  if (mode === 'road_block') {
                    setMode('view');
                    roadBlockPointsRef.current = [];
                    setRoadBlockPoints([]);
                  } else {
                    setMode('road_block');
                  }
                }}
                className={`p-2 rounded-lg font-bold text-[10px] transition-all ${
                  mode === 'road_block'
                    ? 'bg-orange-600 text-white shadow-md'
                    : 'bg-white text-orange-600 border border-orange-500 hover:bg-orange-50'
                }`}
              >
                <div className="text-lg mb-0.5">🚧</div>
                <div className="leading-tight">{mode === 'road_block' ? 'ביטול' : 'חסימה'}</div>
              </button>
            )}
            {onAddMarker && (
              <button
                onClick={() => setMode(mode === 'marker' ? 'view' : 'marker')}
                className={`p-2 rounded-lg font-bold text-[10px] transition-all ${
                  mode === 'marker'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-blue-600 border border-blue-500 hover:bg-blue-50'
                }`}
              >
                <div className="text-lg mb-0.5">📍</div>
                <div className="leading-tight">סימון</div>
              </button>
            )}
          </div>
          
          {/* Road block actions - show only when points are marked */}
          {mode === 'road_block' && roadBlockPoints.length > 0 && (
            <div className="mt-2 p-2 bg-orange-100 rounded-lg border border-orange-300">
              <div className="text-xs font-bold text-orange-900 mb-1">
                ✨ סמן נקודות על הכביש החסום ({roadBlockPoints.length})
              </div>
              {roadBlockPoints.length >= 2 && (
                <button
                  onClick={() => {
                    setPendingAction({
                      type: 'road_block',
                      points: roadBlockPoints,
                    });
                    setTempName('חסימת כביש');
                    setShowNameModal(true);
                  }}
                  className="w-full p-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700"
                >
                  ✅ סיים וסמן חסימה
                </button>
              )}
              <button
                onClick={() => {
                  setMode('view');
                  roadBlockPointsRef.current = [];
                  setRoadBlockPoints([]);
                }}
                className="w-full mt-2 p-2 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700"
              >
                ❌ ביטול
              </button>
            </div>
          )}
        </div>
      )}

      <div className={`relative ${className}`} style={{ minHeight: className ? '500px' : 'auto' }}>
        <div
          ref={mapRef}
          style={{ width: '100%', height: className ? '100%' : '350px', borderRadius: '12px', border: '2px solid #e5e7eb' }}
        />
      </div>
      <div className="flex gap-3 mt-2 text-xs justify-center flex-wrap" dir="rtl">
        {eventLocations.length > 0 && (
          <div className="flex items-center gap-1.5 bg-red-50 px-2 py-1 rounded-lg">
            <div className="text-lg">🚨</div>
            <span className="font-bold text-red-600">
              {eventLocations.length} מיקום{eventLocations.length > 1 ? 'ים' : ''}
            </span>
          </div>
        )}
        {roadBlocks.length > 0 && (
          <div className="flex items-center gap-1.5 bg-orange-50 px-2 py-1 rounded-lg">
            <div className="w-6 h-1" style={{ background: '#dc2626' }} />
            <span className="font-bold text-orange-600">
              {roadBlocks.length} חסימ{roadBlocks.length > 1 ? 'ות' : 'ה'}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full" style={{ background: '#7c3aed', border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
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

      {/* Name Input Modal */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setShowNameModal(false)}>
          <div className="bg-white rounded-xl p-6 shadow-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">✏️ הוסף שם לסימון</h3>
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleNameConfirm();
                }
              }}
              className="w-full p-3 border-2 border-gray-300 rounded-lg text-right focus:border-blue-500 focus:outline-none"
              placeholder="הזן שם..."
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleNameConfirm}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-bold hover:bg-blue-700 transition-colors"
              >
                ✅ אישור
              </button>
              <button
                onClick={() => {
                  setShowNameModal(false);
                  setPendingAction(null);
                  setTempName('');
                }}
                className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg font-bold hover:bg-gray-600 transition-colors"
              >
                ❌ ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      <Toaster />
    </div>
  );
}
