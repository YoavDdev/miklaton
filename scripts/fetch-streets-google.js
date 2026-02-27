const fs = require('fs');
const path = require('path');

const API_KEY = 'AIzaSyBFHEh5vEiL57bG-q4TwfzbsFLmJRTKlmA';

// מרכז יהוד-מונוסון
const CENTER_LAT = 32.0320;
const CENTER_LNG = 34.8890;
const RADIUS = 3000; // 3 ק"מ רדיוס

async function fetchStreetsFromShelters() {
  console.log('🏠 מחלץ רחובות מכתובות המקלטים הקיימות...\n');
  
  const sheltersPath = path.join(__dirname, '../data/shelters.json');
  const shelters = JSON.parse(fs.readFileSync(sheltersPath, 'utf-8'));
  
  const streets = new Set();
  
  shelters.forEach(shelter => {
    const address = shelter.address;
    // חילוץ שם הרחוב (לפני המספר או הפסיק)
    const match = address.match(/^([א-ת\s"'-]+?)(?:\s+\d+|,)/);
    if (match) {
      const street = match[1].trim();
      if (street && street !== 'פארק' && street !== 'גן') {
        streets.add(street);
      }
    }
  });
  
  console.log(`✅ נמצאו ${streets.size} רחובות מהמקלטים\n`);
  return Array.from(streets).sort();
}

async function geocodeLocation(query) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query + ', יהוד-מונוסון, ישראל')}&key=${API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results.length > 0) {
      return data.results;
    }
    return [];
  } catch (error) {
    console.error(`Error geocoding ${query}:`, error);
    return [];
  }
}

async function searchNearbyPlaces() {
  console.log('🔍 מחפש מקומות באזור יהוד-מונוסון...\n');
  
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${CENTER_LAT},${CENTER_LNG}&radius=${RADIUS}&type=premise&key=${API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK') {
      const streets = new Set();
      
      data.results.forEach(place => {
        if (place.vicinity) {
          // חילוץ שם רחוב מהכתובת
          const match = place.vicinity.match(/([א-ת\s"'-]+?)(?:\s+\d+|,|$)/);
          if (match) {
            const street = match[1].trim();
            if (street.length > 2 && !street.includes('יהוד') && !street.includes('מונוסון')) {
              streets.add(street);
            }
          }
        }
      });
      
      console.log(`✅ נמצאו ${streets.size} רחובות מ-Places API\n`);
      return Array.from(streets);
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching places:', error);
    return [];
  }
}

async function reverseGeocodeArea() {
  console.log('📍 מבצע reverse geocoding באזור...\n');
  
  const streets = new Set();
  const gridPoints = [];
  
  // יצירת רשת נקודות באזור
  const step = 0.005; // כ-500 מטר
  for (let lat = CENTER_LAT - 0.02; lat <= CENTER_LAT + 0.02; lat += step) {
    for (let lng = CENTER_LNG - 0.02; lng <= CENTER_LNG + 0.02; lng += step) {
      gridPoints.push({ lat, lng });
    }
  }
  
  console.log(`בודק ${gridPoints.length} נקודות...\n`);
  
  for (let i = 0; i < Math.min(gridPoints.length, 20); i++) {
    const point = gridPoints[i];
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${point.lat},${point.lng}&key=${API_KEY}&language=he`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        data.results.forEach(result => {
          result.address_components.forEach(component => {
            if (component.types.includes('route')) {
              const street = component.long_name;
              if (street && /^[א-ת]/.test(street)) {
                streets.add(street);
              }
            }
          });
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Error:', error);
    }
  }
  
  console.log(`✅ נמצאו ${streets.size} רחובות מ-reverse geocoding\n`);
  return Array.from(streets);
}

async function fetchAllStreets() {
  console.log('🗺️ מתחיל לחלץ רחובות מיהוד-מונוסון...\n');
  
  const allStreets = new Set();
  
  // 1. רחובות מהמקלטים
  const shelterStreets = await fetchStreetsFromShelters();
  shelterStreets.forEach(s => allStreets.add(s));
  
  // 2. Reverse geocoding
  const reverseStreets = await reverseGeocodeArea();
  reverseStreets.forEach(s => allStreets.add(s));
  
  // 3. רחובות נוספים ידועים (בדיקה)
  const knownStreets = ['הרצל', 'ביאליק', 'נורדאו', 'גורדון', 'מוהליבר', 'האצ"ל'];
  for (const street of knownStreets) {
    const results = await geocodeLocation(street);
    if (results.length > 0) {
      results.forEach(result => {
        result.address_components.forEach(component => {
          if (component.types.includes('route')) {
            allStreets.add(component.long_name);
          }
        });
      });
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // ניקוי והסרת כפילויות
  const finalStreets = Array.from(allStreets)
    .filter(street => {
      // הסרת שמות שאינם רחובות
      return street.length >= 3 && 
             !street.includes('יהוד') && 
             !street.includes('מונוסון') &&
             !street.includes('Israel') &&
             /^[א-ת]/.test(street);
    })
    .sort((a, b) => a.localeCompare(b, 'he'));
  
  console.log('\n📊 סיכום:');
  console.log(`✅ סה"כ ${finalStreets.length} רחובות ייחודיים\n`);
  
  // שמירה
  const outputPath = path.join(__dirname, '../data/streets.json');
  fs.writeFileSync(outputPath, JSON.stringify(finalStreets, null, 2), 'utf-8');
  
  console.log(`💾 הקובץ נשמר ב: ${outputPath}\n`);
  console.log('📋 דוגמאות:');
  finalStreets.slice(0, 10).forEach(street => console.log(`  - ${street}`));
  
  return finalStreets;
}

fetchAllStreets().catch(console.error);
