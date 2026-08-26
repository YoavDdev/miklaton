# דוח יומי — טבלת אגפים אוטומטית משני קבצים, Excel מעוצב, ו-PDF

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** טבלת האגפים בדוח היומי מחושבת אוטומטית משני ייצואי בינה (קובץ היום + קובץ פתוחות), ה-Excel המופק מעוצב כמו הדוח הידני האמיתי (כחול, גבולות, RTL), ויש הפקת PDF דרך עמוד הדפסה.

**Architecture:** הפרסר ב-`lib/binaa-tickets.js` מתעדכן לפורמט ה-19-עמודות האמיתי (כולל עמודת "אגף" מובנית ו-SLA), ומקבל שתי פונקציות חדשות: זיהוי סוג הייצוא וחישוב טבלת האגפים. בונה ה-Excel עובר מ-`xlsx` (בלי עיצוב) ל-`exceljs` עם שכבת layout טהורה וניתנת לבדיקה. PDF = עמוד HTML מעוצב להדפסה שנפתח בחלון חדש (`window.print()`), לפי החלטת הנסיגה ב-docs/16 — אין תלות חדשה ואין סיכון RTL בשרת.

**Tech Stack:** Next.js 14, exceljs (חדש), vitest. הקבצים הגולמיים של יואב לא נכנסים לריפו — פיקסטורות מותממות בלבד.

**Spec:** `docs/16-daily-report-design.md` + הזיכרון `bina-export-format.md` (פורמט הייצוא האמיתי, אומת מול דוחות 25-26.08).

## Global Constraints

- עברית בקוד ובבדיקות כמו בשאר הריפו; הערות מוסיפות רק מה שהקוד לא אומר.
- אסור להכניס לריפו קבצים גולמיים מבינה (PII) — פיקסטורות מותממות בלבד.
- פורמט ה-Excel המופק חייב להישאר זהה במבנה לדוחות הידניים (רשימת התפוצה לא מרגישה שינוי).
- הבדיקות הקיימות ב-`tests/binaa-tickets.test.js` ו-`tests/daily-report-excel.test.js` ממשיכות לעבור (תאימות לאחור לפורמט הפיקסטורה הישן).
- עבודה על branch `yoa-42-auto-agaf-pdf`, קומיט בסוף כל משימה.

---

### Task 1: פיקסטורות בפורמט האמיתי (19 עמודות)

**Files:**
- Create: `tests/fixtures/binaa-day-sample.csv` — קובץ יום: 12 שורות, כולן 25/08/26, סטטוסים מעורבים (סגורים ופתוחים), פנייה-בת אחת (`-ב`), SLA מגוון כולל `100.00%` ו-` -`, שלושה אגפים (שפ"ע/בטחון/חינוך; הנדסה בכוונה חסרה — כמו בקובץ האמיתי).
- Create: `tests/fixtures/binaa-open-sample.csv` — קובץ פתוחות: 10 שורות מתאריכים שונים (יולי-אוגוסט), כל הסטטוסים פתוחים, SLA חלקו ≥ 100%, כל ארבעת האגפים.

שתי הפיקסטורות עם BOM, כל שדה במרכאות, שמות/טלפונים בדויים, כותרת 19 העמודות המדויקת:

```
"מועדפים","מס' פניה","תאריך ושעת פתיחה","סטטוס פנייה","שם הפונה","טלפון נייד","כתובת ואתר/מוסד","מחלקה","נושא","תיאור","תמונות ומסמכים?","מדד SLA לפני חריגה","מדד SLA הגעה לאירוע לפני חריגה","אגף","דירוג המפגע","כביש מדרכה","הערות","תמונה","מספר רישוי"
```

מספרי הביקורת של קובץ היום (לבדיקה ב-Task 3): שפ"ע נפתחו 6 / טופלו 3, בטחון 4/2, חינוך 2/0, הנדסה 0/0. קובץ הפתוחות: שפ"ע 4 פתוחות/1 חורגת, בטחון 2/1, חינוך 3/2, הנדסה 1/1.

- [ ] כתיבת שתי הפיקסטורות לפי הספירות למעלה, כולל ערך אגף `אגף שפ"ע` (עם הקידומת, לבדיקת הנרמול)
- [ ] קומיט: `test: fixtures בפורמט הייצוא האמיתי של בינה - קובץ יום וקובץ פתוחות (YOA-42)`

### Task 2: פרסר — פורמט חדש, נרמול אגף, SLA, זיהוי סוג קובץ

**Files:**
- Modify: `lib/binaa-tickets.js`
- Test: `tests/binaa-tickets.test.js` (הרחבה; הבדיקות הישנות נשארות)

**Interfaces (Produces):**
- כל ticket מקבל שדות חדשים: `agaf` (מנורמל: `'שפ"ע'|'בטחון'|'חינוך'|'הנדסה'` או הערך הגולמי), `slaPct` (number או null).
- `isClosedStatus(status) → boolean` — מכיל 'הסתיים' או 'סגור', או אחד מ-`['לא יבוצע','פניה כפולה']`.
- `detectExportKind(tickets) → 'day' | 'open'` — `'open'` אם אין אף פנייה בסטטוס סגור או אם יש יותר מ-4 ימי פתיחה שונים; אחרת `'day'`.

- [ ] בדיקות נכשלות: פרסינג הפיקסטורה החדשה (agaf מנורמל גם עם קידומת "אגף ", slaPct של `26.29%`→26.29 ושל ` -`→null), `isClosedStatus` על 'הטיפול הסתיים'/'וטרינריה - סטטוס סגור'/'בטיפול', `detectExportKind` על שתי הפיקסטורות
- [ ] מימוש: הוספת `'מדד SLA לפני חריגה': 'slaRaw'` ו-`'אגף': 'agafRaw'` ל-HEADER_MAP (העמודות הישנות נשארות — קובץ ישן ממשיך לעבוד), `normalizeAgaf` (הסרת קידומת `אגף `), `parseSlaPct`, `isClosedStatus`, `detectExportKind`
- [ ] `npx vitest run tests/binaa-tickets.test.js` — הכול עובר, כולל הבדיקות הישנות
- [ ] קומיט: `feat: פרסר בינה - פורמט 19 עמודות, נרמול אגף, SLA וזיהוי סוג ייצוא (YOA-42)`

### Task 3: חישוב טבלת האגפים משני הקבצים

**Files:**
- Modify: `lib/binaa-tickets.js`
- Test: `tests/binaa-tickets.test.js`

**Interfaces (Produces):**
```js
computeAgafTable(dayTickets, openTickets, reportDate) → {
  'שפ"ע': { opened, handled, open_total, overdue }, // וכן בטחון/חינוך/הנדסה
}
```
- `opened` = שורות קובץ היום בחלון הדוח (`reportWindow`) לפי אגף, **כולל** פניות-בנות (כך דנה סופרת — אומת מול דוח 25.08).
- `handled` = מתוכן, בסטטוס סגור (`isClosedStatus`).
- `open_total` = כל שורות קובץ הפתוחות לפי אגף (בלי סינון סטטוס — בינה כבר סיננה).
- `overdue` = מתוכן, `slaPct >= 100`.
- `dayTickets` או `openTickets` ריקים/null → העמודות שלהם `''` (מילוי ידני נשאר אפשרי).

- [ ] בדיקות נכשלות מול מספרי הביקורת של הפיקסטורות, כולל מקרה `openTickets=null` → `open_total: ''`
- [ ] מימוש `computeAgafTable`
- [ ] `npx vitest run tests/binaa-tickets.test.js` — עובר
- [ ] קומיט: `feat: חישוב טבלת האגפים אוטומטית משני ייצואי בינה (YOA-42)`

### Task 4: Excel מעוצב עם exceljs

**Files:**
- Modify: `lib/daily-report-excel.js`
- Modify: `package.json` (`npm install exceljs`)
- Test: `tests/daily-report-excel.test.js` (הבדיקות הישנות על `buildReportRows` נשארות; נוספות בדיקות layout ו-workbook)

**Interfaces (Produces):**
- `buildReportLayout(snapshot, reportDateLabel) → [{ cells: [...], kind }]` — kind אחד מ-`'title'|'section'|'header'|'data'|'spacer'|'signature'`; אותו סדר שורות בדיוק כמו `buildReportRows` היום (הבדיקות הישנות מוכיחות).
- `buildReportRows(snapshot, label)` — נגזר מה-layout (`layout.map(r => r.cells)` עם spacer=`[]`) — חתימה קיימת, לא נשברת.
- `buildStyledWorkbook(snapshot, label) → Promise<ExcelJS.Workbook>` — גיליון `'גיליון1'`, RTL (`views: [{ rightToLeft: true }]`), והעיצוב שנמדד מהדוח האמיתי של 26.08:
  - title: מילוי `FF8EAADB`, Arial 12 bold, גובה 30, מיושר מרכז
  - section/header: מילוי `FFB4C6E7`, Arial 14 bold (כותרת טבלת אגפים 16), גובה 40
  - data: Assistant 14, גובה לפי תוכן (`max(30, מס' שורות משוער × 15 + 12)`), wrapText, מיושר מרכז
  - גבולות thin לכל תא בשימוש, רוחבי עמודות `[31, 45, 30, 16, 16]`
- `downloadStyledExcel(snapshot, label, fileName)` — צד לקוח: `writeBuffer` → Blob → הורדה.

- [ ] `npm install exceljs`
- [ ] בדיקות נכשלות: layout משמר את הסדר (title בשורה 0, אגף בשורה 2, kinds נכונים), `buildStyledWorkbook` — RTL פעיל, `getCell('A1').fill.fgColor.argb === 'FF8EAADB'`, `A3` עם `FFB4C6E7` ו-bold, `B4` (ערך שפ"ע) עם border thin
- [ ] מימוש: layout + רנדור exceljs + עדכון `buildReportWorkbook` הישן להיעלם (הקריאות היחידות בדף — יוחלפו ב-Task 6; בינתיים נשאר export ישן כדי לא לשבור build)
- [ ] `npx vitest run tests/daily-report-excel.test.js` — עובר
- [ ] קומיט: `feat: Excel מעוצב בפורמט הדוח הידני - exceljs, RTL, צבעים וגבולות (YOA-42)`

### Task 5: PDF דרך עמוד הדפסה

**Files:**
- Create: `lib/daily-report-print.js`
- Test: `tests/daily-report-print.test.js`

**Interfaces (Produces):**
- `buildReportHtml(snapshot, label) → string` — מסמך HTML מלא: `dir="rtl"`, `<title>דוח סיכום יומי ...</title>` (שם הקובץ המוצע ב-Save as PDF), CSS מוטמע: אותם צבעים (`#8EAADB` כותרת, `#B4C6E7` כותרות מקטע), טבלאות עם גבולות, `@media print` עם `-webkit-print-color-adjust: exact`. נבנה מ-`buildReportLayout` — מקור אמת אחד למבנה.
- `openPrintPdf(snapshot, label)` — פותח `window.open('', '_blank')`, כותב את ה-HTML, וקורא `print()` אחרי טעינה. נקרא רק מלחיצת כפתור (לא אוטומטית — חוסמי פופאפ).

- [ ] בדיקות נכשלות: ה-HTML מכיל `dir="rtl"`, את הכותרת, את ערכי האגפים, את החתימות, ואת צבע `#B4C6E7`
- [ ] מימוש
- [ ] `npx vitest run tests/daily-report-print.test.js` — עובר
- [ ] קומיט: `feat: הפקת PDF לדוח היומי דרך עמוד הדפסה RTL (YOA-42)`

### Task 6: הדף — העלאה כפולה, טבלה אוטומטית, כפתורי PDF

**Files:**
- Modify: `app/daily-report/page.js`

**Consumes:** `detectExportKind`, `computeAgafTable` (Task 2-3), `buildStyledWorkbook`/`downloadStyledExcel` (Task 4), `openPrintPdf` (Task 5).

- [ ] אזור העלאה אחד עם `multiple`: כל קובץ מפורסר ומסווג ב-`detectExportKind`; שני "חריצים" מוצגים עם ✓ — "פניות היום" ו"פניות פתוחות". קובץ יום פותח טיוטה (כמו היום); קובץ פתוחות בלי קובץ יום — הודעה שמחכים לקובץ היום.
- [ ] כששני הקבצים בפנים (או אחד): `setAgaf` מהתוצאה של `computeAgafTable` (המרה למחרוזות לשדות), עם שורת הסבר "חושב אוטומטית מהקבצים — אפשר לתקן ידנית". קובץ פתוחות חסר → open_total/overdue נשארים ריקים + הערה.
- [ ] `produce` עובר ל-`downloadStyledExcel`; `source_file_name` = שני השמות מופרדים ב-` + `; ל-snapshot נוסף `open_ticket_count` (סך שורות קובץ הפתוחות, לתיעוד).
- [ ] כפתור `🖨️ PDF` ליד "הפק דוח" (מהטיוטה הנוכחית) וכפתור PDF בכל שורת היסטוריה (`openPrintPdf(r.snapshot, label)`).
- [ ] `npx vitest run` מלא + `npm run lint` — ירוקים
- [ ] קומיט: `feat: העלאה כפולה, טבלת אגפים אוטומטית וכפתורי PDF בדף הדוח היומי (YOA-42)`

### Task 7: עדכון האפיון והסגירה

**Files:**
- Modify: `docs/16-daily-report-design.md`

- [ ] עדכון טבלת המקטעים: מקטע 1 מ"ידני" ל"אוטומטי משני ייצואים, עריכה ידנית אפשרית"; סעיף חדש "שני ייצואי בינה" עם רשימת הסטטוסים הפתוחים שנצפו והכלל `SLA ≥ 100% = חורגת`; סעיף PDF: הוחלט (26.08) על עמוד הדפסה במקום PDF שרת — האיכות זהה והסיכון אפס.
- [ ] `npm run build` — עובר
- [ ] קומיט: `docs: עדכון אפיון הדוח היומי - שני ייצואים, טבלה אוטומטית, PDF בהדפסה (YOA-42)`

## Self-Review

- כיסוי: טבלה אוטומטית (T2-T3+T6), "יפה" (T4), PDF (T5-T6), פורמט חדש (T1-T2), אפיון (T7) — כל דרישות יואב מכוסות.
- אין placeholders; החתימות עקביות (`computeAgafTable` נצרך ב-T6 כפי שהוגדר ב-T3; `buildReportLayout` נצרך ב-T5 כפי שהוגדר ב-T4).
- תאימות לאחור: `buildReportRows` נשמר; בדיקות ישנות ממשיכות לרוץ.
