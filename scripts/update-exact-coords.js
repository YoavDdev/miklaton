const fs = require('fs');
const path = require('path');

// Exact coordinates provided by user
const exactCoordinates = [
  { number: "502א", lat: 32.030580, lng: 34.885023 },
  { number: "804", lat: 32.032339, lng: 34.870205 },
  { number: "504", lat: 32.031605, lng: 34.884078 },
  { number: "312", lat: 32.028827, lng: 34.888007 },
  { number: "2506", lat: 32.032333, lng: 34.870187 },
  { number: "102", lat: 32.034386, lng: 34.895142 },
  { number: "104", lat: 32.035492, lng: 34.895694 },
  { number: "805", lat: 32.026817, lng: 34.876233 },
  { number: "311", lat: 32.031701, lng: 34.890833 },
  { number: "501", lat: 32.029186, lng: 34.883825 },
  { number: "2509", lat: 32.031493, lng: 34.877229 },
  { number: "2508", lat: 32.031734, lng: 34.888465 },
  { number: "806", lat: 32.030191, lng: 34.871139 },
  { number: "106", lat: 32.035738, lng: 34.897902 },
  { number: "107", lat: 32.038502, lng: 34.897239 },
  { number: "502ב", lat: 32.030251, lng: 34.884556 },
  { number: "302", lat: 32.033773, lng: 34.890476 },
  { number: "506", lat: 32.033565, lng: 34.882453 },
  { number: "110", lat: 32.029461, lng: 34.894807 },
  { number: "111", lat: 32.039842, lng: 34.894846 },
  { number: "701", lat: 32.038290, lng: 34.885978 },
  { number: "2503", lat: 32.040449, lng: 34.892527 },
  { number: "802", lat: 32.028593, lng: 34.868187 },
  { number: "2505", lat: 32.030412, lng: 34.875086 },
  { number: "503", lat: 32.033186, lng: 34.885769 },
  { number: "2501", lat: 32.033371, lng: 34.888915 },
  { number: "2507", lat: 32.027945, lng: 34.881962 },
  { number: "801", lat: 32.029189, lng: 34.872382 },
  { number: "108", lat: 32.032048, lng: 34.895094 },
  { number: "803", lat: 32.031742, lng: 34.868932 },
  { number: "807", lat: 32.030910, lng: 34.871364 },
  { number: "305", lat: 32.030173, lng: 34.888656 },
  { number: "2504", lat: 32.038975, lng: 34.892139 }
];

function updateExactCoordinates() {
  console.log('🎯 מעדכן קואורדינטות מדויקות...\n');
  
  const sheltersPath = path.join(__dirname, '../data/shelters.json');
  const shelters = JSON.parse(fs.readFileSync(sheltersPath, 'utf-8'));
  
  let updatedCount = 0;
  
  for (const coords of exactCoordinates) {
    const shelterIndex = shelters.findIndex(s => s.number === coords.number);
    
    if (shelterIndex === -1) {
      console.log(`⚠️  לא נמצא מקלט מספר ${coords.number}`);
      continue;
    }
    
    const shelter = shelters[shelterIndex];
    const oldLat = shelter.lat;
    const oldLng = shelter.lng;
    
    shelters[shelterIndex].lat = coords.lat;
    shelters[shelterIndex].lng = coords.lng;
    
    console.log(`✅ מקלט ${coords.number}: ${shelter.name}`);
    console.log(`   ${oldLat}, ${oldLng} → ${coords.lat}, ${coords.lng}`);
    
    updatedCount++;
  }
  
  console.log(`\n✅ עודכנו ${updatedCount}/${exactCoordinates.length} מקלטים`);
  
  fs.writeFileSync(sheltersPath, JSON.stringify(shelters, null, 2), 'utf-8');
  console.log(`💾 הקובץ נשמר ב: ${sheltersPath}`);
}

updateExactCoordinates();
