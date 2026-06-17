# 👥 OnCallDynamic Component

רכיב React לתצוגת כוננים נוכחיים בזמן אמת.

---

## 🎯 תכונות

### ✅ תצוגה דינמית
- מציג את הכוננים הפעילים **כרגע** לכל מחלקה
- עדכון אוטומטי כל 5 דקות
- כפתור רענון ידני

### ✅ התראות חכמות
- זיהוי אוטומטי של מחלקות 24/7 ללא כונן
- הצגת התראות בולטת בראש הרכיב
- סימון ויזואלי של מחלקות בעייתיות

### ✅ פעולות מהירות
- **התקשר** - פתיחת אפליקציית טלפון
- **העתק** - העתקת מספר ללוח
- תצוגה ברורה של פרטי הכונן

### ✅ סוגי כוננים
- **כונן קבוע** - תג ירוק
- **כונן חיצוני** - תג כחול עם שם החברה
- **כונן זמני** - מוצג ללא תג מיוחד

---

## 📦 שימוש

### דוגמה בסיסית:

```jsx
import OnCallDynamic from '@/components/OnCallDynamic';

export default function MyPage() {
  const municipalityId = 'your-municipality-id';
  
  return (
    <div>
      <OnCallDynamic municipalityId={municipalityId} />
    </div>
  );
}
```

### דוגמה עם טעינה:

```jsx
'use client';

import { useState, useEffect } from 'react';
import OnCallDynamic from '@/components/OnCallDynamic';

export default function MyPage() {
  const [municipalityId, setMunicipalityId] = useState(null);

  useEffect(() => {
    // Fetch municipality ID from API or context
    fetchMunicipalityId().then(id => setMunicipalityId(id));
  }, []);

  if (!municipalityId) return <div>טוען...</div>;

  return <OnCallDynamic municipalityId={municipalityId} />;
}
```

---

## 🔧 Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `municipalityId` | `string` (UUID) | ✅ | מזהה העירייה |

---

## 🎨 עיצוב

### צבעים:
- **Header**: גרדיאנט סגול-כחול (`purple-600` → `indigo-600`)
- **התראות**: רקע אדום בהיר (`red-50`)
- **כפתור התקשר**: ירוק (`green-500`)
- **Hover**: אפור בהיר (`gray-50`)

### Responsive:
- **Mobile**: כפתורים קטנים, מספר טלפון מוסתר
- **Desktop**: כפתורים מלאים, מספר טלפון גלוי

---

## 📡 API Dependency

הרכיב משתמש ב-API endpoint:

```
GET /api/on-call/current?municipality_id={id}
```

**Response:**
```json
{
  "success": true,
  "departments": [
    {
      "department": {
        "id": "uuid",
        "name": "חשמל",
        "code": "electricity",
        "icon": "⚡",
        "requires_24_7": true
      },
      "contact": {
        "id": "uuid",
        "name": "מאור אייש",
        "phone": "050-1234567",
        "email": "maor@example.com",
        "is_external": false,
        "external_company": null,
        "is_default": true
      },
      "has_contact": true,
      "alert": null
    }
  ],
  "summary": {
    "total": 9,
    "with_contacts": 8,
    "without_contacts": 1,
    "critical_missing": 1
  },
  "alerts": [
    {
      "department": "רווחה",
      "message": "⚠️ חובה כונן 24/7 - אין כונן זמין!"
    }
  ]
}
```

---

## 🔄 Auto-Refresh

הרכיב מתעדכן אוטומטית כל **5 דקות**.

ניתן לשנות את התדירות ב-`useEffect`:

```javascript
// Change from 5 minutes to 10 minutes
const interval = setInterval(fetchCurrentOnCall, 10 * 60 * 1000);
```

---

## 🧪 דף בדיקה

נוצר דף בדיקה ב:
```
/app/test-oncall/page.js
```

גש ל:
```
http://localhost:3000/test-oncall
```

---

## 📱 Mobile Support

הרכיב מותאם לחלוטין למובייל:
- ✅ כפתורים גדולים (touch-friendly)
- ✅ טקסט קריא
- ✅ Collapse/Expand
- ✅ כפתור התקשר עובד במובייל

---

## 🎯 Use Cases

### 1. דף מוקדן
```jsx
<OnCallDynamic municipalityId={user.municipality_id} />
```

### 2. דף מנהל מוקד
```jsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <OnCallDynamic municipalityId={municipalityId} />
  <OtherComponent />
</div>
```

### 3. דף חירום
```jsx
<div className="space-y-4">
  <EmergencyAlert />
  <OnCallDynamic municipalityId={municipalityId} />
  <ShelterStatus />
</div>
```

---

## 🚀 Next Steps

### תכונות עתידיות:
- [ ] Toast notifications על העתקה
- [ ] פילטר לפי מחלקה
- [ ] חיפוש כונן
- [ ] היסטוריית שינויים
- [ ] אינטגרציה עם WhatsApp

---

## 📝 Notes

- הרכיב דורש authentication (cookies)
- עובד רק עם municipalities שהוגדרו ב-DB
- תומך ב-RTL (Hebrew)
- נבדק על Chrome, Safari, Firefox

---

**Created:** 10 מאי 2026  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
