# הגדרת Supabase למערכת מקלטון

## שלב 1: יצירת פרויקט Supabase

1. היכנס ל-[Supabase](https://supabase.com)
2. צור חשבון (חינמי לחלוטין)
3. לחץ על "New Project"
4. בחר שם לפרויקט: `miklaton`
5. בחר סיסמת database (שמור אותה במקום בטוח)
6. בחר אזור: `Frankfurt` (הכי קרוב לישראל)
7. המתן 2-3 דקות שהפרויקט ייווצר

## שלב 2: העתקת פרטי חיבור

1. בתפריט הצד, לחץ על ⚙️ **Settings**
2. לחץ על **API**
3. העתק את:
   - **Project URL** (תחת "Config")
   - **anon public** key (תחת "Project API keys")

## שלב 3: הוספת משתני סביבה

1. צור קובץ `.env.local` בשורש הפרויקט
2. הוסף את השורות הבאות:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

3. **ב-Vercel**: הוסף את אותם משתנים ב-Settings → Environment Variables

## שלב 4: יצירת טבלה

1. בתפריט הצד, לחץ על 🗄️ **SQL Editor**
2. לחץ על **New Query**
3. העתק והדבק את התוכן מקובץ `supabase/schema.sql`
4. לחץ על **Run** (או Ctrl+Enter)
5. וודא שקיבלת הודעה: "Success. No rows returned"

## שלב 5: התקנת חבילות

```bash
npm install
```

## שלב 6: בדיקה מקומית

```bash
npm run dev
```

פתח את הדפדפן וגש לעמדת המפעיל - בדוק שניהול המקלטים עובד!

## שלב 7: Deploy לייצור

```bash
git add .
git commit -m "Add Supabase integration for shelter status"
git push
```

Vercel יעשה deploy אוטומטית!

---

## ✅ בדיקה שהכל עובד

1. היכנס לעמדת המפעיל
2. גלול למטה ל-"ניהול מקלטים ציבוריים"
3. פתח מקלט
4. רענן את העמוד - הסטטוס צריך להישאר פתוח!

---

## 🔧 פתרון בעיות

### שגיאה: "Missing Supabase environment variables"
- בדוק שהעתקת נכון את ה-URL וה-Key
- בדוק שאין רווחים מיותרים
- ב-Vercel, בדוק שהוספת את המשתנים

### שגיאה: "relation 'shelter_status' does not exist"
- הרץ שוב את ה-SQL מקובץ `supabase/schema.sql`
- בדוק שלא היו שגיאות ב-SQL Editor

### המערכת לא מעדכנת סטטוס
- בדוק ב-Supabase Dashboard → Table Editor → shelter_status
- וודא שהרשומות קיימות
- בדוק את ה-Network tab בדפדפן לשגיאות

---

## 📊 צפייה בנתונים

1. ב-Supabase Dashboard
2. לחץ על 🗂️ **Table Editor**
3. בחר טבלה: `shelter_status`
4. תראה את כל הסטטוסים של המקלטים בזמן אמת!
