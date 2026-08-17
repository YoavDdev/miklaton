# 📋 סדר הרצת Migrations ו-Seeds

## ⚠️ חשוב! הרץ בסדר הזה:

### 1️⃣ **Municipality (חובה ראשון!)**
```sql
-- יוצר את העיר יהוד-מונוסון
supabase/seed_yehud_simple.sql
```

### 2️⃣ **Call Categories - Tables**
```sql
-- יוצר את הטבלאות הבסיסיות
supabase/migrations/20260511_call_categories.sql
```

### 3️⃣ **Call Categories - Availability Fields**
```sql
-- מוסיף שדות זמינות וחופשים
supabase/migrations/20260511_enhance_call_categories.sql
```

### 4️⃣ **Call Categories - Data**
```sql
-- ממלא 12 קטגוריות עם כוננים
supabase/seed_call_categories.sql
```

---

## 🚀 הרצה מהירה (Supabase Dashboard):

1. לך ל-SQL Editor
2. העתק והרץ את הקבצים בסדר המדויק הזה
3. וודא שכל אחד מחזיר "Success"

---

## ✅ אחרי זה:

```
http://localhost:3001/operator
→ לחץ על "📋 מדריך פניות"
```

הכל אמור לעבוד! 🎉
