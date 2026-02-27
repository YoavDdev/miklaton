const fs = require('fs');
const path = require('path');

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

async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ', יהוד-מונוסון, ישראל')}&format=json&limit=1`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Miklaton Shelter Coordinate Updater'
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error geocoding ${address}:`, error);
    return null;
  }
}

async function updateCoordinates() {
  console.log('🔍 מתחיל לחלץ קואורדינטות מדויקות...\n');
  
  const results = [];
  
  for (const shelter of shelters) {
    console.log(`מעבד: ${shelter.address} (מקלט #${shelter.number})...`);
    const coords = await geocodeAddress(shelter.address);
    
    if (coords) {
      console.log(`✅ נמצא: ${coords.lat}, ${coords.lng}`);
      results.push({
        id: shelter.id,
        number: shelter.number,
        address: shelter.address,
        ...coords
      });
    } else {
      console.log(`❌ לא נמצא`);
      results.push({
        id: shelter.id,
        number: shelter.number,
        address: shelter.address,
        lat: null,
        lng: null
      });
    }
  }
  
  console.log('\n📝 שומר תוצאות...');
  
  const outputPath = path.join(__dirname, '../data/shelter-coordinates-updated.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
  
  console.log(`\n✅ סיימתי! הקובץ נשמר ב: ${outputPath}`);
  console.log(`\nסך הכל: ${results.filter(r => r.lat).length}/${results.length} מקלטים עם קואורדינטות`);
}

updateCoordinates().catch(console.error);
