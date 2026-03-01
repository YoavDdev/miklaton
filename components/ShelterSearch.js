'use client';

import { useState, useEffect, useRef } from 'react';
import { findNearestShelters } from '@/lib/distance';
import sheltersData from '@/data/shelters.json';
import streetsData from '@/data/streets.json';
import dynamic from 'next/dynamic';

const ShelterMap = dynamic(() => import('./ShelterMap'), { ssr: false });

export default function ShelterSearch() {
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [streetSuggestions, setStreetSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nearestShelters, setNearestShelters] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [shelters, setShelters] = useState(sheltersData);
  const [viewMode, setViewMode] = useState('list');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [shelterStatuses, setShelterStatuses] = useState({});
  const inputRef = useRef(null);

  useEffect(() => {
    const overrides = localStorage.getItem('shelterCoordinateOverrides');
    if (overrides) {
      try {
        const parsed = JSON.parse(overrides);
        const merged = sheltersData.map(shelter => ({
          ...shelter,
          ...(parsed[shelter.id] || {})
        }));
        setShelters(merged);
      } catch (e) {
        console.error('Failed to parse shelter overrides', e);
      }
    }
    
    // Load shelter statuses
    loadShelterStatuses();
    
    // Poll for status updates every 30 seconds
    const interval = setInterval(loadShelterStatuses, 30000);
    return () => clearInterval(interval);
  }, []);
  
  const loadShelterStatuses = async () => {
    try {
      const response = await fetch('/api/shelter-status');
      const data = await response.json();
      setShelterStatuses(data.statuses || {});
    } catch (error) {
      console.error('Error loading shelter statuses:', error);
    }
  };

  const searchAddress = async (query) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSuggestions(data.slice(0, 5));
    } catch (error) {
      console.error('Geocoding error:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (address.length >= 2) {
      const filtered = streetsData.filter(street => 
        street.includes(address) || address.split(' ').some(word => street.includes(word))
      ).slice(0, 8);
      setStreetSuggestions(filtered);
    } else {
      setStreetSuggestions([]);
    }
  }, [address]);

  const handleSearch = async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 3) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      console.log('Geocode response:', data);
      
      if (data && data.length > 0) {
        const firstResult = data[0];
        const userLat = parseFloat(firstResult.lat);
        const userLng = parseFloat(firstResult.lon);
        
        console.log('User location:', userLat, userLng);
        console.log('Display name:', firstResult.display_name);
        
        setSelectedLocation({
          lat: userLat,
          lng: userLng,
          displayName: firstResult.display_name,
        });
        
        const nearest = findNearestShelters(userLat, userLng, shelters, 3);
        
        console.log('Nearest shelters found:');
        nearest.forEach((shelter, i) => {
          console.log(`${i + 1}. ${shelter.name} (${shelter.number}) - ${shelter.address}`);
          console.log(`   Distance: ${(shelter.distance / 1000).toFixed(2)} km`);
          console.log(`   Coordinates: ${shelter.lat}, ${shelter.lng}`);
        });
        
        setNearestShelters(nearest);
        setSuggestions([]);
        setStreetSuggestions([]);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectLocation = (location) => {
    setSelectedLocation({
      lat: parseFloat(location.lat),
      lng: parseFloat(location.lon),
      displayName: location.display_name,
    });
    setAddress(location.display_name);
    setSuggestions([]);
    setStreetSuggestions([]);

    const nearest = findNearestShelters(
      parseFloat(location.lat),
      parseFloat(location.lon),
      shelters,
      3
    );
    setNearestShelters(nearest);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < streetSuggestions.length) {
        const selectedStreet = streetSuggestions[selectedIndex];
        setAddress(selectedStreet);
        setStreetSuggestions([]);
        handleSearch(selectedStreet);
      } else {
        handleSearch(address);
      }
      setSelectedIndex(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, streetSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Escape') {
      setStreetSuggestions([]);
      setSelectedIndex(-1);
    }
  };

  const selectStreet = (street) => {
    setAddress(street);
    setStreetSuggestions([]);
    handleSearch(street);
  };

  const handleRefresh = () => {
    setAddress('');
    setStreetSuggestions([]);
    setNearestShelters([]);
    setSelectedLocation(null);
    setViewMode('list');
    setSelectedIndex(-1);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const missingCoordinates = shelters.some(s => !s.lat || !s.lng);
  
  // Check if all public shelters are open
  const publicShelters = shelters.filter(s => s.shelterType === 'public');
  const openPublicShelters = publicShelters.filter(s => shelterStatuses[s.number]);
  const allPublicSheltersOpen = publicShelters.length > 0 && openPublicShelters.length === publicShelters.length;

  return (
    <div className="space-y-6">
      {allPublicSheltersOpen && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-4 rounded-xl shadow-lg border-2 border-green-300 animate-pulse">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="font-bold text-lg">✓ כל המקלטים הציבוריים ומוסדות החינוך פתוחים</p>
              <p className="text-sm text-green-100">ניתן להפנות תושבים למקלטים אלו</p>
            </div>
          </div>
        </div>
      )}
      {/* Search Box */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white rounded-full p-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">חיפוש מקלט</h3>
              <p className="text-sm text-gray-600">הזן כתובת למציאת מקלטים קרובים</p>
            </div>
          </div>
          {(nearestShelters.length > 0 || address) && (
            <button
              onClick={handleRefresh}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              title="רענן חיפוש"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              רענן
            </button>
          )}
        </div>
        
        <div className="relative">
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            📍
          </div>
          <input
            ref={inputRef}
            type="text"
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="לדוגמה: מוהליבר 46, הרצל 10, ביאליק..."
            className="w-full pr-12 pl-4 py-4 border-2 border-blue-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none text-lg bg-white shadow-sm transition-all"
          />
          {loading && (
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin h-6 w-6 border-3 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>

        {streetSuggestions.length > 0 && (
          <div className="mt-3 bg-white border-2 border-blue-200 rounded-xl shadow-xl max-h-80 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-2 text-white text-sm font-semibold">
              רחובות ביהוד-מונוסון ({streetSuggestions.length})
            </div>
            <div className="overflow-y-auto max-h-72">
              {streetSuggestions.map((street, index) => (
                <button
                  key={`street-${index}`}
                  onClick={() => selectStreet(street)}
                  className={`w-full text-right px-5 py-3 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 border-b border-gray-100 last:border-0 transition-all ${
                    selectedIndex === index ? 'bg-gradient-to-r from-blue-100 to-indigo-100 border-r-4 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-blue-500 text-xl">📍</span>
                    <span className="text-gray-900 font-medium text-lg">{street}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 text-sm text-blue-700 bg-blue-50 px-4 py-3 rounded-lg border border-blue-200">
          <span className="text-lg">⌨️</span>
          <div>
            <strong>טיפים:</strong> השתמש ב-↑↓ לניווט, Enter לחיפוש, Esc לסגירה
          </div>
        </div>
      </div>

      {missingCoordinates && (
        <div className="p-4 bg-yellow-50 border-r-4 border-yellow-500 rounded">
          <p className="text-yellow-800 font-semibold">
            ⚠️ חסרות קואורדינטות לחלק מהמקלטים - עדכן דרך דף האדמין או קובץ JSON
          </p>
        </div>
      )}

      {nearestShelters.length > 0 && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-green-500 text-white rounded-full p-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    נמצאו {nearestShelters.length} מקלטים קרובים
                  </h3>
                  <p className="text-sm text-gray-600">ממוינים לפי מרחק מהכתובת</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all shadow-sm ${
                    viewMode === 'list'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md scale-105'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  📋 רשימה
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all shadow-sm ${
                    viewMode === 'map'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md scale-105'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  🗺️ מפה
                </button>
              </div>
            </div>
          </div>

          {viewMode === 'map' ? (
            <ShelterMap 
              shelters={shelters}
              userLocation={selectedLocation}
              nearestShelters={nearestShelters}
              shelterStatuses={shelterStatuses}
            />
          ) : (
            nearestShelters.map((shelter, index) => (
              <div key={shelter.id} className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 hover:border-blue-400 rounded-xl p-5 shadow-md hover:shadow-xl transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <div className={`flex items-center justify-center w-14 h-14 rounded-full font-bold text-white text-xl shadow-lg ${
                      index === 0 ? 'bg-gradient-to-br from-green-500 to-emerald-600' :
                      index === 1 ? 'bg-gradient-to-br from-blue-500 to-indigo-600' :
                      'bg-gradient-to-br from-purple-500 to-pink-600'
                    }`}>
                      #{index + 1}
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-900">{shelter.name}</h4>
                      {shelter.number && (
                        <p className="text-sm text-gray-500 font-medium">מקלט מספר: {shelter.number}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-center bg-green-100 px-4 py-2 rounded-lg border-2 border-green-300">
                    <div className="text-2xl font-bold text-green-700">{Math.round(shelter.distance)}</div>
                    <div className="text-xs font-semibold text-green-600">מטרים</div>
                  </div>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2 text-gray-800">
                    <span className="text-blue-500 text-xl">📍</span>
                    <span className="font-medium">{shelter.address}</span>
                  </div>
                </div>
                
                {shelter.shelterType === 'public' && (
                  <div className={`px-4 py-2 rounded-lg font-bold text-sm mb-3 ${
                    shelterStatuses[shelter.number]
                      ? 'bg-green-100 text-green-800 border-2 border-green-400'
                      : 'bg-gray-100 text-gray-600 border-2 border-gray-300'
                  }`}>
                    {shelterStatuses[shelter.number] ? '✓ מקלט פתוח' : '✕ מקלט סגור - דורש אישור'}
                  </div>
                )}
                
                {shelter.notes && (
                  <div className="mt-3 text-sm text-gray-700 bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                    <span className="font-semibold text-yellow-700">💡 הערה:</span> {shelter.notes}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {selectedLocation && nearestShelters.length === 0 && (
        <div className="p-4 bg-red-50 border-r-4 border-red-500 rounded">
          <p className="text-red-800 font-semibold">
            לא נמצאו מקלטים עם קואורדינטות. יש לעדכן את קואורדינטות המקלטים.
          </p>
        </div>
      )}
    </div>
  );
}
