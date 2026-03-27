# מקלטון - מסמך טכנולוגיות ומבנה מערכת
**עדכון אחרון: 23.03.2026**

---

## 📋 תיאור כללי

**מקלטון** - פלטפורמה מודולרית למוקד העירוני יהוד-מונוסון.
המערכת החלה כמערכת ניהול אירועי חירום ומתפתחת לפלטפורמה מקיפה לכל פעילות המוקד והשטח.

### 🎯 חזון המערכת
פלטפורמה מרכזית המשרתת 5 קבוצות משתמשים שונות:
1. **מפעילי מוקד** (15~ משתמשים) - תפעול יומיומי
2. **מנהלי מכלול** - ניהול מחלקתי
3. **פקחים** - עדכוני שטח וביקורת
4. **הנהלה ומנכ"ל** - תצוגת ניהול ודשבורד
5. **Super Admin** - ניהול מערכת מלא

### 🧩 Modules במערכת
- **חירום ומקלטים** 🚨 - נהלי אזעקה, ניהול מקלטים, חיפוש
- **מפה חיה** 🗺️ - עדכוני שטח בזמן אמת (חסימות, טילים, עבודות)
- **תורנויות** 📞 - לוחות תורנות ואנשי קשר
- **דוחות וביקורת** 📋 - דוחות בדיקה ו-audit log
- **AI עוזר** 🤖 - (עתידי) צ'אט ועזרה חכמה
- **מידע חשוב** 📚 - (עתידי) מסמכים ונהלים

---

## 🛠️ Stack טכנולוגי

### Frontend
- **Next.js 14.0.0** - React framework עם App Router
- **React 18** - ספריית UI
- **Tailwind CSS 3.3.0** - עיצוב ו-styling
- **React Leaflet 4.2.1** - מפות אינטראקטיביות
- **Leaflet 1.9.4** - ספריית מפות

### Backend & Infrastructure  
- **Next.js API Routes** - Backend serverless
- **Supabase** - בסיס נתונים PostgreSQL + Realtime
  - `@supabase/supabase-js` 2.98.0
- **Vercel** - הוסטינג ופריסה

### Authentication & Security
- **Supabase Auth** - מערכת אימות מלאה עם password hashing (bcrypt)
- **JWT (JSON Web Tokens)** - אימות משתמשים
  - `jsonwebtoken` 9.0.2
  - `jose` 6.1.3 (Edge runtime)
- **js-cookie** 3.0.5 - ניהול cookies בצד לקוח
- **RBAC (Role-Based Access Control)** - 5 רמות גישה
  - Operator, Manager, Inspector, Leadership, Admin
- **Supabase RLS (Row Level Security)** - הגבלת גישה לנתונים ברמת DB
- **Dynamic Middleware** - ניתוב אוטומטי לפי תפקיד משתמש

### Additional Tools
- **Nominatim / Google Geocoding API** - המרת כתובות לקואורדינטות
- **PostCSS** - עיבוד CSS
- **Autoprefixer** - תמיכה בדפדפנים

---

## 📁 מבנה פרויקט מפורט

```
miklaton/
├── 📂 app/                          # Next.js App Router
│   ├── 📂 api/                      # API Routes (Backend)
│   │   ├── auth/
│   │   │   ├── login/route.js       # התחברות JWT
│   │   │   ├── logout/route.js      # התנתקות
│   │   │   └── verify/route.js      # אימות טוקן
│   │   ├── contacts/route.js        # ניהול אנשי קשר
│   │   ├── departments/route.js     # ניהול מחלקות
│   │   ├── duty-form/route.js       # טופס תורנות
│   │   ├── duty-roster/route.js     # לוח תורנויות
│   │   ├── geocode/route.js         # המרת כתובות לקואורדינטות
│   │   ├── inspection/route.js      # דוחות בדיקה
│   │   ├── notifications/route.js   # הודעות כלליות
│   │   ├── shelter-status/route.js  # סטטוס מקלטים
│   │   └── war-mode/route.js        # מצב מלחמה
│   ├── 📂 admin/                    # עמוד מנהל
│   ├── 📂 login/                    # עמוד התחברות
│   ├── 📂 operator/                 # עמוד מפעיל (עיקרי)
│   ├── 📂 on-call/                  # דף אנשי קשר תורנים
│   ├── 📂 duty-form/                # טופס מילוי תורנות
│   ├── 📂 inspection/               # דף בדיקות מקלטים
│   ├── globals.css                  # סגנונות גלובליים
│   ├── layout.js                    # Layout ראשי
│   └── page.js                      # דף בית (redirect)
│
├── 📂 components/                   # React Components
│   ├── AddressInput.js              # קלט כתובת עם autocomplete
│   ├── FlowRunner.js                # מנוע הרצת נהלי תפעול ⭐
│   ├── GeneralNotifications.js      # ניהול הודעות כלליות
│   ├── OnCallManager.js             # ניהול תורנויות (ישן)
│   ├── OnCallManagerNew.js          # ניהול תורנויות (חדש)
│   ├── OnCallPanel.js               # פאנל תצוגת תורנים
│   ├── PrintableShelterList.js      # רשימת מקלטים להדפסה
│   ├── ReadOnlyNotifications.js     # תצוגת הודעות למפעילים
│   ├── ShelterMap.js                # מפת מקלטים
│   ├── ShelterSearch.js             # חיפוש מקלט לפי כתובת
│   ├── ShelterStatusManager.js      # ניהול פתיחה/סגירה מקלטים
│   ├── WeeklyDutyRoster.js          # לוח תורנויות שבועי ⭐
│   └── WhatsAppDutyLinks.js         # קישורי וואטסאפ לתורנים
│
├── 📂 data/                         # JSON Data Files
│   ├── alertFlows.json              # נהלי תפעול (2 flows) ⭐
│   ├── onCall.json                  # תורנויות לפי מחלקות ⭐
│   ├── shelters.json                # רשימת מקלטים (936 מקלטים)
│   ├── shelterStatus.json           # סטטוס מקלטים מקומי
│   ├── streets.json                 # רשימת רחובות
│   ├── zoneAssignments.json         # חלוקת רחובות לאזורים
│   ├── google-coordinates.json      # קואורדינטות מ-Google
│   ├── shelter-coordinates-updated.json
│   └── inspectionReports.json       # דוחות בדיקה
│
├── 📂 lib/                          # Utility Libraries
│   ├── auth.js                      # פונקציות JWT (Node runtime)
│   ├── auth-edge.js                 # פונקציות JWT (Edge runtime)
│   ├── distance.js                  # חישוב מרחקים גיאוגרפיים
│   ├── rtl.js                       # עזרי RTL לעברית
│   └── supabase.js                  # Supabase client
│
├── 📂 scripts/                      # Utility Scripts
│   ├── add-public-shelters.js       # הוספת מקלטים ציבוריים
│   ├── fetch-streets-google.js      # שליפת רחובות מ-Google
│   ├── fetch-streets-osm.js         # שליפת רחובות מ-OSM
│   ├── google-geocode.js            # המרת כתובות דרך Google
│   ├── update-exact-coords.js       # עדכון קואורדינטות מדויקות
│   ├── update-shelter-coordinates.js
│   └── update-shelters.js           # עדכון נתוני מקלטים
│
├── 📂 sectionData/                  # Geographic Zones
│   ├── איזור A.kmz                 # קבצי KMZ לאזורים
│   ├── איזור B.kmz
│   ├── איזור C.kmz
│   ├── חילוק יהוד – אזורים.kmz
│   ├── מזרח וצפון.txt               # רשימות רחובות
│   ├── מערב.txt
│   └── מרכז.txt
│
├── 📂 supabase/                     # Supabase Database
│   ├── migrations/
│   │   ├── create_oncall_system.sql  # טבלאות תורנויות
│   │   └── create_war_mode.sql       # טבלת מצב מלחמה
│   └── schema.sql                    # סכמת DB מלאה ⭐
│
├── 📄 middleware.js                  # Next.js middleware (Auth)
├── 📄 package.json                   # Dependencies
├── 📄 tailwind.config.js             # Tailwind configuration
├── 📄 postcss.config.js              # PostCSS config
├── 📄 jsconfig.json                  # JavaScript config
├── 📄 next.config.js                 # Next.js config
├── 📄 .env.local                     # משתני סביבה (local)
├── 📄 .env.example                   # דוגמה למשתני סביבה
├── 📄 README.md                      # תיעוד ראשי ⭐
└── 📄 SUPABASE_SETUP.md             # הוראות הגדרת Supabase
```

---

## 🔐 Authentication & Authorization

### שיטת אימות
- **JWT Tokens** עם תוקף של 8 שעות
- **HttpOnly Cookies** - מונע גישה מ-JavaScript בצד לקוח
- **Middleware Protection** - בודק טוקן בכל גישה לדפים מוגנים

### סוגי משתמשים
1. **מפעיל** (Operator) - גישה בסיסית עם סיסמה אחת משותפת
2. **מנהל** (Admin) - גישה מורחבת עם סיסמה נוספת

### משתני סביבה נדרשים
```env
APP_PASSWORD=סיסמת_מפעילים
ADMIN_PASSWORD=סיסמת_מנהלים  
JWT_SECRET=מפתח_סודי_מינימום_32_תווים
```

### Protected Routes
- `/operator/*` - דורש אימות מפעיל
- `/admin/*` - דורש אימות מנהל
- Middleware: `@/miklaton/middleware.js`

---

## � RBAC - Role-Based Access Control

### תפקידים במערכת

#### 1️⃣ Operator (מפעיל מוקד)
**הרשאות:**
- ✅ הרצת נהלי חירום (FlowRunner)
- ✅ חיפוש מקלטים לתושבים
- ✅ פתיחה/סגירת מקלטים ציבוריים
- ✅ צפייה באנשי קשר תורנים
- ✅ הוספת עדכוני שטח למפה חיה (אם מורשה)
- ❌ ללא גישה לניהול תורנויות
- ❌ ללא גישה לניהול משתמשים

**Redirect:** `/operator`

#### 2️⃣ Manager (מנהל מכלול)
**הרשאות:**
- ✅ כל הרשאות Operator +
- ✅ עריכת תורנויות המכלול שלו
- ✅ הוספה/עריכת עדכוני שטח במפה חיה
- ✅ צפייה בדוחות (כל המכלולים)
- ❌ ללא גישה לניהול משתמשים

**Redirect:** `/manager`

#### 3️⃣ Inspector (פקח)
**הרשאות:**
- ✅ הוספה/עריכה/מחיקה של עדכוני שטח במפה חיה
- ✅ דוחות בדיקה ותיעוד שטח
- ✅ צפייה במקלטים ומפות
- ❌ ללא גישה לנהלי חירום
- ❌ ללא גישה לניהול תורנויות

**Redirect:** `/inspector`

#### 4️⃣ Leadership (הנהלה)
**הרשאות:**
- ✅ דשבורד מנהלים - תצוגה כללית
- ✅ צפייה בכל האירועים והדוחות (Read-Only)
- ✅ צפייה במפה חיה (Read-Only)
- ✅ סטטיסטיקות ותובנות
- ❌ אין הרשאות עריכה

**Redirect:** `/dashboard`

#### 5️⃣ Admin (Super Admin)
**הרשאות:**
- ✅ **גישה מלאה לכל המערכת**
- ✅ ניהול משתמשים (הוספה, הרשאות, איפוס סיסמאות)
- ✅ עריכת נהלים ותוכן
- ✅ Audit Log מלא
- ✅ הגדרות מערכת

**Redirect:** `/admin`

### Permissions Matrix

| תכונה | Operator | Manager | Inspector | Leadership | Admin |
|-------|----------|---------|-----------|------------|-------|
| נהלי חירום | ✅ | ✅ | ❌ | 👁️ | ✅ |
| מקלטים | ✅ | ✅ | ✅ | 👁️ | ✅ |
| מפה חיה - הוספה | 🔶 | ✅ | ✅ | ❌ | ✅ |
| מפה חיה - עריכה | ❌ | ✅ | ✅ | ❌ | ✅ |
| מפה חיה - מחיקה | ❌ | ❌ | ✅ | ❌ | ✅ |
| תורנויות - צפייה | ✅ | ✅ | ❌ | 👁️ | ✅ |
| תורנויות - עריכה | ❌ | ✅* | ❌ | ❌ | ✅ |
| דוחות - צפייה | ✅ | ✅ | ✅ | ✅ | ✅ |
| ניהול משתמשים | ❌ | ❌ | ❌ | ❌ | ✅ |

🔶 לפי הגדרה  |  ✅ מלא  |  👁️ צפייה בלבד  |  ✅* רק המכלול שלו

---

## � Supabase Database Schema

### טבלאות עיקריות

#### 1. `shelter_status`
מעקב אחר פתיחה/סגירה של מקלטים ציבוריים
```sql
- id (UUID, PK)
- shelter_number (VARCHAR, UNIQUE)
- is_open (BOOLEAN)
- updated_at (TIMESTAMP)
- updated_by (VARCHAR)
```

#### 2. `general_notifications`
הודעות כלליות למפעילים
```sql
- id (UUID, PK)
- title (VARCHAR)
- message (TEXT)
- type (VARCHAR) -- info, warning, urgent
- author (VARCHAR)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 3. `war_mode`
סטטוס מצב מלחמה (משפיע על דילוג שלבים)
```sql
- id (UUID, PK)
- is_active (BOOLEAN)
- updated_at (TIMESTAMP)
- updated_by (VARCHAR)
```

#### 4. `departments`
מחלקות בעירייה
```sql
- id (UUID, PK)
- name (VARCHAR)
- created_at (TIMESTAMP)
```

#### 5. `contacts`
אנשי קשר
```sql
- id (UUID, PK)
- full_name (VARCHAR)
- phone (VARCHAR)
- role (VARCHAR)
- created_at (TIMESTAMP)
```

#### 6. `duty_roster`
לוח תורנויות
```sql
- id (UUID, PK)
- contact_id (UUID, FK → contacts)
- department_id (UUID, FK → departments)
- date (DATE)
- shift (VARCHAR) -- day/night
- created_at (TIMESTAMP)
```

---

### טבלאות RBAC (חדש - Phase 1)

#### 7. `user_profiles`
פרופילי משתמשים - מורחב מעבר ל-auth.users
```sql
- id (UUID, PK, FK → auth.users.id)
- full_name (VARCHAR NOT NULL)
- phone (VARCHAR)
- avatar_url (VARCHAR)
- role (VARCHAR DEFAULT 'operator') -- operator|manager|inspector|leadership|admin
- department_id (UUID, FK → departments) -- null for operators/admins
- status (VARCHAR DEFAULT 'pending') -- pending|active|suspended
- approved_by (UUID, FK → auth.users.id)
- approved_at (TIMESTAMP)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**הערה:** משתמש חדש מתחיל ב-status=pending עד שAdmin מאשר.

#### 8. `password_resets`
ניהול איפוס סיסמאות ע"י Admin
```sql
- id (UUID, PK)
- user_id (UUID, FK → auth.users.id)
- temp_password_plain (VARCHAR) -- סיסמה זמנית לשליחה למשתמש
- must_change_password (BOOLEAN DEFAULT true)
- reset_by (UUID, FK → auth.users.id) -- מי מהAdmins איפס
- expires_at (TIMESTAMP) -- 24 שעות
- used_at (TIMESTAMP)
- created_at (TIMESTAMP)
```

#### 9. `audit_log`
תיעוד מלא של פעולות במערכת
```sql
- id (UUID, PK)
- user_id (UUID, FK → auth.users.id)
- action (VARCHAR NOT NULL) -- login|logout|start_event|add_field_event|etc
- resource_type (VARCHAR) -- user|shelter|field_event|duty_roster
- resource_id (UUID)
- details (JSONB) -- פרטים נוספים
- ip_address (VARCHAR)
- user_agent (TEXT)
- created_at (TIMESTAMP)
```

#### 10. `system_settings`
הגדרות גלובליות למערכת
```sql
- key (VARCHAR, PK)
- value (JSONB)
- description (TEXT)
- updated_by (UUID, FK → auth.users.id)
- updated_at (TIMESTAMP)
```

**דוגמאות:**
```json
{
  "require_admin_approval": {"enabled": true},
  "session_duration_hours": {"hours": 8},
  "max_login_attempts": {"attempts": 5},
  "operator_can_edit_map": {"enabled": false}
}
```

---

### טבלאות Live Map (Phase 2 - עתידי)

#### 11. `field_events`
אירועי שטח במפה חיה
```sql
- id (UUID, PK)
- event_type (VARCHAR) -- missile_impact|road_block|work|checkpoint|fire|flood
- title (VARCHAR NOT NULL)
- description (TEXT)
- location_lat (FLOAT NOT NULL)
- location_lng (FLOAT NOT NULL)
- address (VARCHAR)
- severity (VARCHAR) -- low|medium|high|critical
- status (VARCHAR DEFAULT 'active') -- active|resolved|archived
- start_time (TIMESTAMP)
- end_time (TIMESTAMP)
- created_by (UUID, FK → auth.users.id)
- updated_by (UUID, FK → auth.users.id)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- metadata (JSONB) -- תמונות, קבצים, הערות
```

**אינדקסים:**
- idx_field_events_type
- idx_field_events_status
- idx_field_events_location (GIS)

---

### Realtime Subscriptions
המערכת משתמשת ב-Supabase Realtime עבור:
- עדכוני מצב מלחמה בזמן אמת
- סטטוס מקלטים
- הודעות כלליות

---

## 🚨 מערכת נהלי תפעול (FlowRunner)

### קובץ מרכזי
`@/miklaton/data/alertFlows.json`

### Flows זמינים
1. **early_warning_then_alarm** - התראה מוקדמת ← אזעקה
2. **direct_alarm** - אזעקה ישירה

### סוגי שלבים (Step Types)

#### 1. `decision`
שאלה עם תשובה כן/לא או multi-option
```json
{
  "type": "decision",
  "question": "השאלה?",
  "yesNext": "step_id_if_yes",
  "noNext": "step_id_if_no",
  "options": ["אופציה 1", "אופציה 2"] // אופציונלי
}
```

#### 2. `action`
רשימת פעולות לביצוע + אופציה ל-form fields
```json
{
  "type": "action",
  "checklist": ["פעולה 1", "פעולה 2"],
  "formFields": [...], // אופציונלי
  "copyMessage": "הודעה להעתקה", // אופציונלי
  "nextStep": "next_step_id"
}
```

#### 3. `form`
טופס עצמאי לאיסוף מידע
```json
{
  "type": "form",
  "formFields": [
    {
      "name": "field_name",
      "label": "תווית",
      "type": "text|textarea|select|time|location",
      "required": true
    }
  ]
}
```

#### 4. `activations` (הקפצות)
רשימת אנשי קשר תורנים עם checkboxes
```json
{
  "type": "activations",
  "label": "הקפצות לגורמים",
  "departments": ["leadership", "security"],
  "nextStep": "next_step_id"
}
```

### תכונות מיוחדות
- **Timer** - ספירה לאחור עם התראה קולית
- **War Mode** - דילוג אוטומטי על שלבי מקלטים והתקשרויות
- **Event Log** - תיעוד מפורט של כל פעולה עם timestamps
- **Copy to Clipboard** - העתקת הודעות מוכנות
- **Form Validation** - וולידציה לשדות נדרשים
- **Variable Substitution** - החלפת משתנים בהודעות

### מצב מלחמה (War Mode)
כאשר מופעל:
- ⏭️ דילוג אוטומטי על שלבי "מקלטים"
- ⏭️ דילוג אוטומטי על שלבי "התקשרויות"
- 🚨 הצגת באנר אדום בכל המערכת

---

## 📞 מערכת תורנויות

### מבנה נתונים - onCall.json
```json
{
  "weekLabel": "עודכן DD.MM.YYYY",
  "departments": {
    "department_id": {
      "name": "שם המחלקה",
      "contacts": [
        {
          "id": "contact_id",
          "name": "שם מלא",
          "phone": "050-XXX-XXXX",
          "shift": "24/7|רגיל",
          "active": true
        }
      ]
    }
  }
}
```

### מחלקות (Departments)
1. `leadership` - הנהלת העירייה
2. `security` - מכלול בטחון
3. `population` - מכלול אוכלוסיה
4. `public_info` - מכלול מידע לציבור
5. `info_population` - עיבוד מידע ואוכלוסיה
6. `engineering` - הנדסה ותשתיות
7. `hr` - כוח אדם
8. `education` - חינוך
9. `logistics` - לוגיסטיקה ותפעול
10. `psah` - תא פס"ח

### Components
- **WeeklyDutyRoster** - תצוגת לוח שבועי
- **OnCallPanel** - פאנל מהיר לתצוגה
- **OnCallManagerNew** - ניהול מתקדם עם Supabase
- **WhatsAppDutyLinks** - יצירת קישורי וואטסאפ

---

## 🏠 מערכת מקלטים

### shelters.json - מבנה
```json
{
  "id": "shelter-XXX",
  "number": "XXX",
  "type": "מקלט|ממ\"ד",
  "name": "שם המקלט",
  "address": "כתובת מלאה",
  "neighborhood": "שכונה",
  "landmarks": "ציוני דרך",
  "directions": "הוראות הגעה",
  "accessibility": "נגיש|לא נגיש|לא ידוע",
  "capacity": 100,
  "lat": 32.xxx,
  "lng": 34.xxx,
  "address_en": "English address"
}
```

### Components
- **ShelterSearch** - חיפוש 3 מקלטים קרובים לכתובת
- **ShelterMap** - מפה אינטראקטיבית עם Leaflet
- **ShelterStatusManager** - פתיחה/סגירה מקלטים ציבוריים
- **PrintableShelterList** - רשימה להדפסה

### Geocoding
- **Development**: Nominatim (OpenStreetMap) - חינם, 1 req/sec
- **Production**: אפשרות ל-Google Maps Geocoding API

---

## 🔧 Scripts כלי עזר

### גיאוקודינג
- `google-geocode.js` - המרת כתובות דרך Google API
- `update-shelter-coordinates.js` - עדכון קואורדינטות מקלטים

### רחובות ואזורים  
- `fetch-streets-google.js` - שליפת רשימת רחובות מ-Google
- `fetch-streets-osm.js` - שליפת רחובות מ-OpenStreetMap

### מקלטים
- `add-public-shelters.js` - הוספת מקלטים ציבוריים לרשימה
- `update-shelters.js` - עדכון כללי של נתוני מקלטים

---

## 🚀 הרצה ופריסה

### Development
```bash
npm install
npm run dev
# http://localhost:3000
```

### Production Build
```bash
npm run build
npm start
```

### Deploy ל-Vercel
1. חבר את הריפו ל-Vercel
2. הגדר משתני סביבה ב-Vercel Settings
3. Deploy אוטומטי בכל push

### משתני סביבה ל-Production
```env
APP_PASSWORD=***
ADMIN_PASSWORD=***
JWT_SECRET=***
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=***
NEXT_PUBLIC_EKRON_URL=https://forms.yehud-monosson.muni.il/...
NEXT_PUBLIC_INCIDENT_FORM_URL=https://...
```

---

## 📊 API Routes Summary

| Route | Method | תיאור |
|-------|--------|-------|
| `/api/auth/login` | POST | התחברות JWT |
| `/api/auth/logout` | POST | התנתקות |
| `/api/auth/verify` | GET | אימות טוקן |
| `/api/contacts` | GET/POST/PUT/DELETE | ניהול אנשי קשר |
| `/api/departments` | GET/POST | ניהול מחלקות |
| `/api/duty-roster` | GET/POST/DELETE | לוח תורנויות |
| `/api/duty-form` | POST | שליחת טופס תורנות |
| `/api/geocode` | POST | המרת כתובות |
| `/api/inspection` | GET/POST | דוחות בדיקה |
| `/api/notifications` | GET/POST/DELETE | הודעות כלליות |
| `/api/shelter-status` | GET/POST | סטטוס מקלטים |
| `/api/war-mode` | GET/POST | מצב מלחמה |

---

## 🎯 User Flows

### מפעיל (Operator)
1. התחברות עם סיסמה → `/operator`
2. בחירת סוג אירוע (התראה מוקדמת / אזעקה ישירה)
3. הרצת Flow עם FlowRunner
4. חיפוש מקלט לתושב
5. ניהול פתיחת מקלטים ציבוריים
6. צפייה בתורנים שבועיים

### מנהל (Admin)
1. התחברות עם 2 סיסמאות → `/admin`
2. ניהול תורנויות (הפעלה/כיבוי אנשי קשר)
3. הוספת קואורדינטות למקלטים
4. צפייה ועריכת נהלי תפעול
5. ניהול הודעות כלליות
6. הפעלת/כיבוי מצב מלחמה

---

## 🔄 Real-time Features

### Supabase Realtime Channels
1. **War Mode Changes** - עדכון מצב מלחמה בזמן אמת לכל המפעילים
2. **Shelter Status** - סינכרון סטטוס מקלטים בין מפעילים
3. **General Notifications** - הודעות חדשות מתעדכנות אוטומטית

---

## 📝 הערות חשובות

### מגבלות ידועות
1. ❌ אין בסיס נתונים לכל השינויים - חלק ב-localStorage (זמני)
2. ❌ סיסמה משותפת לכל המפעילים - אין אפשרות לעקוב מי עשה מה
3. ⚠️ תלוי באינטרנט לגיאוקודינג
4. ⚠️ Nominatim Rate Limiting - 1 בקשה/שנייה

### שדרוגים עתידיים מומלצים
- [ ] מעבר ל-Google Maps API לדיוק גבוה יותר
- [ ] ניהול משתמשים אישי עם audit log
- [ ] התראות Push למפעילים
- [ ] אינטגרציה מלאה עם Ekron
- [ ] אפליקציה סלולרית

---

## 🆘 Troubleshooting

### בעיות התחברות
- בדוק `.env.local` קיים ומכיל `APP_PASSWORD`, `ADMIN_PASSWORD`, `JWT_SECRET`
- נקה cookies ונסה שוב
- בדוק Console ב-DevTools לשגיאות

### בעיות Supabase
- וודא ש-`NEXT_PUBLIC_SUPABASE_URL` ו-`NEXT_PUBLIC_SUPABASE_ANON_KEY` מוגדרים
- הרץ `supabase/schema.sql` ב-SQL Editor
- בדוק RLS Policies מופעלים

### בעיות גיאוקודינג
- שמור קואורדינטות ב-JSON במקום לסמוך על API
- השתמש ב-Admin Panel להוספת קואורדינטות
- אם Google API נדרש, הוסף API Key

---

## 📞 Contact & Support

לשאלות ותמיכה טכנית:
- IT העירוני יהוד-מונוסון
- מנהלת המוקד: מירי צרפתי

---

**© עיריית יהוד-מונוסון 2026**
**מערכת פנימית לשימוש עירוני בלבד**
