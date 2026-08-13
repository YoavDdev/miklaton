# הוספת אוקסנה פרנק - מנהלת מכלול הנדסה ותשתיות

## שלב 1️⃣: יצירת המכלול (אם לא קיים)

**ב-Supabase Dashboard → SQL Editor:**

```sql
-- יצירת מכלול הנדסה ותשתיות
INSERT INTO departments (name, manager_name, manager_phone, display_order)
VALUES ('הנדסה ותשתיות', 'אוקסנה פרנק', '+972 54-531-2875', 10)
ON CONFLICT (name) DO NOTHING;

-- בדיקה שנוצר + קבלת ה-ID
SELECT id, name, manager_name FROM departments WHERE name = 'הנדסה ותשתיות';
```

**העתק את ה-`id` שהתקבל** (למשל: `a1b2c3d4-e5f6-...`)

---

## שלב 2️⃣: יצירת המשתמש ב-Supabase Auth

**ב-Supabase Dashboard → Authentication → Users → Add User:**

- **Email:** `oksanaf@ye-mo.org.il`
- **Password:** `Oksana2026!` (סיסמה זמנית)
- **☑️ Auto Confirm User:** סמן V (חשוב!)

לחץ **Create User**

**העתק את ה-`User ID`** שנוצר (למשל: `9z8y7x6w-5v4u-...`)

---

## שלב 3️⃣: חיבור המשתמש למכלול

**חזור ל-SQL Editor והרץ:**

```sql
-- הוספת שדה department_id לטבלה (אם עדיין לא קיים)
-- רק אם זה הפעם הראשונה:
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

-- עדכון פרופיל המשתמש
-- החלף את YOUR_USER_ID_HERE ב-ID שהעתקת בשלב 2
-- החלף את YOUR_DEPARTMENT_ID ב-ID שהעתקת בשלב 1
UPDATE user_profiles 
SET 
  full_name = 'אוקסנה פרנק',
  phone = '+972 54-531-2875',
  role = 'sector_manager',
  department_id = 'YOUR_DEPARTMENT_ID',  -- <-- ID של המכלול משלב 1
  must_change_password = true,
  status = 'active'
WHERE id = 'YOUR_USER_ID_HERE';  -- <-- User ID משלב 2

-- בדיקה שהכל תקין
SELECT 
  up.id,
  up.email,
  up.full_name,
  up.role,
  d.name as department_name,
  up.must_change_password,
  up.status
FROM user_profiles up
LEFT JOIN departments d ON up.department_id = d.id
WHERE up.email = 'oksanaf@ye-mo.org.il';
```

---

## שלב 4️⃣: בדיקה

**התחבר כאוקסנה:**

1. לך ל-`http://localhost:3000/login`
2. Email: `oksanaf@ye-mo.org.il`
3. Password: `Oksana2026!`
4. המערכת תכפה עליה לשנות סיסמה (mustChangePassword)
5. לאחר שינוי - תנותב ל-`/sector-manager`
6. היא תראה את **המכלול שלה בלבד** - הנדסה ותשתיות

---

## ✅ מה היא תראה?

- 📱 **כוננות הנדסה ותשתיות** - כמו WhatsApp app
- 👥 **אנשי קשר** של המכלול שלה בלבד
- 📅 **לוח תורנויות שבועי** - רק של המכלול שלה
- ➕ **יכולת להוסיף** אנשי קשר ותורנויות

---

## 🔐 פרטי התחברות (לשליחה לאוקסנה):

```
שלום אוקסנה,

נוצר לך חשבון במערכת מקלטון:

🔗 כתובת: http://localhost:3000/login
📧 Email: oksanaf@ye-mo.org.il
🔑 סיסמה זמנית: Oksana2026!

⚠️ בהתחברות הראשונה תתבקשי לשנות את הסיסמה.

לאחר ההתחברות תגיעי לאיזור האישי שלך - ניהול כוננויות מכלול הנדסה ותשתיות.

בהצלחה!
```
