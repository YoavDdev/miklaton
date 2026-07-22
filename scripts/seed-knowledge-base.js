/**
 * Seed script for Knowledge Base
 * Run: node scripts/seed-knowledge-base.js
 * 
 * Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.resolve(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && !key.startsWith('#')) {
    process.env[key.trim()] = vals.join('=').trim();
  }
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const entries = [
  {
    title: 'גרירת רכבים נטושים',
    category: 'פיקוח',
    content: `נוהל גרירת רכבים נטושים - מידע למוקדנים:

חשוב: יש למלא את מספר הרכב בפנייה שנפתחת - זה חשוב לצורך מעקב.

מתי רכב נחשב נטוש:
- רכב שיש לו טסט או ביטוח או את שניהם - לא קשור לגרירה. רכב יכול להיחשב כנטוש למרות שיש לו טסט/ביטוח.
- גם רכב שיתופי (כמו אוטותל) יכול להיחשב כנטוש.
- רכב בשטח פרטי לא מגודר - העירייה רשאית לגרור ולהיכנס לשטח בשביל זה.

תהליך הגרירה:
1. פקח מדביק מדבקת רכב נטוש על הרכב.
2. המדבקה תקפה ל-7 ימים - לאחר מכן הרכב נכנס לתאריך גרירה ללא קשר למצבו.
3. גם אם הרכב זז 100 מטר לאחר ההדבקה - הוא עדיין נכנס לתאריך גרירה. חייב שהרכב יהיה ממש בשימוש כדי לבטל.
4. ברוב המקרים תושב מקבל מכתב בדואר רשום על כך שהולכים לגרור לו את הרכב.

מקרים מיוחדים:
- רכב ללא מספר רישוי בשני הצדדים - נגרר מידית!
- רכב שעבר תאונה והוא טוטאלוס - 48 שעות גרירה אחרי שפקח היה במקום.
- רכב של תושב יהוד-מונוסון - יהיה לפחות ניסיון אחד ליצור איתו קשר טלפוני. מאוד נדיר שלא.

שחרור רכב שנגרר:
- ניתן לשחרר את הרכב עם תשלום חד-פעמי + דמי אכסנה יומית.
- ליצירת קשר לשחרור: אשר כהן (גרר) - 050-2107481.

מה להגיד לתושב:
- לא לתת פרטים של הפקח הגורר.
- אם תושב רוצה לדבר עם הפקח - לפתוח פנייה לפקח הגורר ויחזרו אליו.
- ניתן לראות רכבים ותמונות בקבוצת WhatsApp: "רכבים נטושים ונגררים".`,
    tags: ['רכב', 'גרירה', 'נטוש', 'פקח', 'מדבקה', 'טוטאלוס'],
    contacts: [
      { name: 'אשר כהן', phone: '050-2107481', role: 'גרר' }
    ],
    created_by: 'מנהל מוקד'
  }
];

async function seed() {
  console.log('Seeding knowledge base...');
  
  for (const entry of entries) {
    const { data, error } = await supabase
      .from('knowledge_base')
      .insert(entry)
      .select()
      .single();

    if (error) {
      console.error(`Error inserting "${entry.title}":`, error.message);
    } else {
      console.log(`✓ Added: ${data.title}`);
    }
  }

  console.log('Done!');
}

seed().catch(console.error);
