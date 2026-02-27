# מקלטון (Miklaton)

מערכת ניהול אירועי חירום פנימית למוקד העירוני יהוד-מונוסון.

## תיאור המערכת

מקלטון היא אפליקציית Next.js המיועדת לסייע למפעילי המוקד העירוני במהלך אירועי חירום (אזעקות טילים ורעידות אדמה). המערכת מספקת:

- **ניהול נהלי תפעול** - הדרכה שלב-אחר-שלב למפעילים במהלך אירועי חירום
- **חיפוש מקלטים** - מציאת מקלטים ציבוריים הכי קרובים לתושבים לפי כתובת
- **ניהול אנשי קשר** - רשימת אנשי קשר תורנים עם גישה מהירה
- **תיעוד אירועים** - לוג מפורט של כל פעולה במהלך אירוע עם אפשרות ייצוא

## דרישות מערכת

- Node.js 18+ (מומלץ 20+)
- חיבור לאינטרנט (נדרש לגיאוקודינג)
- דפדפן מודרני (Chrome, Firefox, Safari, Edge)

## התקנה והרצה מקומית

### 1. התקנת תלויות

```bash
cd miklaton
npm install
```

### 2. הגדרת משתני סביבה

צור קובץ `.env.local` בשורש הפרויקט:

```bash
cp .env.example .env.local
```

ערוך את הקובץ `.env.local` והגדר את המשתנים הבאים:

```env
# סיסמה משותפת למפעילים
APP_PASSWORD=your_secure_operator_password

# סיסמה נפרדת לאדמין
ADMIN_PASSWORD=your_secure_admin_password

# מפתח חשאי ל-JWT (מינימום 32 תווים)
JWT_SECRET=your_very_long_and_secure_jwt_secret_key_here

# קישורים למערכות חיצוניות (אופציונלי)
NEXT_PUBLIC_EKRON_URL=https://ekron.yehud.muni.il
NEXT_PUBLIC_INCIDENT_FORM_URL=https://forms.yehud.muni.il/incident
```

**חשוב:** אל תשתף את הסיסמאות או את ה-JWT_SECRET. הוסף את `.env.local` ל-`.gitignore`.

### 3. הרצת שרת פיתוח

```bash
npm run dev
```

המערכת תהיה זמינה בכתובת: `http://localhost:3000`

### 4. בנייה לפרודקשן

```bash
npm run build
npm start
```

## פריסה ל-Vercel

### שלב 1: העלאת קוד ל-GitHub

```bash
git init
git add .
git commit -m "Initial commit - Miklaton system"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### שלב 2: חיבור ל-Vercel

1. היכנס ל-[Vercel Dashboard](https://vercel.com/dashboard)
2. לחץ על "New Project"
3. בחר את הריפו שלך מ-GitHub
4. Vercel יזהה אוטומטית שזה פרויקט Next.js

### שלב 3: הגדרת משתני סביבה ב-Vercel

בעמוד ההגדרות של הפרויקט, עבור ל-"Settings" > "Environment Variables" והוסף:

```
APP_PASSWORD=your_operator_password
ADMIN_PASSWORD=your_admin_password
JWT_SECRET=your_jwt_secret_minimum_32_characters
NEXT_PUBLIC_EKRON_URL=https://ekron.yehud.muni.il
NEXT_PUBLIC_INCIDENT_FORM_URL=https://forms.yehud.muni.il/incident
```

### שלב 4: Deploy

לחץ על "Deploy" - המערכת תיבנה ותעלה אוטומטית!

## מבנה הפרויקט

```
miklaton/
├── app/                      # Next.js App Router
│   ├── api/                  # API Routes
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   └── logout/
│   │   └── geocode/          # פרוקסי ל-Nominatim
│   ├── login/                # עמוד התחברות
│   ├── operator/             # עמוד מפעיל
│   ├── admin/                # עמוד אדמין
│   ├── layout.js
│   ├── page.js
│   └── globals.css
├── components/               # קומפוננטות React
│   ├── FlowRunner.js         # מנהל נהלי תפעול
│   ├── ShelterSearch.js      # חיפוש מקלטים
│   └── OnCallPanel.js        # תצוגת אנשי קשר
├── data/                     # נתונים ב-JSON
│   ├── shelters.json         # רשימת מקלטים
│   ├── onCall.json           # תורנויות שבועיות
│   └── alertFlows.json       # נהלי תפעול
├── lib/                      # ספריות עזר
│   ├── auth.js               # אימות JWT
│   ├── distance.js           # חישוב מרחקים
│   └── rtl.js                # עזרי RTL
├── middleware.js             # הגנה על routes
└── package.json
```

## ניהול נתונים

### עדכון רשימת מקלטים

ערוך את הקובץ `data/shelters.json`:

```json
[
  {
    "id": "shelter-1",
    "name": "מקלט ציבורי גני יהוד",
    "number": "101",
    "address": "רחוב הרצל 45, יהוד",
    "accessibility": "נגיש",
    "notes": "מקלט גדול, כניסה ללא מדרגות",
    "lat": 32.0302,
    "lng": 34.8896
  }
]
```

**שדות:**
- `id` - מזהה יניקלי (חובה)
- `name` - שם המקלט (חובה)
- `number` - מספר מקלט (אופציונלי, null אם אין)
- `address` - כתובת מלאה (חובה)
- `accessibility` - "נגיש" / "לא נגיש" / "לא ידוע" (חובה)
- `notes` - הערות נוספות (אופציונלי, null אם אין)
- `lat` - קו רוחב (אופציונלי, null אם לא ידוע)
- `lng` - קו אורך (אופציונלי, null אם לא ידוע)

### עדכון תורנויות

ערוך את הקובץ `data/onCall.json`:

```json
{
  "weekLabel": "שבוע 26/02/2025",
  "onCall": [
    {
      "id": "doron",
      "name": "דורון כהן",
      "role": "קב\"ט",
      "phone": "050-1234567",
      "active": true
    }
  ]
}
```

**הערה:** האדמין יכול להפעיל/לכבות אנשי קשר דרך ממשק האדמין, אבל השינויים נשמרים ב-localStorage בלבד. לשינויים קבועים יש לערוך את הקובץ.

### עדכון נהלי תפעול

ערוך את הקובץ `data/alertFlows.json`:

```json
[
  {
    "id": "missiles",
    "title": "אזעקת טילים",
    "description": "נוהל תפעול בזמן אזעקת טילים",
    "steps": [
      {
        "id": "step1",
        "type": "decision",
        "label": "התקבלה אזעקה",
        "question": "האם המקלטים נפתחו אוטומטית ב-Ekron?",
        "yesNext": "step2",
        "noNext": "step_manual_open",
        "criticalNote": "בדוק במערכת Ekron תוך 30 שניות"
      },
      {
        "id": "step2",
        "type": "action",
        "label": "פעולה לביצוע",
        "checklist": ["פעולה 1", "פעולה 2"],
        "nextStep": "step3"
      }
    ]
  }
]
```

**סוגי שלבים:**
- `decision` - שאלה עם תשובה כן/לא
  - `question` - השאלה
  - `yesNext` - ID של השלב הבא אם התשובה כן
  - `noNext` - ID של השלב הבא אם התשובה לא
- `action` - רשימת פעולות לביצוע
  - `checklist` - מערך של פעולות
  - `nextStep` - ID של השלב הבא (null לסיום)

## שימוש במערכת

### מפעיל

1. התחבר עם הסיסמה הרגילה
2. בעמוד המפעיל תראה שתי כרטיסיות:
   - **פעילות בזמן אזעקה** - התחל אירוע ועקוב אחר הנוהל
   - **חיפוש מקלט לתושב** - הקלד כתובת וקבל 3 מקלטים קרובים
3. במהלך אירוע:
   - עקוב אחר השלבים
   - ענה על שאלות (כן/לא)
   - סמן פעולות שבוצעו
   - צפה בלוג הפעולות בזמן אמת
   - ייצא את הלוג כקובץ JSON
   - גש למערכות חיצוניות (Ekron, טפסים)

### אדמין

1. התחבר עם שתי הסיסמאות (רגילה + אדמין)
2. שלושה טאבים:
   - **ניהול תורנויות** - הפעל/כבה אנשי קשר לשבוע הנוכחי
   - **מקלטים** - הוסף קואורדינטות למקלטים וייצא שינויים
   - **נהלי תפעול** - צפייה בנהלים המוגדרים

## גיאוקודינג - הערות חשובות

המערכת משתמשת ב-**Nominatim** (OpenStreetMap) לגיאוקודינג בחינם.

### מגבלות Nominatim

- **Rate limiting:** 1 בקשה לשנייה
- **דיוק:** בינוני עד טוב (תלוי באזור)
- **זמינות:** תלויה בשרת חיצוני

### המלצות

1. **למערכת פרודקשן מלאה**, מומלץ לשדרג ל-Google Maps Geocoding API:
   - דיוק גבוה יותר
   - מהירות גבוהה יותר
   - אמינות גבוהה יותר
   - עלות: כ-$5 ל-1,000 בקשות

2. **שמור קואורדינטות בקובץ JSON** - אל תסתמך על גיאוקודינג בזמן אמת. השתמש באדמין כדי למצוא קואורדינטות פעם אחת ושמור אותן קבוע.

3. **גיבוי ידני** - אם הגיאוקודינג לא עובד, אפשר למצוא קואורדינטות ב-Google Maps ולהזין ידנית ל-JSON.

## אבטחה

- **אימות:** JWT tokens עם תוקף של 8 שעות
- **HttpOnly cookies:** מונע גישה מ-JavaScript
- **Middleware protection:** כל הדפים המוגנים בודקים טוקן תקף
- **סיסמאות:** מאוחסנות במשתני סביבה בלבד
- **אין בסיס נתונים:** כל הנתונים ב-JSON בריפו

## מגבלות ידועות

1. **אין בסיס נתונים** - כל השינויים ב-localStorage (זמני) או בקבצי JSON (קבוע)
2. **סיסמה משותפת** - כל המפעילים משתמשים באותה סיסמה
3. **אין ניהול משתמשים** - לא ניתן לעקוב אחר מי ביצע פעולה
4. **תלוי באינטרנט** - הגיאוקודינג דורש חיבור
5. **Nominatim rate limiting** - מוגבל לבקשה אחת לשנייה

## שדרוגים עתידיים (אופציונלי)

- [ ] מעבר ל-Google Maps API לגיאוקודינג
- [ ] הוספת Supabase/Firebase לשמירת נתונים
- [ ] ניהול משתמשים אישי עם audit log
- [ ] התראות push למפעילים
- [ ] אינטגרציה עם מערכת Ekron
- [ ] גרסת אפליקציה סלולרית

## תמיכה טכנית

לבעיות טכניות או שאלות, פנה למחלקת IT העירונית.

## רישיון

מערכת פנימית לשימוש עירוני בלבד. © עיריית יהוד-מונוסון
