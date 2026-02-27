const fs = require('fs');
const path = require('path');

const API_KEY = 'AIzaSyBFHEh5vEiL57bG-q4TwfzbsFLmJRTKlmA';

const shelters = [
  { id: "shelter-102", number: "102", address: "אלפרט 5, יהוד" },
  { id: "shelter-104", number: "104", address: "טננבאום 13, יהוד" },
  { id: "shelter-106", number: "106", address: "מוהליבר 76, יהוד" },
  { id: "shelter-107", number: "107", address: "מוהליבר 106, יהוד" },
  { id: "shelter-108", number: "108", address: "בכור שיטרית 108, יהוד" },
  { id: "shelter-110", number: "110", address: "נורדאו 11, יהוד" },
  { id: "shelter-111", number: "111", address: "צוקרמן פינת קפלנסקי, יהוד" },
  { id: "shelter-302", number: "302", address: "גיורא 2, יהוד" },
  { id: "shelter-305", number: "305", address: "סעדיה חתוכה 25, יהוד" },
  { id: "shelter-311", number: "311", address: "פארק תל יהוד, יהוד" },
  { id: "shelter-312", number: "312", address: "אשכולית, יהוד" },
  { id: "shelter-501", number: "501", address: "יונה 7, יהוד" },
  { id: "shelter-502a", number: "502א", address: "יצחק שדה 11, יהוד" },
  { id: "shelter-502b", number: "502ב", address: "יצחק שדה 12, יהוד" },
  { id: "shelter-503", number: "503", address: "אנילביץ' פינת הרצל 17, יהוד" },
  { id: "shelter-504", number: "504", address: "גורדון 9, יהוד" },
  { id: "shelter-506", number: "506", address: "הורדים 34, יהוד" },
  { id: "shelter-701", number: "701", address: "פארק אוקלהומה, יהוד" },
  { id: "shelter-801", number: "801", address: "רחוב שוהם, נווה מונוסון" },
  { id: "shelter-802", number: "802", address: "שנהב 14, נווה מונוסון" },
  { id: "shelter-803", number: "803", address: "אלמוג 14, נווה מונוסון" },
  { id: "shelter-804", number: "804", address: "משלוק-אלמוג 1, נווה מונוסון" },
  { id: "shelter-805", number: "805", address: "אתרוג 7, נווה מונוסון" },
  { id: "shelter-806", number: "806", address: "הפנינים 5, נווה מונוסון" },
  { id: "shelter-807", number: "807", address: "גן המכשפות, נווה מונוסון" },
  { id: "protected-2501", number: "2501", address: "אברבנל, יהוד" },
  { id: "protected-2503", number: "2503", address: "רם כהן 5, יהוד" },
  { id: "protected-2504", number: "2504", address: "המתנ\"ס העירוני, יהוד" },
  { id: "protected-2505", number: "2505", address: "גן חזי, יהוד" },
  { id: "protected-2506", number: "2506", address: "מנהלת מונוסון, נווה מונוסון" },
  { id: "protected-2507", number: "2507", address: "דרך העצמאות 1, יהוד" },
  { id: "protected-2508", number: "2508", address: "סעדיה חתוכה, יהוד" },
  { id: "protected-2509", number: "2509", address: "השמחות, יהוד" }
];

async function geocodeWithGoogle(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address + ', ישראל')}&key=${API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng,
        formatted_address: data.results[0].formatted_address
      };
    } else {
      console.error(`  Status: ${data.status}`);
      return null;
    }
  } catch (error) {
    console.error(`  Error: ${error.message}`);
    return null;
  }
}

async function geocodeAllShelters() {
  console.log('🔍 מתחיל geocoding עם Google Maps API...\n');
  
  const results = [];
  let successCount = 0;
  
  for (const shelter of shelters) {
    console.log(`[${shelters.indexOf(shelter) + 1}/${shelters.length}] מקלט #${shelter.number}: ${shelter.address}`);
    
    const coords = await geocodeWithGoogle(shelter.address);
    
    if (coords) {
      console.log(`  ✅ ${coords.lat}, ${coords.lng}`);
      console.log(`  📍 ${coords.formatted_address}\n`);
      results.push({
        id: shelter.id,
        number: shelter.number,
        address: shelter.address,
        lat: coords.lat,
        lng: coords.lng,
        formatted_address: coords.formatted_address
      });
      successCount++;
    } else {
      console.log(`  ❌ לא נמצא\n`);
      results.push({
        id: shelter.id,
        number: shelter.number,
        address: shelter.address,
        lat: null,
        lng: null
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('\n📊 סיכום:');
  console.log(`✅ ${successCount}/${shelters.length} מקלטים עם קואורדינטות מדויקות`);
  console.log(`❌ ${shelters.length - successCount} לא נמצאו\n`);
  
  const outputPath = path.join(__dirname, '../data/google-coordinates.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
  
  console.log(`💾 הקובץ נשמר ב: ${outputPath}`);
}

geocodeAllShelters().catch(console.error);
