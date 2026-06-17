# 🔍 Database Audit - מקלטון

**תאריך:** 10 מאי 2026

---

## 📊 טבלאות קיימות במערכת

### ✅ **טבלאות פעילות ונחוצות**

#### 1. **Authentication & Users**
- `user_profiles` - פרופילי משתמשים ✅
- `password_resets` - איפוס סיסמאות ✅
- `audit_log` - לוג פעולות ✅
- `system_settings` - הגדרות מערכת ✅
- `user_departments` - קישור משתמשים למחלקות ✅

#### 2. **Emergency & Shelters (מקלטון)**
- `shelter_status` - סטטוס מקלטים ✅
- `emergency_events` - אירועי חירום ✅
- `event_journal` - יומן אירועים ✅
- `event_participants` - משתתפים באירוע ✅
- `war_mode` - מצב מלחמה ✅

#### 3. **Departments & On-Call**
- `departments` - מחלקות/מכלולים ✅
- `contacts` - אנשי קשר (ישן?) ⚠️
- `on_call_contacts` - אנשי קשר כוננים (חדש) ✅
- `on_call_shifts` - משמרות כוננות ✅
- `duty_roster` - תורנויות שבועיות ⚠️

#### 4. **Daily Operations (חדש)**
- `municipalities` - עיריות (multi-tenant) ✅
- `daily_updates` - עדכונים יומיומיים ✅
- `shift_messages` - הודעות בין משמרות ✅
- `operator_shifts` - לוח משמרות מוקדנים ✅

#### 5. **Operator Tools**
- `operator_tasks` - משימות מוקדנים ✅
- `operator_messages` - הודעות מוקדנים ⚠️
- `operator_sessions` - סשנים פעילים ✅
- `general_notifications` - הודעות כלליות ✅

#### 6. **Surveys (סקרים)**
- `surveys` - סקרים ❓
- `survey_responses` - תשובות לסקרים ❓

---

## ⚠️ **חשד לכפילויות וטבלאות מיותרות**

### 🔴 **1. אנשי קשר - יש 2 טבלאות!**

**`contacts`** (ישן)
```
- id
- name
- phone
- department_id
- role
- is_active
```

**`on_call_contacts`** (חדש)
```
- id
- municipality_id
- department_id
- name
- phone
- email
- is_external
- external_company
- is_default
- notes
- active
```

**📌 המלצה:** 
- `on_call_contacts` הוא יותר מתקדם ותומך ב-multi-tenant
- **צריך לבדוק:** האם `contacts` עדיין בשימוש בקוד?
- **פתרון:** להעביר נתונים מ-`contacts` ל-`on_call_contacts` ולמחוק את `contacts`

---

### 🟡 **2. הודעות - יש 2 טבלאות!**

**`operator_messages`**
```
- id
- from_user
- to_user
- message
- read
- created_at
```

**`shift_messages`** (חדש)
```
- id
- municipality_id
- from_user
- to_user
- message
- related_task_id
- read
- read_at
- created_at
```

**📌 המלצה:**
- `shift_messages` יותר מתקדם (multi-tenant, קישור למשימות)
- **צריך לבדוק:** האם `operator_messages` עדיין בשימוש?
- **פתרון:** להעביר ל-`shift_messages` או לאחד אותם

---

### 🟡 **3. תורנויות - `duty_roster` vs `on_call_shifts`**

**`duty_roster`**
```
- id
- department_id
- week_start_date
- contacts (JSONB)
- created_by
- updated_at
```

**`on_call_shifts`**
```
- id
- contact_id
- department_id
- shift_type
- start_date
- end_date
- start_time
- end_time
- reason
```

**📌 המלצה:**
- `duty_roster` נראה כמו מערכת ישנה (JSONB של contacts)
- `on_call_shifts` יותר מתקדם ודינמי
- **צריך לבדוק:** האם `duty_roster` עדיין בשימוש ב-UI?
- **פתרון אפשרי:** לשמור את `duty_roster` רק לתצוגה שבועית, אבל הלוגיקה ב-`on_call_shifts`

---

### 🟡 **4. משימות - `operator_tasks` מופיע פעמיים?**

**בדיקה נדרשת:**
- האם `operator_tasks` הקיים תומך ב-municipality_id?
- האם יש עוד טבלת tasks?

---

### ❓ **5. Surveys - האם בשימוש?**

**`surveys`** + **`survey_responses`**

**📌 שאלות:**
- האם הסקרים בשימוש אקטיבי?
- האם זה חלק מהמערכת או פיצ'ר שנזנח?
- **אם לא בשימוש:** לשקול מחיקה

---

## 🔍 **בדיקות שצריך להריץ**

### 1. בדיקת שימוש ב-`contacts` (הישן)

```sql
-- כמה רשומות יש?
SELECT COUNT(*) FROM contacts;

-- מה יש שם?
SELECT * FROM contacts LIMIT 5;
```

**בקוד:**
```bash
# חיפוש בקוד
grep -r "contacts" miklaton/app --include="*.js" --include="*.jsx"
grep -r "contacts" miklaton/components --include="*.js" --include="*.jsx"
```

---

### 2. בדיקת שימוש ב-`operator_messages`

```sql
SELECT COUNT(*) FROM operator_messages;
SELECT * FROM operator_messages LIMIT 5;
```

**בקוד:**
```bash
grep -r "operator_messages" miklaton/app --include="*.js"
grep -r "operator_messages" miklaton/components --include="*.js"
```

---

### 3. בדיקת שימוש ב-`duty_roster`

```sql
SELECT COUNT(*) FROM duty_roster;
SELECT * FROM duty_roster LIMIT 5;
```

**בקוד:**
```bash
grep -r "duty_roster" miklaton/app --include="*.js"
grep -r "duty_roster" miklaton/components --include="*.js"
```

---

### 4. בדיקת surveys

```sql
SELECT COUNT(*) FROM surveys;
SELECT COUNT(*) FROM survey_responses;
```

---

## 📋 **תכנית ניקיון מוצעת**

### Phase 1: בדיקה (עכשיו)
1. ✅ הרצת שאילתות COUNT על כל הטבלאות החשודות
2. ✅ חיפוש בקוד לשימוש בטבלאות
3. ✅ זיהוי מה בשימוש ומה לא

### Phase 2: החלטה
1. ⏳ החלטה על כל טבלה - לשמור/למחוק/לאחד
2. ⏳ תכנית migration להעברת נתונים

### Phase 3: ביצוע
1. ⏳ יצירת migration לניקיון
2. ⏳ עדכון קוד (אם נדרש)
3. ⏳ בדיקות

---

## 🎯 **המלצות מיידיות**

### ✅ **לשמור בהחלט:**
- `user_profiles`, `departments`, `municipalities`
- `emergency_events`, `event_journal`, `shelter_status`
- `on_call_contacts`, `on_call_shifts`, `daily_updates`
- `operator_tasks`, `shift_messages`, `operator_shifts`

### ⚠️ **לבדוק:**
- `contacts` - אולי מיותר?
- `operator_messages` - אולי מיותר?
- `duty_roster` - אולי רק לתצוגה?
- `surveys` + `survey_responses` - בשימוש?

### 🔄 **לשקול איחוד:**
- `contacts` → `on_call_contacts`
- `operator_messages` → `shift_messages`

---

**הצעד הבא:** להריץ את הבדיקות ולראות מה יש בטבלאות החשודות.
