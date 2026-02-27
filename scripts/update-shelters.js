const fs = require('fs');
const path = require('path');

const API_KEY = 'AIzaSyBFHEh5vEiL57bG-q4TwfzbsFLmJRTKlmA';

// Updated shelter addresses from user
const shelterUpdates = [
  { number: "502א", address: "Yitshak Sadeh St 11, Yehud-Monosson, Israel" },
  { number: "804", address: "Ya'alom 1, Yehud-Monosson, Israel" },
  { number: "504", address: "Gordon St 9, Yehud-Monosson, Israel" },
  { number: "312", address: "Bilu St 4, Yehud-Monosson, Israel" },
  { number: "2506", address: "Almog St 1, Yehud-Monosson, Israel" },
  { number: "102", address: "Alpert St 5, Yehud-Monosson, Israel" },
  { number: "104", address: "Tenenbaum St 13, Yehud-Monosson, Israel" },
  { number: "805", address: "Etrog St 7, Yehud-Monosson, Israel" },
  { number: "311", address: "Marvad ha-Ksamim St, Yehud-Monosson, Israel", lat: 32.031701, lng: 34.890833 },
  { number: "501", address: "Brener St 17, Yehud-Monosson, Israel" },
  { number: "2509", address: "Moshe Dayan, Yehud-Monosson, Israel", lat: 32.031493, lng: 34.877229 },
  { number: "2508", address: "Se'adya Khatuka St, Yehud-Monosson, Israel", lat: 32.031734, lng: 34.888465 },
  { number: "806", address: "Pninim St 5, Yehud-Monosson, Israel" },
  { number: "106", address: "Mohaliver St 76, Yehud-Monosson, Israel" },
  { number: "107", address: "Mohaliver St 107, Yehud-Monosson, Israel" },
  { number: "502ב", address: "Yitshak Sadeh St 14-22, Yehud-Monosson, Israel" },
  { number: "302", address: "Baikowski St 16, Yehud-Monosson, Israel" },
  { number: "506", address: "Havradim St 41, Yehud-Monosson, Israel" },
  { number: "110", address: "Nordau St 13, Yehud-Monosson, Israel" },
  { number: "111", address: "Zuckerman St 111, Yehud-Monosson, Israel" },
  { number: "701", address: "Oklahoma Park, Yehud-Monosson, Israel", lat: 32.038290, lng: 34.885978 },
  { number: "2503", address: "Mevo Natan Yonatan 1, Yehud-Monosson, Israel" },
  { number: "802", address: "Shenhav St 16, Yehud-Monosson, Israel" },
  { number: "2505", address: "Rimon St 126, Yehud-Monosson, Israel" },
  { number: "503", address: "Herzl St 17, Yehud-Monosson, Israel" },
  { number: "2501", address: "Abarbanel St, Yehud-Monosson, Israel", lat: 32.033371, lng: 34.888915 },
  { number: "2507", address: "Derech HaAtsma'ut 1, Yehud-Monosson, Israel" },
  { number: "801", address: "Shoham St, Yehud-Monosson, Israel", lat: 32.029189, lng: 34.872382 },
  { number: "108", address: "Bakhor Shitrit St 108, Yehud-Monosson, Israel" },
  { number: "803", address: "Almog St 14, Yehud-Monosson, Israel" },
  { number: "807", address: "Pninim St 14, Yehud-Monosson, Israel" },
  { number: "305", address: "Se'adya Khatuka St 25, Yehud-Monosson, Israel" },
  { number: "2504", address: "Ram Cohen St 2, Yehud-Monosson, Israel" }
];

async function geocodeAddress(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
  
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
      console.error(`  ❌ Failed for ${address}: ${data.status}`);
      return null;
    }
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return null;
  }
}

async function updateShelters() {
  console.log('🔄 מעדכן קואורדינטות מקלטים...\n');
  
  const sheltersPath = path.join(__dirname, '../data/shelters.json');
  const shelters = JSON.parse(fs.readFileSync(sheltersPath, 'utf-8'));
  
  let updatedCount = 0;
  
  for (const update of shelterUpdates) {
    const shelterIndex = shelters.findIndex(s => s.number === update.number);
    
    if (shelterIndex === -1) {
      console.log(`⚠️  לא נמצא מקלט מספר ${update.number}`);
      continue;
    }
    
    console.log(`[${updatedCount + 1}/${shelterUpdates.length}] מקלט ${update.number}: ${update.address}`);
    
    let coords;
    
    // If user provided coordinates, use them
    if (update.lat && update.lng) {
      coords = { lat: update.lat, lng: update.lng };
      console.log(`  ✅ משתמש בקואורדינטות שסופקו: ${coords.lat}, ${coords.lng}`);
    } else {
      // Otherwise geocode
      coords = await geocodeAddress(update.address);
      if (coords) {
        console.log(`  ✅ ${coords.lat}, ${coords.lng}`);
      }
      await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
    }
    
    if (coords) {
      shelters[shelterIndex].lat = coords.lat;
      shelters[shelterIndex].lng = coords.lng;
      // Keep Hebrew address but add note about English source
      shelters[shelterIndex].address_en = update.address;
      updatedCount++;
    }
  }
  
  console.log(`\n✅ עודכנו ${updatedCount}/${shelterUpdates.length} מקלטים`);
  
  fs.writeFileSync(sheltersPath, JSON.stringify(shelters, null, 2), 'utf-8');
  console.log(`💾 הקובץ נשמר ב: ${sheltersPath}`);
}

updateShelters().catch(console.error);
