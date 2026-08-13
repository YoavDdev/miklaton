# 05 — קומפוננטות, נתונים וספריות עזר

## קומפוננטות פעילות (`components/`)

### מוקד / מוקדן
| קומפוננטה | תיאור | בשימוש ב- |
|-----------|-------|-----------|
| `CallGuide` | מדריך שיחות: קטגוריות + אנשי קשר לפי אסקלציה וזמינות | `/operator`, `/operator/call-guide` |
| `CallCategoryManager` | ניהול קטגוריות שיחה ואנשי קשר | `/call-center-manager` |
| `FlowRunner` | נהלי חירום שלב-אחר-שלב (מ-`data/alertFlows.json`) | `/operator` |
| `OperatorTasks` | משימות המוקדן | `/operator`, `/operator/tasks` |
| `OperatorNotifications` | התראות למוקדן | `/operator` |
| `DailyUpdatesPanel` | עדכונים יומיים עם סינון לפי זמן | `/operator` |
| `PanicButtonSearch` | חיפוש וניהול לחצני מצוקה + הדפסה | `/operator` |
| `GarbageStreetSearch` | חיפוש פינוי גזם לפי רחוב | `/operator`, `/call-center-manager` |
| `GarbageScheduleInline` | תצוגת לוח פינוי | `/call-center-manager` |
| `SecurityFieldStatus` | מי בשטח עכשיו (ביטחון) — Realtime | `/operator` |
| `CallCenterSchedule` + `CallCenterExcelImporter` | סידור עבודה מוקד + ייבוא Excel | `/call-center-manager` |

### מקלטים
| קומפוננטה | תיאור |
|-----------|-------|
| `ShelterSearch` | חיפוש 3 מקלטים קרובים לכתובת (autocomplete + geocoding) |
| `ShelterMap` | מפת Leaflet עם סימוני מקלטים (נטענת דינמית) |
| `ShelterStatusManager` | פתיחה/סגירה של מקלטים ציבוריים (כולל "פתח הכול") |
| `PrintableShelterList` | רשימת מקלטים להדפסה A4 |
| `AddressInput` | קלט כתובת עם השלמת רחובות וגיאוקודינג |

### תורנויות וכוננים
| קומפוננטה | תיאור |
|-----------|-------|
| `OnCallManagerNew` | ניהול תורנויות מלא (Supabase) — מנהלת מוקד |
| `WeeklyDutyRoster` | לוח תורנויות שבועי עם "מי תורן עכשיו" |
| `VacationManager` | ניהול חופשות והחלפות |
| `WhatsAppDutyLinks` | יצירת קישורי WhatsApp לטפסי תורנות למנהלי מחלקות |

### ביטחון
| קומפוננטה | תיאור |
|-----------|-------|
| `SecurityWeeklySchedule` | סידור עבודה שבועי ביטחון (כולל ייבוא Excel ופקודת יום) |
| `ExcelImporter` / `ExcelTemplateDownloader` | עזרי ייבוא/תבניות Excel |

### מאגר ידע ו-AI
| קומפוננטה | תיאור |
|-----------|-------|
| `KnowledgeBaseManager` | ניהול ערכי מאגר ידע — מנהלת מוקד |
| `KnowledgeChat` / `KnowledgeChatSidebar` | צ'אט AI למוקדן (OpenAI) |

### אירועים, סקרים ותצוגה
| קומפוננטה | תיאור |
|-----------|-------|
| `ActiveEventBanner` | באנר אירוע פעיל (Realtime) — בכל הדשבורדים |
| `EventMap` | מפת אירוע עם סימונים וחסימות |
| `StatusSelector` | בחירת סטטוס שטח (בדרך/הגעתי/מטפל...) |
| `SurveyManager` | ניהול סקרים + סטטיסטיקות + ייצוא Excel |
| `WeatherAlertBar` | התראות מזג אוויר (מסך מוקד) |
| `AutoRefresh` | רענון אוטומטי (מסך מוקד) |
| `Navbar` / `ConditionalNavbar` | ניווט לפי תפקיד (ב-layout הראשי) |

## קבצי נתונים (`data/`)

### פעילים
| קובץ | תיאור |
|------|-------|
| `shelters.json` | **מאגר המקלטים** — שמות, כתובות, קואורדינטות, נגישות. מקור האמת! |
| `streets.json` | רשימת רחובות להשלמה אוטומטית |
| `alertFlows.json` | הגדרות נהלי חירום (FlowRunner) |
| `app-guide.json` | תוכן מדריך המערכת שמוזן לצ'אט ה-AI |
| `zoneAssignments.json` | חלוקת מקלטים ורחובות לאזורי פיקוח A/B/C |
| `callCategories.json` | קטגוריות שיחה סטטיות (גיבוי/ייחוס) |
| `inspectionReports.json` | דוחות פיקוח (נכתב ע"י `/api/inspection`) |

### ישנים
- `onCall.json`, `shelterStatus.json` — הועברו ל-`archive/data/` (הוחלפו ב-Supabase)
- `google-coordinates.json`, `shelter-coordinates-updated.json` — נשארו ב-`data/` כי סקריפטי הקואורדינטות משתמשים בהם, אך אינם בשימוש בזמן ריצה

## ספריות עזר (`lib/`)

| קובץ | תיאור | סטטוס |
|------|-------|--------|
| `auth.js` | JWT: חתימה, אימות, verifyAuth — בשימוש ~23 routes | פעיל |
| `auth-edge.js` | אימות JWT ב-Edge (jose) — ל-middleware | פעיל |
| `distance.js` | חישוב מרחק (Haversine) ומציאת מקלטים קרובים | פעיל |
| `municipality.js` | הגדרות עירייה ממשתני סביבה | פעיל, נפוץ |
| `rtl.js` | עזרי RTL | לא בשימוש |
| `supabase.js` | Supabase client משותף | לא בשימוש (קומפוננטות יוצרות client ישירות) |

## סקריפטים שימושיים (`scripts/`)

| קובץ | תיאור |
|------|-------|
| `generate-version.js` | רץ בכל build — יוצר `public/version.json` |
| `seed-knowledge-base.js` | זריעת מאגר ידע ראשוני |
| `google-geocode.js`, `update-shelter-coordinates.js`, `update-exact-coords.js`, `update-shelters.js`, `add-public-shelters.js` | תחזוקת קואורדינטות מקלטים |
| `fetch-streets-google.js`, `fetch-streets-osm.js` | יצירת רשימת רחובות |

קבצי ה-SQL ב-`scripts/` מתועדים ב-[04-database.md](./04-database.md); קבצי hotfix חד-פעמיים הועברו ל-`scripts/archive/`.
