const fs = require('fs');
const path = require('path');

// גבולות יהוד-מונוסון (קואורדינטות מקירוב)
const BBOX = {
  south: 32.020,  // דרום
  north: 32.045,  // צפון
  west: 34.865,   // מערב
  east: 34.900    // מזרח
};

async function fetchStreetsFromOSM() {
  console.log('🗺️ מחלץ רחובות מ-OpenStreetMap...\n');
  
  // Overpass API query - מחפש את כל הדרכים (ways) עם שם בתוך הגבולות
  const query = `
    [out:json][timeout:25];
    (
      way["highway"]["name"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
    );
    out body;
    >;
    out skel qt;
  `;
  
  const url = 'https://overpass-api.de/api/interpreter';
  
  try {
    console.log('שולח שאילתא ל-Overpass API...');
    const response = await fetch(url, {
      method: 'POST',
      body: query,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    const streets = new Set();
    
    // חילוץ שמות הרחובות
    data.elements.forEach(element => {
      if (element.tags && element.tags.name) {
        const name = element.tags.name;
        
        // סינון - רק שמות בעברית ורלוונטיים
        if (/[\u0590-\u05FF]/.test(name)) { // בדיקה אם יש תווים עבריים
          // הסרת קידומות מיותרות
          let cleanName = name
            .replace(/^רחוב\s+/i, '')
            .replace(/^שדרות\s+/i, '')
            .replace(/^דרך\s+/i, '')
            .trim();
          
          if (cleanName.length >= 2) {
            streets.add(cleanName);
          }
        }
      }
    });
    
    console.log(`\n✅ נמצאו ${streets.size} רחובות מ-OpenStreetMap\n`);
    
    // המרה למערך ממוין
    const sortedStreets = Array.from(streets).sort((a, b) => a.localeCompare(b, 'he'));
    
    // שמירה לקובץ
    const outputPath = path.join(__dirname, '../data/streets.json');
    fs.writeFileSync(outputPath, JSON.stringify(sortedStreets, null, 2), 'utf-8');
    
    console.log(`💾 נשמר ב: ${outputPath}\n`);
    console.log('📋 דוגמאות מהרחובות שנמצאו:');
    sortedStreets.slice(0, 20).forEach((street, i) => {
      console.log(`  ${i + 1}. ${street}`);
    });
    
    if (sortedStreets.length > 20) {
      console.log(`  ... ועוד ${sortedStreets.length - 20} רחובות נוספים`);
    }
    
    return sortedStreets;
  } catch (error) {
    console.error('❌ שגיאה:', error.message);
    throw error;
  }
}

fetchStreetsFromOSM().catch(console.error);
