# 06 — פריסה ודומיין (miklaton.co.il)

## פריסה ל-Vercel

הפרויקט בנוי לפריסה ב-Vercel (ריפו: `github.com/YoavDdev/miklaton`).

### משתני סביבה ב-Vercel (Settings → Environment Variables)
חובה להגדיר בסביבת Production:

```
JWT_SECRET                        (מינימום 32 תווים, ייחודי!)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
GOOGLE_MAPS_API_KEY
NEXT_PUBLIC_MUNICIPALITY_NAME=עיריית יהוד-מונוסון
NEXT_PUBLIC_MUNICIPALITY_SHORT=יהוד-מונוסון
NEXT_PUBLIC_MUNICIPALITY_ID=yehud
NEXT_PUBLIC_SYSTEM_NAME=מקלטון
NEXT_PUBLIC_EKRON_URL=...
```

לאחר כל שינוי במשתני סביבה — יש לבצע Redeploy.

## רכישת הדומיין miklaton.co.il

דומיין `.co.il` נרשם דרך רשמים המוסמכים ע"י איגוד האינטרנט הישראלי (ISOC-IL).
רשמים נפוצים: **Domain The Net**, **LiveDNS**, **Box (interspace)**, **GoDaddy** (מוסמך גם ל-.il).

דרישות ל-.co.il:
- הרישום פתוח לכל אדם/עסק (אין חובת ח.פ.).
- רישום לתקופה של שנה עד חמש שנים.
- שים לב: לפי כללי ISOC-IL, לדומיין חייבים להיות רשומות DNS תקינות.

טיפ: מומלץ לרכוש אצל רשם שמאפשר **ניהול DNS חינם** בממשק נוח (LiveDNS / Domain The Net נפוצים לזה).

## חיבור הדומיין ל-Vercel — שלב אחר שלב

### שלב 1: הוספת הדומיין בפרויקט
1. Vercel Dashboard → הפרויקט `miklaton` → **Settings → Domains**
2. הוסף `miklaton.co.il` וגם `www.miklaton.co.il`
3. הגדר את `miklaton.co.il` כ-Primary, ואת `www` כ-Redirect אליו (או להפך — העיקר עקביות).

### שלב 2: הגדרת DNS אצל הרשם
בממשק ניהול ה-DNS של הרשם הישראלי, הוסף:

| סוג | שם (Host) | ערך |
|-----|-----------|------|
| A | `@` (הדומיין הראשי) | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

> Vercel מציג את הערכים המדויקים במסך ה-Domains — אם מוצג ערך שונה, השתמש במה ש-Vercel מציג.

חלופה: אפשר להעביר את ניהול ה-DNS כולו ל-Vercel (Nameservers: `ns1.vercel-dns.com`, `ns2.vercel-dns.com`) — נוח יותר, אבל אז כל רשומות ה-DNS (כולל מייל אם יהיה) מנוהלות ב-Vercel.

### שלב 3: המתנה ואימות
- התפשטות DNS: בדרך כלל דקות עד שעות (עד 48 שעות במקרה קיצון).
- Vercel ינפיק **תעודת SSL אוטומטית (Let's Encrypt)** ברגע שה-DNS מצביע נכון.
- בדיקה: `dig miklaton.co.il` אמור להחזיר `76.76.21.21`.

### שלב 4: עדכונים במערכת אחרי החיבור
1. **Supabase → Authentication → URL Configuration**:
   - Site URL: `https://www.miklaton.co.il`
   - הוסף ל-Redirect URLs: `https://www.miklaton.co.il/reset-password` (וגם הדומיין בלי www)
   - בלי זה — קישורי איפוס סיסמה במייל יפנו לכתובת הישנה!
2. **קישורים שנשלחים החוצה** (WhatsApp לטפסי תורנות, קישורי סקרים, הזמנות לאירועים) — נבנים מ-`window.location.origin` ולכן יתעדכנו אוטומטית. יש לוודא שאין כתובת `vercel.app` קשיחה בקוד.
3. אם מוגדר CORS/Allowed Origins כלשהו ב-Supabase — להוסיף את הדומיין החדש.
4. לעדכן את הקישור אצל המשתמשים (מועדפים, מסך המוקד, קיצורי דרך).

### שלב 5 (מומלץ): שמירה על כתובת ה-vercel.app
כתובת ה-`*.vercel.app` תמשיך לעבוד כגיבוי. אפשר להגדיר ב-Vercel Redirect ממנה לדומיין החדש כדי שכולם יעברו לכתובת אחת.

## בדיקות אחרי המעבר (Checklist)

- [ ] `https://www.miklaton.co.il` נטען עם מנעול SSL תקין
- [ ] התחברות ויציאה עובדות (העוגייה נקבעת על הדומיין החדש)
- [ ] איפוס סיסמה במייל מפנה לדומיין החדש
- [ ] קישור סקר חדש שנוצר מצביע לדומיין החדש
- [ ] קישור הזמנה לאירוע חירום עובד
- [ ] קישורי WhatsApp לטפסי תורנות מפנים לדומיין החדש
- [ ] מסך המוקד `/screen` עודכן לכתובת החדשה במחשב התצוגה
