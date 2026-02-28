const fs = require('fs');
const path = require('path');

// Public shelters provided by user
const publicShelters = [
  {
    number: "1001",
    name: "בי\"ס יגאל אלון",
    address: "בן צבי 12, יהוד",
    type: "מוסד חינוך",
    shelterType: "public",
    requiresApproval: true,
    lat: 32.030227,
    lng: 34.894365
  },
  {
    number: "1002",
    name: "בי\"ס רמז",
    address: "סירקין 8, יהוד",
    type: "מוסד חינוך",
    shelterType: "public",
    requiresApproval: true,
    lat: 32.032993,
    lng: 34.894568
  },
  {
    number: "1003",
    name: "טננבאום (מתחם הצופים)",
    address: "טננבאום 15 ומרח' האצ\"ל, יהוד",
    type: "מוסד חינוך",
    shelterType: "public",
    requiresApproval: true,
    lat: 32.170437,
    lng: 34.831781
  },
  {
    number: "1004",
    name: "מתחם גני ילדים",
    address: "מוהליבר 40 (גן שמאלי שורה א), יהוד",
    type: "מוסד חינוך",
    shelterType: "public",
    requiresApproval: true,
    lat: 32.032517,
    lng: 34.897853
  },
  {
    number: "1005",
    name: "תיכון מקיף יהוד",
    address: "סמטת יהונתן 1, יהוד",
    type: "מוסד חינוך",
    shelterType: "public",
    requiresApproval: true,
    lat: 32.039905,
    lng: 34.892733
  },
  {
    number: "1006",
    name: "מקווה יהודה מועצה דתית",
    address: "צבי ישי 10, יהוד",
    type: "מקלט פרטי",
    shelterType: "public",
    requiresApproval: true,
    notes: "מקלט פרטי - תושבים יכולים להגיע",
    lat: 32.032384,
    lng: 34.889384
  },
  {
    number: "1007",
    name: "גיורא",
    address: "שכ' גיורא א' צבי ישי מאחורי קופ\"ח, יהוד",
    type: "מקלט פרטי",
    shelterType: "public",
    requiresApproval: true,
    notes: "מקלט פרטי - תושבים יכולים להגיע",
    lat: 32.032843,
    lng: 34.889932
  },
  {
    number: "1008",
    name: "בי\"ס יהודה הלוי (אולם ספורט)",
    address: "כניסה מרח' ביאקובסקי 20, יהוד",
    type: "מוסד חינוך",
    shelterType: "public",
    requiresApproval: true,
    lat: 32.033695,
    lng: 34.891181
  },
  {
    number: "1009",
    name: "גן אלון וכלנית (הג\"א)",
    address: "חנה סנש 12, יהוד",
    type: "מוסד חינוך",
    shelterType: "public",
    requiresApproval: true,
    lat: 32.036465,
    lng: 34.889749
  },
  {
    number: "1010",
    name: "גן אשל",
    address: "ביל\"ו 3, יהוד",
    type: "מוסד חינוך",
    shelterType: "public",
    requiresApproval: true,
    lat: 32.028838,
    lng: 34.888163
  },
  {
    number: "1011",
    name: "גן הדר",
    address: "קדושי מצרים 32, יהוד",
    type: "מוסד חינוך",
    shelterType: "public",
    requiresApproval: true,
    lat: 32.034514,
    lng: 34.892348
  },
  {
    number: "1012",
    name: "גן לוטם וחצב",
    address: "סעדיה חתוכה 42, יהוד",
    type: "מוסד חינוך",
    shelterType: "public",
    requiresApproval: true,
    lat: 32.031952,
    lng: 34.888620
  },
  {
    number: "1013",
    name: "גן אשכולית (גן שקד יהונתן ישן)",
    address: "חצר אחורית בילו מתוך שפ\"ח ישן, יהוד",
    type: "מוסד חינוך",
    shelterType: "public",
    requiresApproval: true,
    lat: 32.031698,
    lng: 34.883859
  },
  {
    number: "1014",
    name: "גן שרה וארז",
    address: "הרצל 22, יהוד",
    type: "מוסד חינוך",
    shelterType: "public",
    requiresApproval: true,
    lat: 32.033674,
    lng: 34.886202
  },
  {
    number: "1015",
    name: "בי\"ס הרצל",
    address: "הכניסה מרח' ז'בוטינסקי 28, יהוד",
    type: "מוסד חינוך",
    shelterType: "public",
    requiresApproval: true,
    lat: 32.034495,
    lng: 34.884246
  },
  {
    number: "1016",
    name: "מקלט קניון סביונים",
    address: "משה דיין 3 (בין כל שתי קומות), יהוד",
    type: "מקלט פרטי",
    shelterType: "public",
    requiresApproval: true,
    notes: "מקלט פרטי - תושבים יכולים להגיע",
    lat: 32.030314,
    lng: 34.878566
  },
  {
    number: "1017",
    name: "מתחם אשכנזי",
    address: "מתחם אשכנזי (שני ממ\"ד בכל צד אחד), יהוד",
    type: "מקלט פרטי",
    shelterType: "public",
    requiresApproval: true,
    notes: "מקלט פרטי - תושבים יכולים להגיע",
    lat: 32.029866,
    lng: 34.890966
  },
  {
    number: "1018",
    name: "מקלט ביג",
    address: "מתחם ביג (קומה שניה בגב החנויות), יהוד",
    type: "מקלט פרטי",
    shelterType: "public",
    requiresApproval: true,
    notes: "מקלט פרטי - תושבים יכולים להגיע",
    lat: 32.025694,
    lng: 34.900853
  },
  {
    number: "1019",
    name: "בנק הפועלים",
    address: "שקד 30, יהוד",
    type: "מקלט פרטי",
    shelterType: "public",
    requiresApproval: true,
    notes: "מקלט פרטי - תושבים יכולים להגיע",
    lat: 32.029221,
    lng: 34.873971
  },
  {
    number: "1020",
    name: "מרכז מסחרי מונוסון",
    address: "שוהם פינת פנינים, מונוסון",
    type: "מקלט פרטי",
    shelterType: "public",
    requiresApproval: true,
    notes: "מקלט פרטי - תושבים יכולים להגיע",
    lat: 32.029299,
    lng: 34.873702
  },
  {
    number: "309",
    name: "מקלט 309",
    address: "קדושי מיצרים 31, יהוד",
    type: "מקלט",
    shelterType: "public",
    requiresApproval: true,
    lat: 32.034455,
    lng: 34.892144
  },
  {
    number: "1021",
    name: "ביה\"ס היובל",
    address: "יהוד",
    type: "מוסד חינוך",
    shelterType: "public",
    requiresApproval: true,
    lat: 32.033566,
    lng: 34.878118
  },
  {
    number: "1022",
    name: "גני חב\"ד",
    address: "יהוד",
    type: "מוסד חינוך",
    shelterType: "public",
    requiresApproval: true,
    lat: 32.031856,
    lng: 34.893157
  },
  {
    number: "1023",
    name: "חטיבה סביונים",
    address: "יהוד",
    type: "מוסד חינוך",
    shelterType: "public",
    requiresApproval: true,
    lat: 32.029656,
    lng: 34.879200
  },
  {
    number: "1024",
    name: "חטיבה פסגות",
    address: "יהוד",
    type: "מוסד חינוך",
    shelterType: "public",
    requiresApproval: true,
    lat: 32.029659,
    lng: 34.880171
  }
];

function addPublicShelters() {
  console.log('🏫 מוסיף מקלטים ציבוריים...\n');
  
  const sheltersPath = path.join(__dirname, '../data/shelters.json');
  const shelters = JSON.parse(fs.readFileSync(sheltersPath, 'utf-8'));
  
  let addedCount = 0;
  
  for (const shelter of publicShelters) {
    // Check if shelter already exists
    const exists = shelters.find(s => s.number === shelter.number);
    
    if (exists) {
      console.log(`⚠️  מקלט ${shelter.number} כבר קיים - מדלג`);
      continue;
    }
    
    const newShelter = {
      id: `shelter-${shelter.number}`,
      number: shelter.number,
      type: shelter.type,
      name: shelter.name,
      address: shelter.address,
      neighborhood: "יהוד-מונוסון",
      landmarks: "",
      directions: "",
      accessibility: "נגיש",
      capacity: 100,
      lat: shelter.lat,
      lng: shelter.lng,
      shelterType: shelter.shelterType,
      requiresApproval: shelter.requiresApproval,
      notes: shelter.notes || ""
    };
    
    shelters.push(newShelter);
    console.log(`✅ ${shelter.name} (${shelter.number})`);
    addedCount++;
  }
  
  console.log(`\n✅ נוספו ${addedCount} מקלטים ציבוריים`);
  console.log(`📊 סה\"כ מקלטים במערכת: ${shelters.length}`);
  
  fs.writeFileSync(sheltersPath, JSON.stringify(shelters, null, 2), 'utf-8');
  console.log(`💾 הקובץ נשמר ב: ${sheltersPath}`);
}

addPublicShelters();
