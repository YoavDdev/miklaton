# 🧠 מאגר ידע AI למוקד

## מה זה?
מערכת ידע חכמה למוקדנים - ממשק צ'אט בסגנון ChatGPT שעונה על שאלות בזמן אמת,
על בסיס מאגר ידע שמנהל המוקד בונה ומעדכן.

---

## ארכיטקטורה

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  מוקדן (צ'אט)   │────▶│  API /knowledge  │────▶│  Supabase   │
│  KnowledgeChat  │     │     -chat        │     │  knowledge  │
└─────────────────┘     └───────┬──────────┘     │  _base      │
                                │                └─────────────┘
                                ▼
                        ┌──────────────┐
                        │  OpenAI API  │
                        │  gpt-4o-mini │
                        └──────────────┘
```

**הזרימה:**
1. מוקדן שואל שאלה בצ'אט
2. המערכת מחפשת ערכים רלוונטיים ב-Supabase (לפי מילות מפתח)
3. שולחת את הערכים הרלוונטיים + השאלה ל-OpenAI
4. OpenAI מחזיר תשובה מדויקת בעברית
5. התשובה מוצגת למוקדן + נשמרת בהיסטוריה

---

## טבלאות (Supabase)

### `knowledge_base` - מאגר הידע
| שדה | סוג | תיאור |
|------|------|--------|
| id | UUID | מזהה ייחודי |
| title | TEXT | כותרת הערך (לדוגמה: "גרירת רכבים נטושים") |
| content | TEXT | התוכן המלא - כל המידע הרלוונטי |
| category | TEXT | קטגוריה (פיקוח/תברואה/חירום/רישוי/תשתיות/ביטחון/רווחה/חינוך/כללי) |
| tags | TEXT[] | תגיות לחיפוש (["רכב", "גרירה", "נטוש"]) |
| contacts | JSONB | אנשי קשר רלוונטיים ([{name, phone, role}]) |
| created_by | TEXT | מי יצר |
| updated_by | TEXT | מי עדכן אחרון |
| created_at | TIMESTAMPTZ | תאריך יצירה |
| updated_at | TIMESTAMPTZ | תאריך עדכון |
| is_active | BOOLEAN | האם פעיל (מחיקה רכה) |

### `knowledge_chat_history` - היסטוריית שאלות
| שדה | סוג | תיאור |
|------|------|--------|
| id | UUID | מזהה |
| user_name | TEXT | שם המוקדן ששאל |
| question | TEXT | השאלה |
| answer | TEXT | התשובה שהתקבלה |
| sources | UUID[] | מזהי ערכים שהשתמשו בהם |
| created_at | TIMESTAMPTZ | מתי נשאלה |

---

## API Routes

### `GET /api/knowledge-base`
מחזיר ערכים מהמאגר.

**Query params:**
- `search` - חיפוש חופשי בכותרת/תוכן
- `category` - סינון לפי קטגוריה

**Response:** `{ success: true, entries: [...] }`

### `POST /api/knowledge-base`
יוצר ערך חדש.

**Body:**
```json
{
  "title": "גרירת רכבים נטושים",
  "content": "תוכן מלא...",
  "category": "פיקוח",
  "tags": ["רכב", "גרירה"],
  "contacts": [{"name": "אשר כהן", "phone": "050-2107481", "role": "גרר"}],
  "created_by": "מנהל מוקד"
}
```

### `PUT /api/knowledge-base`
עדכון ערך קיים (דורש `id` ב-body).

### `DELETE /api/knowledge-base?id=<uuid>`
מחיקה רכה (סימון is_active=false).

### `POST /api/knowledge-chat`
שאילתת AI.

**Body:**
```json
{
  "question": "מה עושים עם רכב נטוש?",
  "user_name": "יוסי מוקדן"
}
```

**Response:**
```json
{
  "success": true,
  "answer": "תשובה מפורטת...",
  "sources": [{"id": "uuid", "title": "גרירת רכבים נטושים"}]
}
```

---

## קומפוננטות

| קומפוננטה | מיקום | תיאור |
|------------|--------|--------|
| `KnowledgeChat` | דף operator | ממשק צ'אט AI למוקדנים |
| `KnowledgeBaseManager` | דף call-center-manager (טאב "מאגר ידע") | ניהול ערכים - הוספה/עריכה/מחיקה |

---

## התקנה והפעלה

### 1. הרצת מיגרציה
הרץ את הקובץ `supabase/migrations/20260722_knowledge_base.sql` ב-Supabase SQL Editor.

### 2. הגדרת OpenAI API Key
הוסף ל-`.env.local`:
```env
OPENAI_API_KEY=sk-proj-...
```

ניתן להשיג מפתח מ: https://platform.openai.com/api-keys

### 3. (אופציונלי) הרצת Seed
```bash
node scripts/seed-knowledge-base.js
```
יכניס ערך לדוגמה (גרירת רכבים נטושים) למאגר.

---

## עלויות OpenAI

המודל: **gpt-4o-mini** (הזול ביותר של OpenAI)
- ~$0.15 לכל 1M tokens קלט
- ~$0.60 לכל 1M tokens פלט
- בממוצע: **כ-0.5-2 אגורות לשאלה**
- 1000 שאלות ביום ≈ 5-20 ₪ ליום

---

## איך להוסיף ידע למאגר

1. היכנס כמנהל מוקד → טאב "🧠 מאגר ידע"
2. לחץ "+ ערך חדש"
3. מלא:
   - **כותרת** - קצרה וברורה (לדוגמה: "גרירת רכבים נטושים")
   - **קטגוריה** - בחר מהרשימה
   - **תוכן** - כל המידע המפורט. ככל שיותר מפורט, התשובות יהיו טובות יותר
   - **תגיות** - מילות מפתח מופרדות בפסיק
   - **אנשי קשר** - שם + טלפון + תפקיד (אופציונלי)
4. שמור

### טיפים לכתיבת ערכים טובים:
- כתוב כאילו אתה מסביר למוקדן חדש
- הוסף מקרים מיוחדים (edge cases)
- ציין מה להגיד ומה **לא** להגיד לתושב
- הוסף מספרי טלפון רלוונטיים
- פרק לנקודות ברורות

---

## קבצים

```
supabase/migrations/20260722_knowledge_base.sql  - מיגרציה
app/api/knowledge-base/route.js                  - API מאגר ידע
app/api/knowledge-chat/route.js                  - API צ'אט AI
components/KnowledgeChat.js                      - UI צ'אט (מוקדן)
components/KnowledgeBaseManager.js               - UI ניהול (מנהל)
scripts/seed-knowledge-base.js                   - סקריפט seed
```
