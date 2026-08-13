# 🧹 תכנית ניקיון Database - מקלטון

**תאריך:** 10 מאי 2026

---

## 📊 ממצאים מבדיקת הקוד

### ✅ **טבלאות בשימוש אקטיבי**

#### 1. **`contacts`** - **בשימוש רב!** ⚠️
**קבצים שמשתמשים:**
- `app/api/contacts/route.js` - CRUD מלא
- `app/api/events/join/route.js` - חיפוש משתתפים
- `app/api/on-call-shifts/route.js` - קישור לתורנויות
- `app/api/duty-form/route.js` - הוספת אנשי קשר חדשים
- `components/OnCallPanel.js` - תצוגת כוננים
- `components/FlowRunner.js` - הקפצות
- `components/OnCallManager.js` - ניהול

**מבנה:**
```sql
contacts:
- id
- department_id
- full_name
- phone
- role
- active
```

**📌 החלטה:** **לא למחוק!** זה הטבלה המרכזית לאנשי קשר במערכת הנוכחית.

---

#### 2. **`duty_roster`** - **בשימוש רב!** ⚠️
**קבצים שמשתמשים:**
- `app/api/duty-roster/route.js` - CRUD מלא
- `app/api/on-call-shifts/route.js` - קריאת תורנויות
- `app/api/duty-form/route.js` - טופס תורנויות
- `app/sector-manager/page.js` - ניהול תורנויות שבועיות
- `components/OnCallManagerNew.js` - realtime updates

**מבנה:**
```sql
duty_roster:
- id
- department_id
- contact_id → contacts(id)
- day_of_week (0-6)
- start_hour
- end_hour
- week_start_date (NULL = קבוע)
- notes
- active
```

**📌 החלטה:** **לא למחוק!** זה המערכת הפעילה לניהול תורנויות שבועיות.

---

#### 3. **`operator_messages`** - **בשימוש!** ⚠️
**קבצים שמשתמשים:**
- `app/api/operator/messages/route.js` - CRUD מלא

**מבנה:**
```sql
operator_messages:
- id
- sender_id
- message_text
- read_by (array)
- created_at
```

**📌 החלטה:** **לא למחוק כרגע** - אבל יש כפילות עם `shift_messages`.

---

## 🔄 **כפילויות שזיהינו**

### 1. **אנשי קשר: `contacts` vs `on_call_contacts`**

**המצב:**
- `contacts` - **בשימוש אקטיבי** במערכת הנוכחית
- `on_call_contacts` - **טבלה חדשה** שיצרנו, עדיין ריקה

**הבעיה:**
- יש לנו 2 מערכות מקבילות
- `on_call_contacts` יותר מתקדם (multi-tenant, external companies, default contact)
- אבל כל הקוד הקיים משתמש ב-`contacts`

**פתרון מוצע:**

#### **אפשרות 1: שמירה על שתיהן (מומלץ לטווח קצר)** ✅
- `contacts` - אנשי קשר כלליים (עובדים, מנהלים)
- `on_call_contacts` - כוננים ספציפיים (כולל חיצוניים)
- **יתרון:** לא שובר קוד קיים
- **חיסרון:** כפילות

#### **אפשרות 2: מיגרציה מלאה (לטווח ארוך)** 🔄
1. להעביר את כל הנתונים מ-`contacts` ל-`on_call_contacts`
2. לעדכן את כל הקוד להשתמש ב-`on_call_contacts`
3. למחוק את `contacts`
- **יתרון:** מערכת אחידה ומתקדמת
- **חיסרון:** עבודה רבה, סיכון לשבירת קוד

---

### 2. **תורנויות: `duty_roster` vs `on_call_shifts`**

**המצב:**
- `duty_roster` - **בשימוש אקטיבי** - תורנויות שבועיות קבועות
- `on_call_shifts` - **טבלה חדשה** - משמרות דינמיות (כולל זמניות)

**הבדלים:**
```
duty_roster:
- מבוסס על יום בשבוע (0-6)
- שעות קבועות (start_hour, end_hour)
- קישור ישיר ל-contact_id
- week_start_date (NULL = קבוע)

on_call_shifts:
- מבוסס על תאריכים (start_date, end_date)
- shift_type (weekday/weekend/both/temporary)
- קישור ל-contact_id (on_call_contacts)
- reason (חופש, מחלה)
```

**פתרון מוצע:**

#### **שמירה על שתיהן - תפקידים שונים!** ✅
- `duty_roster` - **תורנויות קבועות שבועיות** (מה שמנהל המכלול מגדיר)
- `on_call_shifts` - **החלפות זמניות** (חופש, מחלה, חברה חיצונית)

**לוגיקה:**
1. `duty_roster` מגדיר מי כונן בכל יום בשבוע (ברירת מחדל)
2. `on_call_shifts` מאפשר לעקוף זאת זמנית
3. הפונקציה `get_current_on_call()` בודקת קודם `on_call_shifts`, ואם אין - חוזרת ל-`duty_roster`

---

### 3. **הודעות: `operator_messages` vs `shift_messages`**

**המצב:**
- `operator_messages` - **בשימוש** - הודעות כלליות בין מוקדנים
- `shift_messages` - **טבלה חדשה** - הודעות בין משמרות (עם municipality_id)

**פתרון מוצע:**

#### **שמירה על שתיהן** ✅
- `operator_messages` - הודעות כלליות/שידורים
- `shift_messages` - העברת משימות בין משמרות

---

## 📋 **תכנית פעולה מומלצת**

### Phase 1: שמירה על המבנה הקיים + הרחבה (עכשיו)

#### ✅ **מה לשמור:**
- `contacts` - אנשי קשר קיימים
- `duty_roster` - תורנויות שבועיות
- `operator_messages` - הודעות כלליות
- כל שאר הטבלאות

#### ✅ **מה להוסיף:**
- `on_call_contacts` - כוננים חדשים (כולל חיצוניים)
- `on_call_shifts` - החלפות זמניות
- `shift_messages` - הודעות בין משמרות
- `daily_updates` - עדכונים יומיומיים

#### ✅ **איך לעבוד:**
1. **contacts** ← אנשי קשר רגילים (עובדים, מנהלים)
2. **on_call_contacts** ← כוננים ספציפיים (כולל חברות חיצוניות)
3. **duty_roster** ← תורנויות קבועות שבועיות
4. **on_call_shifts** ← החלפות זמניות (חופש, מחלה)

---

### Phase 2: אינטגרציה (בהמשך)

#### 🔄 **קישור בין המערכות:**

**ליצור view או פונקציה שמאחדת:**
```sql
CREATE OR REPLACE FUNCTION get_current_on_call_for_dept(dept_id UUID, check_time TIMESTAMPTZ DEFAULT NOW())
RETURNS TABLE (...) AS $$
BEGIN
  -- 1. בדוק אם יש on_call_shift זמני
  -- 2. אם לא, בדוק duty_roster
  -- 3. אם לא, בדוק on_call_contact עם is_default=true
END;
$$;
```

---

### Phase 3: ניקיון (עתיד רחוק)

**רק אחרי שהמערכת החדשה עובדת 100%:**
1. להעביר נתונים מ-`contacts` ל-`on_call_contacts`
2. לעדכן קוד
3. למחוק `contacts`

---

## 🎯 **המלצה סופית**

### **לא למחוק כלום כרגע!** ✅

**הסיבות:**
1. כל הטבלאות בשימוש אקטיבי
2. המערכת החדשה עדיין לא מחוברת ל-UI
3. אין סיכון של כפילות - הן משלימות אחת את השנייה

### **במקום זאת:**
1. ✅ לשמור על המבנה הקיים
2. ✅ להשתמש בטבלאות החדשות לפיצ'רים חדשים
3. ✅ ליצור אינטגרציה בין המערכות
4. ✅ בעתיד - לאחד אם נדרש

---

## 📊 **מיפוי שימושים**

### **contacts** (ישן)
- ✅ אנשי קשר כלליים
- ✅ FlowRunner (הקפצות)
- ✅ OnCallPanel (תצוגה)
- ✅ duty_roster (קישור)

### **on_call_contacts** (חדש)
- 🆕 כוננים דינמיים
- 🆕 חברות חיצוניות
- 🆕 Multi-tenant
- 🆕 API חדש

### **duty_roster** (ישן)
- ✅ תורנויות שבועיות
- ✅ sector-manager
- ✅ UI קיים

### **on_call_shifts** (חדש)
- 🆕 החלפות זמניות
- 🆕 חופשים
- 🆕 API חדש

---

**סיכום:** המערכת תומכת כרגע ב-2 מודלים מקבילים - ישן וחדש. זה בסדר! נשתמש בשניהם.
