'use client';

import { useState, useEffect, useRef } from 'react';
import { findNearestShelters } from '@/lib/distance';
import sheltersData from '@/data/shelters.json';
import streetsData from '@/data/streets.json';

export default function AddressInput({ value, onChange, onNearbySheltersChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [streetSuggestions, setStreetSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [shelters, setShelters] = useState(sheltersData);
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
  }, []);

  useEffect(() => {
    if (value && value.length >= 2) {
      const filtered = streetsData.filter(street => 
        street.includes(value) || value.split(' ').some(word => street.includes(word))
      ).slice(0, 8);
      setStreetSuggestions(filtered);
    } else {
      setStreetSuggestions([]);
    }
  }, [value]);

  const handleSearch = async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 3) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const firstResult = data[0];
        const userLat = parseFloat(firstResult.lat);
        const userLng = parseFloat(firstResult.lon);
        
        const nearest = findNearestShelters(userLat, userLng, shelters, 3);
        
        if (onNearbySheltersChange) {
          onNearbySheltersChange(nearest);
        }
        
        setSuggestions([]);
        setStreetSuggestions([]);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    const allSuggestions = [...streetSuggestions];
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < allSuggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < allSuggestions.length) {
        selectStreet(allSuggestions[selectedIndex]);
      } else {
        handleSearch(value);
      }
    } else if (e.key === 'Escape') {
      setStreetSuggestions([]);
      setSuggestions([]);
      setSelectedIndex(-1);
    }
  };

  const selectStreet = (street) => {
    onChange(street);
    setStreetSuggestions([]);
    setSelectedIndex(-1);
    handleSearch(street);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
        placeholder="הזן רחוב ומספר בית (לדוגמה: הרצל 15)"
      />
      
      {loading && (
        <div className="absolute left-3 top-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        </div>
      )}

      {streetSuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {streetSuggestions.map((street, index) => (
            <div
              key={index}
              onClick={() => selectStreet(street)}
              className={`px-4 py-3 cursor-pointer transition-colors ${
                index === selectedIndex
                  ? 'bg-blue-100 text-blue-900'
                  : 'hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">📍</span>
                <span className="font-medium">{street}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
